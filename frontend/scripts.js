document.addEventListener("DOMContentLoaded", () => {

    // --- Configuration ---
    const API_BASE_URL = "http://localhost:5000"; // REAL Backend API URL
    const POLLING_INTERVAL = 2000; // Poll status every 2 seconds

    const steps = [
        { id: "step-1", name: "Order Received" },
        { id: "step-2", name: "Payment OK" },
        { id: "step-3", name: "Warehouse Allocation" },
        { id: "step-4", name: "Packaged (Factory)" },
        { id: "step-5", name: "Transport Started" },
        { id: "step-6", name: "Customs Clearance" },
        { id: "step-7", name: "Local Delivery" },
        { id: "step-8", name: "Delivered" }
    ];
    const scenarios = {
        "ESTONIA_OK": { name: "The 'EU Standard' Box", price: "99" },
        "CHINA_CUSTOMS_FAIL": { name: "The 'Far East' Box", price: "199" },
        "ESTONIA_FAIL_REROUTE": { name: "The 'Volatile Stock' Box", price: "149" },
        "CHINA_CRISIS_FAIL": { name: "The 'High Risk' Box", price: "499" },
        "LAB_FAIL_SCREWS": { name: "The 'High-Spec' Box", price: "399" },
        "SHIPPING_DELAY": { name: "The 'Rush Order' Box", price: "349" },
        "QUALITY_FAIL": { name: "The 'Premium Quality' Box", price: "299" },
        "CARRIER_BANKRUPTCY": { name: "The 'Budget Shipping' Box", price: "129" },
        "CURRENCY_VOLATILITY": { name: "The 'International Value' Box", price: "259" }
    };
    const BASE_DATE = new Date(); // Start date for all calculations

    // --- State Keys (Persistent browser state) ---
    const SCENARIO_KEY = "workflow_scenario";
    const WORKFLOW_ID_KEY = "current_workflow_id";

    // --- Element References ---
    const views = {
        config: document.getElementById("config-view"),
        checkout: document.getElementById("checkout-view"),
        workflow: document.getElementById("workflow-view")
    };
    const logOutput = document.getElementById("log-output");
    const retryButton = document.getElementById("retryButton");
    const resetButton = document.getElementById("resetButton");
    const deliveryDateEl = document.getElementById("delivery-date");
    const modalOverlay = document.getElementById("intervention-modal-overlay");
    const confirmInterventionButton = document.getElementById("confirm-intervention-button");
    const labModalOverlay = document.getElementById("lab-modal-overlay");
    const confirmLabButton = document.getElementById("confirm-lab-button");


    // --- Helper Functions ---

    function showView(viewId) {
        for (const key in views) {
            views[key].style.display = (key === viewId) ? "block" : "none";
        }
    }

    function log(message, type = 'info') {
        let prefix = "ℹ️";
        if (type === 'success') prefix = "✅";
        if (type === 'error') prefix = "❌";
        if (type === 'warn') prefix = "⚠️";

        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${prefix} ${message}`;
        if(type === 'suggestion') {
            logEntry.classList.add('log-suggestion');
        }

        logOutput.prepend(logEntry);
    }

    function logBusinessSuggestion(cost, solution) {
        log(`Business suggestion generated based on manual action:`, 'suggestion');
        const message = `
SUGGESTION: The selected option (${solution}) increased the cost by ${cost}%.
For future "High Risk" orders, consider automatically offering the customer two choices at checkout...
(This logic is now client-side, triggered by the modal action)`;
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry log-suggestion';
        logEntry.style.whiteSpace = "pre-wrap";
        logEntry.style.fontFamily = "monospace";
        logEntry.textContent = message;
        logOutput.prepend(logEntry);
    }

    function formatDate(date) {
        return date.toLocaleDateString("en-US", {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    function updateDeliveryDate(daysToAdd) {
        const newDate = new Date(BASE_DATE.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        localStorage.setItem("delivery_date", newDate.toISOString());
        deliveryDateEl.textContent = formatDate(newDate);
        return newDate;
    }

    function updateUI(currentStepIndex, state = 'active') {
        steps.forEach((step, index) => {
            const el = document.getElementById(step.id);
            if (!el) return;
            el.classList.remove("active", "completed", "error", "warning");

            if (index < currentStepIndex) {
                el.classList.add("completed");
            } else if (index === currentStepIndex) {
                el.classList.add(state);
            }
        });
    }

    // --- Workflow State ---
    let currentWorkflowId = null;
    let statusPollingInterval = null;
    let lastLoggedStatus = "";

    /**
     * Start polling the backend for workflow status
     */
    function startStatusPolling() {
        if (statusPollingInterval) {
            clearInterval(statusPollingInterval);
        }

        statusPollingInterval = setInterval(async () => {
            if (!currentWorkflowId) return;
            try {
                await pollWorkflowStatus(); // This is the new REAL version
            } catch (error) {
                log(`Status polling error: ${error.message}`, 'error');
                stopStatusPolling();
            }
        }, POLLING_INTERVAL);
    }

    /**
     * Poll the backend API for the current workflow status
     */
    async function pollWorkflowStatus() {
        if (!currentWorkflowId) return;

        const response = await fetch(`${API_BASE_URL}/api/status/${currentWorkflowId}`);
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        const data = await response.json();
        const status = data.status;

        // Don't re-log the same status
        if (status === lastLoggedStatus) return;
        lastLoggedStatus = status;

        if (status.startsWith("At Step:")) {
            const stepName = status.replace("At Step: ", "");
            const stepIndex = steps.findIndex(s => s.name === stepName);
            log(`Progress: Now at step '${stepName}'`);
            updateUI(stepIndex, 'active');
        
        } else if (status === "PAUSED: WAITING_FOR_LAB_DECISION") {
            log("🔬 CRITICAL FAILURE: Lab inspection failed.", 'error');
            log("🛑 WORKFLOW PAUSED. Awaiting management decision.", 'warn');
            const errorStepIndex = steps.findIndex(s => s.name === "Packaged (Factory)");
            updateUI(errorStepIndex, 'error');
            stopStatusPolling();
            labModalOverlay.style.display = "flex"; // Show Modal 2
            
        } else if (status === "PAUSED: WAITING_FOR_CRISIS_DECISION") {
            log("⚠️ CRITICAL ERROR: Transport route blocked.", 'error');
            log("🛑 WORKFLOW PAUSED. Awaiting human intervention.", 'warn');
            const errorStepIndex = steps.findIndex(s => s.name === "Transport Started");
            updateUI(errorStepIndex, 'error');
            stopStatusPolling();
            modalOverlay.style.display = "flex"; // Show Modal 1

        } else if (status === "Completed" || status === "WORKFLOW_EXECUTION_STATUS_COMPLETED") {
            log("🎉 Order completed successfully!", 'success');
            stopStatusPolling();
            updateUI(steps.length, 'completed');
            decrementStock(); // Decrement inventory on completion
            clearWorkflowState(false);
        
        } else if (status.includes("FAILED") || status.includes("TIMED_OUT")) {
            log(`Workflow ended in non-success state: ${status}`, 'error');
            stopStatusPolling();
        }
    }


    /**
     * Stop status polling
     */
    function stopStatusPolling() {
        if (statusPollingInterval) {
            clearInterval(statusPollingInterval);
            statusPollingInterval = null;
        }
    }

    /**
     * Start workflow by calling the backend API
     */
    async function startWorkflow() {
        log("Initializing workflow...");
        retryButton.style.display = "none";

        const scenario = sessionStorage.getItem(SCENARIO_KEY);

        // Check if we have an existing workflow to resume
        const existingWorkflowId = localStorage.getItem(WORKFLOW_ID_KEY);
        if (existingWorkflowId) {
            currentWorkflowId = existingWorkflowId;
            log(`Resuming polling for existing workflow: ${currentWorkflowId}`, 'warn');
            startStatusPolling(); // Just start polling, it will find its state
            return;
        }

        // Create new order by calling the backend
        try {
            const customerInfo = {
                name: document.getElementById("name").value,
                email: document.getElementById("email").value,
                address: document.getElementById("address").value
            };
            
            updateDeliveryDate(14); // Default estimate

            log("📦 Creating order and starting Temporal workflow...");
            const response = await fetch(`${API_BASE_URL}/api/start-workflow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenario, customerInfo })
            });

            if (!response.ok) {
                throw new Error(`API error: ${await response.text()}`);
            }

            const data = await response.json();
            currentWorkflowId = data.workflowId;
            localStorage.setItem(WORKFLOW_ID_KEY, currentWorkflowId);

            log(`✅ Order created with real workflow ID: ${currentWorkflowId}`, 'success');
            startStatusPolling(); // Start polling for status

        } catch (error) {
            log(`Could not start workflow: ${error.message}`, 'error');
            retryButton.style.display = "inline-block";
        }
    }

    /**
     * Handle manual intervention signal (Crisis Modal)
     */
    async function resumeWithManualInput() {
        if (!currentWorkflowId) return;
        
        modalOverlay.style.display = "none"; // Hide modal 1
        
        const selectedSolution = document.querySelector('#intervention-form input[name="solution"]:checked');
        const decisionData = {
            choice: selectedSolution.value,
            cost: selectedSolution.dataset.cost,
            days: selectedSolution.dataset.days
        };

        log(`Sending intervention signal: ${decisionData.choice}`, 'warn');
        logBusinessSuggestion(decisionData.cost, decisionData.choice);
        updateDeliveryDate(parseInt(decisionData.days));
        
        try {
            // Send the signal to the backend
            await fetch(`${API_BASE_URL}/api/signal/crisis/${currentWorkflowId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(decisionData)
            });
            
            log("✅ Signal sent. Resuming workflow...", 'success');
            startStatusPolling(); // Resume polling to see progress
            
        } catch (error) {
            log(`Failed to send signal: ${error.message}`, 'error');
        }
    }

    /**
     * Handle manual intervention signal (Lab Modal)
     */
    async function resumeFromLabInput() {
        if (!currentWorkflowId) return;

        labModalOverlay.style.display = "none"; // Hide modal 2

        const selectedSolution = document.querySelector('#lab-form input[name="solution"]:checked');
        const decisionData = {
            choice: selectedSolution.value,
            cost: selectedSolution.dataset.cost,
            delayWeeks: selectedSolution.dataset.delay,
            risk: selectedSolution.dataset.risk
        };

        log(`Sending management decision: ${decisionData.choice}`, 'warn');
        
        // Log audit
        const logMessage = `
DECISION AUDIT LOG:
- Choice: ${decisionData.choice}
- Estimated Cost: $${decisionData.cost}M
- Estimated Delay: ${decisionData.delayWeeks} weeks
${decisionData.risk ? `- Accepted Risk: High (Est. $${decisionData.risk}M Liability)` : ''}
        `;
        log(logMessage, 'suggestion');

        updateDeliveryDate(decisionData.delayWeeks * 7); 
        
        try {
            // Send the signal to the backend
            await fetch(`${API_BASE_URL}/api/signal/lab/${currentWorkflowId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(decisionData)
            });

            log("✅ Decision confirmed. Resuming workflow...", 'success');
            startStatusPolling(); // Resume polling

        } catch (error) {
            log(`Failed to send signal: ${error.message}`, 'error');
        }
    }


    function clearWorkflowState(fullReset = true) {
        localStorage.removeItem("delivery_date");
        localStorage.removeItem(WORKFLOW_ID_KEY);
        currentWorkflowId = null;
        stopStatusPolling();
        if (fullReset) {
            sessionStorage.removeItem(SCENARIO_KEY);
        }
    }

    function resetWorkflow() {
        log("Resetting simulation...");
        clearWorkflowState(true);

        retryButton.style.display = "none";
        modalOverlay.style.display = "none";
        labModalOverlay.style.display = "none";
        logOutput.innerHTML = "";
        log("Waiting to start...");
        updateUI(-1);
        deliveryDateEl.textContent = "...";

        showView("config");
    }

    // --- Inventory Polling Functions (Unchanged Simulation) ---

    async function pollStockStatus() {
        let stockLevel = parseInt(localStorage.getItem('current_stock_level') || '95');
        if (Math.random() > 0.7) {
            stockLevel = Math.max(0, stockLevel - Math.floor(Math.random() * 2)); 
            localStorage.setItem('current_stock_level', stockLevel.toString());
        }
        let demandStatus = 'NORMAL';
        if (stockLevel <= 20) { demandStatus = 'HIGH'; } 
        else if (stockLevel <= 50) { demandStatus = 'MEDIUM'; }
        updateInventoryDisplay(stockLevel, demandStatus);
    }

    function initializeInventoryPolling() {
        console.log('Initializing inventory polling simulation...');
        pollStockStatus();
        setInterval(pollStockStatus, 5000);
    }

    function updateInventoryDisplay(stockLevel, demandStatus) {
        const display = document.getElementById('inventory-display');
        if (!display) return;
        let statusColor = '#05d9a0';
        let stockText = `${stockLevel}/100`;
        if (stockLevel === 'ERROR' || stockLevel === 'OFFLINE') {
            statusColor = '#ff5e5e'; stockText = stockLevel;
        } else if (stockLevel <= 20) { statusColor = '#ff5e5e'; }
        else if (demandStatus === 'HIGH' || stockLevel <= 50) { statusColor = '#ffc107'; }
        display.innerHTML = `
            <span style="color: ${statusColor}">Current Stock: ${stockText}</span><br>
            <span style="color: ${statusColor}">Demand: ${demandStatus}</span>`;
        localStorage.setItem('current_stock_level', stockLevel.toString());
        localStorage.setItem('current_demand_status', demandStatus);
    }

    function decrementStock(units = 1) {
        let currentStock = parseInt(localStorage.getItem('current_stock_level') || '100');
        currentStock = Math.max(0, currentStock - units);
        localStorage.setItem('current_stock_level', currentStock.toString());
        updateInventoryDisplay(currentStock, localStorage.getItem('current_demand_status') || 'NORMAL');
    }

    // --- Event Listeners ---

    document.getElementById("config-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const selectedRadio = document.querySelector('input[name="scenario"]:checked');
        const scenarioId = selectedRadio.value;
        const scenarioInfo = scenarios[scenarioId];
        sessionStorage.setItem(SCENARIO_KEY, scenarioId);
        document.getElementById("product-name-summary").textContent = scenarioInfo.name;
        document.getElementById("product-price-summary").textContent = " " + scenarioInfo.price;
        document.getElementById("product-price-total").textContent = " " + scenarioInfo.price;
        showView("checkout");
    });

    document.getElementById("pay-button").addEventListener("click", () => {
        if (document.getElementById("checkout-form").checkValidity()) {
            showView("workflow");
            startWorkflow();
        } else {
            alert("Please fill in all required fields.");
        }
    });

    retryButton.addEventListener("click", startWorkflow);
    resetButton.addEventListener("click", resetWorkflow);
    confirmInterventionButton.addEventListener("click", resumeWithManualInput);
    confirmLabButton.addEventListener("click", resumeFromLabInput);


    // --- Initialization on page load ---
    function initialize() {
        const existingWorkflowId = localStorage.getItem(WORKFLOW_ID_KEY);
        const scenario = sessionStorage.getItem(SCENARIO_KEY);

        if (existingWorkflowId && scenario) {
            log("Detected an ongoing workflow. Querying status...", 'warn');
            showView("workflow");
            currentWorkflowId = existingWorkflowId;

            const savedDate = localStorage.getItem("delivery_date");
            if (savedDate) {
                deliveryDateEl.textContent = formatDate(new Date(savedDate));
            }
            
            // Just start polling. The poll function will handle the UI
            // and show the modal if necessary.
            startStatusPolling();
            pollWorkflowStatus(); // Poll immediately on load
        } else {
            // Fresh start
            clearWorkflowState(true);
            showView("config");
        }
    }

    // --- Start ---
    initializeInventoryPolling();
    initialize();
});