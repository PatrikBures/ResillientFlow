document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM Loaded. Initializing Real Workflow Client...");

    // --- Configuration ---\
    const API_BASE_URL = "http://localhost:3030";
    const POLLING_INTERVAL_MS = 2000; // Poll every 2 seconds
    const SCENARIO_KEY = "config_scenario";
    const WORKFLOW_ID_KEY = "current_workflow_id";
    const CUSTOMER_KEY = "config_customer";

    // Step definition matching the frontend and workflow state
    const steps = [
        { id: "step-1", name: "Order Received", stepName: "OrderReceived" },
        { id: "step-2", name: "Payment OK", stepName: "PaymentOK" },
        { id: "step-3", name: "Warehouse Allocation", stepName: "WarehouseAllocation" },
        // Special intervention step
        { id: "step-i", name: "Intervention Required", stepName: "InterventionRequired" },
        { id: "step-4", name: "Packaged (Factory)", stepName: "Packaged" },
        { id: "step-5", name: "Transport Started", stepName: "TransportStarted" },
        { id: "step-6", name: "Customs Clearance", stepName: "CustomsClearance" },
        { id: "step-7", name: "Local Delivery", stepName: "LocalDelivery" },
        { id: "step-8", name: "Delivered", stepName: "Delivered" },
        // Special failure step
        { id: "step-f", name: "Workflow Failed", stepName: "Failed" },
    ];
    
    // Scenario definitions (from your original file)
    const scenarios = {
        "ESTONIA_OK": { name: "The 'EU Standard' Box", price: "99" },
        "CHINA_CUSTOMS_FAIL": { name: "The 'Far East' Box", price: "199" },
        "ESTONIA_FAIL_REROUTE": { name: "The 'Volatile Stock' Box", price: "149" },
        "CHINA_CRISIS_FAIL": { name: "The 'Warzone' Box", price: "499" }
    };

    // --- DOM Elements ---
    // Views
    const configView = document.getElementById("config-view");
    const workflowView = document.getElementById("workflow-view");

    // Config View
    const configForm = document.getElementById("config-form");
    const customerNameInput = document.getElementById("customer-name");
    const startWorkflowButton = document.getElementById("start-workflow-button");

    // Workflow View
    const workflowStepsContainer = document.getElementById("workflow-steps");
    const deliveryDateEl = document.getElementById("delivery-date");
    const logContainer = document.getElementById("log-container");
    const logEntries = document.getElementById("log-entries");
    const retryButton = document.getElementById("start-again-button"); // "Start a New Order"
    const resetButton = document.getElementById("reset-button");

    // Modal
    const modal = document.getElementById("modal-overlay");
    const modalTitle = document.getElementById("modal-title");
    const modalMessage = document.getElementById("modal-message");
    const modalForm = document.getElementById("intervention-form");
    const confirmInterventionButton = document.getElementById("confirm-intervention-button");
    
    // Inventory
    const inventoryDisplay = document.getElementById('inventory-display');

    // --- State ---
    let currentWorkflowId = null;
    let pollIntervalId = null;
    let lastLoggedStep = null; // To prevent duplicate log entries
    let lastKnownStep = null; // To track state changes

    // --- Core Functions ---

    /**
     * UPDATED: This function now *only* starts a workflow.
     * It no longer handles resetting.
     */
    async function startWorkflow(event) {
        event.preventDefault();

        const formData = new FormData(configForm);
        const customerNameValue = formData.get("customer-name");
        const customerName = customerNameValue ? customerNameValue.trim() : "";
        const scenario = formData.get("scenario");

        if (!customerName || !scenario) {
            alert("Please fill in all fields.");
            return;
        }

        log("Starting workflow... Contacting server.", "info");
        startWorkflowButton.disabled = true;
        startWorkflowButton.textContent = "Starting...";

        try {
            const response = await fetch(`${API_BASE_URL}/start-workflow`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerName, scenario }),
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            const data = await response.json();
            currentWorkflowId = data.workflowId;

            // Save state to resume session
            localStorage.setItem(WORKFLOW_ID_KEY, currentWorkflowId);
            localStorage.setItem(CUSTOMER_KEY, customerName);
            sessionStorage.setItem(SCENARIO_KEY, scenario);

            log(`Workflow started successfully. ID: ${currentWorkflowId}`, "success");
            
            // Switch to workflow view and start polling
            showView("workflow");
            startStatusPolling();

        } catch (error) {
            console.error("Failed to start workflow:", error);
            log(`Failed to start workflow: ${error.message}`, "error");
            startWorkflowButton.disabled = false;
            startWorkflowButton.textContent = "Start Order";
        }
    }

    /**
     * Polls the backend for the current workflow status
     */
    async function pollWorkflowStatus() {
        if (!currentWorkflowId) {
            stopStatusPolling();
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/workflow-status/${currentWorkflowId}`);
            
            if (!response.ok) {
                throw new Error(`Server poll failed: ${response.statusText} (${response.status})`);
            }
            
            const state = await response.json();
            
            // --- This is the core UI update logic ---
            
            // Handle race condition where workflow is still starting
            if (state.workflowExists === false) {
                log("Workflow is initializing...", "info");
                updateStepUI("OrderReceived"); // Keep UI on first step
                return;
            }
            
            // Update all step UIs based on the current step
            updateStepUI(state.currentStep);
            
            // Handle logs
            if (state.currentStep !== lastLoggedStep) {
                const stepDef = steps.find(s => s.stepName === state.currentStep);
                if (stepDef) {
                    log(`Workflow moved to step: ${stepDef.name}`, "info");
                    lastLoggedStep = state.currentStep;
                }
            }
            
            // Handle terminal states (Success, Failure)
            if (state.workflowComplete) {
                log("Workflow complete! Package delivered.", "success");
                stopStatusPolling();
                deliveryDateEl.textContent = state.deliveryDate ? formatDate(new Date(state.deliveryDate)) : "Completed";
                if(state.deliveryDate) localStorage.setItem("delivery_date", state.deliveryDate);
                if (retryButton) retryButton.style.display = "inline-block"; // Show "Try Again"
            } else if (state.workflowFailed) {
                log(`Workflow FAILED: ${state.failureMessage}`, "error");
                stopStatusPolling();
                if (retryButton) retryButton.style.display = "inline-block"; // Show "Try Again"
            } else if (state.interventionNeeded) {
                // Handle intervention
                if (lastKnownStep !== 'InterventionRequired') {
                    log("INTERVENTION REQUIRED. Workflow paused.", "warn");
                    showInterventionModal(state.interventionData);
                }
            }
            
            lastKnownStep = state.currentStep;

        } catch (error) {
            console.error("Polling error:", error);
            // UPDATED: Log to the UI, not just the console
            log(`Polling error: ${error.message}. Retrying...`, "error");
            // Don't stop polling, it might be a temporary network issue
        }
    }

    /**
     * Resets the entire workflow and clears state
     */
    async function resetWorkflow() {
        log("Resetting workflow...", "warn");
        stopStatusPolling();
        clearWorkflowState(true); // Clear all state and reload
    }

    /**
     * Submits the human intervention choice to the backend
     */
    async function resumeWithManualInput() {
        const formData = new FormData(modalForm);
        const solution = formData.get("solution");

        if (!solution) {
            alert("Please select a solution.");
            return;
        }

        log(`Submitting intervention: ${solution}...`, "info");
        confirmInterventionButton.disabled = true;

        try {
            await fetch(`${API_BASE_URL}/submit-intervention`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workflowId: currentWorkflowId, solution }),
            });

            log("Intervention submitted. Workflow is resuming.", "success");
            hideInterventionModal();

        } catch (error) {
            console.error("Failed to submit intervention:", error);
            log(`Failed to submit intervention: ${error.message}`, "error");
        } finally {
            confirmInterventionButton.disabled = false;
        }
    }

    // --- UI & Utility Functions ---

    /**
     * Updates the workflow steps UI based on the current step name
     */
    function updateStepUI(currentStepName) {
        // Find the index of the *definition* of the current step
        const currentStepDefIndex = steps.findIndex(s => s.stepName === currentStepName);
        if (currentStepDefIndex === -1) {
             console.warn(`Unknown step name: ${currentStepName}`);
             return; // Unknown step
        }

        // Get all the step elements from the DOM
        const stepElements = workflowStepsContainer.querySelectorAll(".workflow-step");

        stepElements.forEach((stepEl, index) => {
            // Find the definition for the *element* we are looking at
            const stepElDef = steps.find(s => s.id === stepEl.id);
            if (!stepElDef) return;

            // Find the *definition index* of the element we are looking at
            const stepElDefIndex = steps.findIndex(s => s.id === stepEl.id);

            stepEl.classList.remove("step-completed", "step-active", "step-failed", "step-intervention");
            stepEl.style.display = ""; // Reset display property

            if (currentStepDefIndex > stepElDefIndex) {
                // This step is completed
                stepEl.classList.add("step-completed");
            } else if (currentStepDefIndex === stepElDefIndex) {
                // This is the active step
                if (currentStepName === "Failed") {
                    stepEl.classList.add("step-failed");
                } else if (currentStepName === "InterventionRequired") {
                    stepEl.classList.add("step-intervention");
                } else {
                    stepEl.classList.add("step-active");
                }
            } else {
                // This is a future step
            }

            // --- Handle visibility of special steps ---
            const connEl = document.getElementById(`${stepEl.id}-conn`);

            if (stepEl.id === "step-i") { // Intervention Step
                if (currentStepName === "InterventionRequired" || (lastKnownStep === "InterventionRequired" && currentStepName === "WarehouseAllocation")) {
                    stepEl.style.display = "flex";
                    if(connEl) connEl.style.display = "";
                } else {
                    stepEl.style.display = "none";
                    if(connEl) connEl.style.display = "none";
                }
            }
             
            if (stepEl.id === "step-f") { // Failed Step
                if (currentStepName === "Failed") {
                    stepEl.style.display = "flex";
                     if(connEl) connEl.style.display = "";
                } else {
                    stepEl.style.display = "none";
                     if(connEl) connEl.style.display = "none";
                }
            }
        });
    }

    function showInterventionModal(data) {
        // Populate and show the modal
        modalTitle.textContent = `Intervention Required: ${data.errorCode}`;
        modalMessage.textContent = data.message;
        
        // Dynamically populate suggestions
        const form = document.getElementById("intervention-form");
        form.innerHTML = ""; // Clear old suggestions
        
        data.suggestions.forEach((suggestion, index) => {
            const choiceDiv = document.createElement("div");
            choiceDiv.className = "intervention-choice";
            
            const input = document.createElement("input");
            input.type = "radio";
            input.id = `choice-${suggestion.id}`;
            input.name = "solution";
            input.value = suggestion.id;
            if (index === 0) input.checked = true; // Default check the first one

            const label = document.createElement("label");
            label.htmlFor = `choice-${suggestion.id}`;
            label.innerHTML = `
                <strong>${suggestion.id.replace(/_/g, ' ')}</strong>
                <span>Est. cost: +${suggestion.cost}%. Est. time: ${suggestion.days} days.</span>
            `;
            
            choiceDiv.appendChild(input);
            choiceDiv.appendChild(label);
            form.appendChild(choiceDiv);
        });
        
        modal.style.display = "flex";
    }

    function hideInterventionModal() {
        modal.style.display = "none";
    }

    function clearWorkflowState(reload = false) {
        localStorage.removeItem(WORKFLOW_ID_KEY);
        localStorage.removeItem(CUSTOMER_KEY);
        localStorage.removeItem("delivery_date");
        sessionStorage.removeItem(SCENARIO_KEY);
        currentWorkflowId = null;
        lastLoggedStep = null;
        lastKnownStep = null;
        if (reload) {
            window.location.reload();
        }
    }

    function showView(viewName) {
        configView.style.display = "none";
        workflowView.style.display = "none";

        if (viewName === "config") {
            configView.style.display = "block";
        } else if (viewName === "workflow") {
            workflowView.style.display = "block";
            // Populate customer name
            const customer = localStorage.getItem(CUSTOMER_KEY);
            document.getElementById("customer-name-display").textContent = customer || "N/A";
        }
    }

    function log(message, type = "info") {
        const entry = document.createElement("div");
        entry.className = `log-entry log-${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        entry.innerHTML = `<span class="log-time">${timestamp}</span> <span class="log-msg">${message}</span>`;
        
        logEntries.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight; // Auto-scroll
    }

    function startStatusPolling() {
        if (pollIntervalId) {
            clearInterval(pollIntervalId);
        }
        pollWorkflowStatus(); // Poll immediately
        pollIntervalId = setInterval(pollWorkflowStatus, POLLING_INTERVAL_MS);
    }

    function stopStatusPolling() {
        if (pollIntervalId) {
            clearInterval(pollIntervalId);
            pollIntervalId = null;
        }
    }

    function formatDate(date) {
        return date.toLocaleString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    // --- Inventory Polling (from your original file) ---
    async function pollStockStatus() {
        try {
            // This is a mock API, replace with a real one if you have it
            // const response = await fetch("http://localhost:3031/inventory/SW-ARL");
            // const data = await response.json();
            
            // Mocking data for the demo
            const data = {
                warehouseId: "SW-ARL",
                stock: Math.floor(Math.random() * 50) + 10, // Random stock
                lastUpdated: new Date().toISOString()
            };

            inventoryDisplay.innerHTML = `
                <strong>${data.stock}</strong> units available
                <span class="stock-updated">Updated: ${new Date(data.lastUpdated).toLocaleTimeString()}</span>
            `;
            inventoryDisplay.classList.toggle('low-stock', data.stock < 20);
        } catch (err) {
            inventoryDisplay.innerHTML = "Stock status unavailable";
            inventoryDisplay.classList.add('low-stock');
        }
    }

    function initializeInventoryPolling() {
        pollStockStatus(); // Poll immediately
        setInterval(pollStockStatus, 5000); // Poll stock every 5s
    }

    // --- Event Listeners ---
    // View 1: Config
    configForm.addEventListener("submit", startWorkflow);

    // View 2: Workflow
    // --- THIS BLOCK IS NOW FIXED ---
    if (retryButton) {
        retryButton.addEventListener("click", resetWorkflow); // "Start a New Order"
    }
    if (resetButton) {
        resetButton.addEventListener("click", resetWorkflow); // "Reset (Simulate Crash)"
    }

    // View 3: Modal
    confirmInterventionButton.addEventListener("click", resumeWithManualInput);


    // --- Initialization ---
    function initialize() {
        currentWorkflowId = localStorage.getItem(WORKFLOW_ID_KEY);

        if (currentWorkflowId) {
            log("Discovered an ongoing workflow. Resuming...", "warn");
            showView("workflow");
            
            const savedDate = localStorage.getItem("delivery_date");
            if (savedDate) {
                deliveryDateEl.textContent = formatDate(new Date(savedDate));
            }
            
            startStatusPolling(); // Start polling for status
        } else {
            // Fresh start
            showView("config");
            clearWorkflowState(false); // Ensure clean state
        }

        // Always start inventory polling
        initializeInventoryPolling();
    }

    initialize();
});