import { proxyActivities, defineSignal, defineQuery, setHandler, condition } from '@temporalio/workflow';
// Import all activities from the activities file
import *allActivities from './activities.js';

// --- Signal & Query Definitions ---
// A Signal is a one-way message *into* a running workflow
export const resolveInterventionSignal = defineSignal('resolveIntervention');

// A Query is a way to *read* the state of a running workflow
export const getStatusQuery = defineQuery('getStatus');


// This is the main workflow function
export async function mysteryBoxWorkflow(customerName, scenario) {
  
  // --- THIS IS THE FIX ---
  // The proxyActivities call has been MOVED INSIDE the workflow function.
  // It will no longer run when the API server or Worker imports this file.
  const activities = proxyActivities(allActivities, {
    startToCloseTimeout: '1minute', // This is the required timeout
  });
  // --- END OF FIX ---


  // This state object will be queryable by the frontend
  let state = {
    workflowId: '', // We'll set this later
    currentStep: 'OrderReceived',
    customerName: customerName,
    scenario: scenario,
    warehouse: 'N/A',
    deliveryDate: null,
    interventionNeeded: false,
    interventionData: null,
    workflowComplete: false,
    workflowFailed: false,
    failureMessage: null,
  };

  // --- State Handlers ---
  // The query handler returns the current state to the frontend
  setHandler(getStatusQuery, () => state);

  // The signal handler updates the state when the human provides input
  let interventionChoice = null;
  setHandler(resolveInterventionSignal, (solution) => {
    interventionChoice = solution; // Update the choice
    state.interventionNeeded = false; // Mark as resolved
    state.interventionData = null;
  });

  // --- Workflow Logic ---
  try {
    // Step 1: Order Received (Frontend does this, we start at Payment)
    state.currentStep = 'PaymentOK';
    await activities.checkPayment(customerName);

    // Step 2: Warehouse Allocation
    state.currentStep = 'WarehouseAllocation';
    const warehouseResult = await activities.allocateWarehouse(scenario, customerName);

    if (warehouseResult.status === 'FAIL') {
      // --- INTERVENTION 1: WAREHOUSE ---
      console.log('Workflow paused. Awaiting human intervention.');
      state.currentStep = 'InterventionRequired'; // Special step
      state.interventionNeeded = true;
      state.interventionData = warehouseResult;

      // Pause the workflow and wait for the signal (with a 10-min timeout)
      await condition(() => interventionChoice !== null, '10m');
      
      if (interventionChoice === null) {
        throw new Error('Intervention timed out.');
      }

      console.log(`Intervention received. Rerouting to ${interventionChoice}...`);
      state.currentStep = 'WarehouseAllocation'; // Back to allocation step
      const rerouteResult = await activities.handleReroute(interventionChoice);
      state.warehouse = rerouteResult.warehouse;
      // --- END OF INTERVENTION 1 ---
    } else {
      // Happy path
      state.warehouse = warehouseResult.warehouse;
    }

    // NEW: Reset interventionChoice so it's null for the next potential intervention
    interventionChoice = null;

    // Step 3: Packaged
    state.currentStep = 'Packaged';
    await activities.packageBox(state.warehouse);

    // Step 4: Transport Started
    state.currentStep = 'TransportStarted';
    await activities.startTransport(state.warehouse);

    // --- Step 5: Customs Clearance (THIS LOGIC IS NOW UPDATED) ---
    state.currentStep = 'CustomsClearance';
    const customsResult = await activities.checkCustoms(scenario);

    if (customsResult.status === 'FAIL') {
      
      // Check if this failure is recoverable (i.e., has suggestions)
      if (customsResult.suggestions) {
        // --- INTERVENTION 2: CUSTOMS ---
        console.log('Workflow paused. Awaiting customs intervention.');
        state.currentStep = 'InterventionRequired';
        state.interventionNeeded = true;
        state.interventionData = customsResult; // Pass all data to frontend

        // Wait for the human to signal
        await condition(() => interventionChoice !== null, '10m');

        if (interventionChoice === null) {
          throw new Error('Customs intervention timed out.');
        }
        
        console.log(`Customs intervention received: ${interventionChoice}`);
        state.currentStep = 'CustomsClearance'; // Set step back
        
        // Call the new activity to handle the choice
        const interventionResult = await activities.handleCustomsIntervention(interventionChoice);
        
        // If the human chose "RETURN", the activity returns FAIL,
        // and we fail the workflow in a controlled way.
        if (interventionResult.status === 'FAIL') {
          throw new Error(interventionResult.message);
        }
        // --- END OF INTERVENTION 2 ---
      } else {
        // This is a hard fail with no suggestions (like the Warzone box)
        throw new Error(customsResult.message);
      }
    }

    // Step 6: Local Delivery
    state.currentStep = 'LocalDelivery';
    await activities.startLocalDelivery();

    // Step 7: Delivered
    state.currentStep = 'Delivered';
    const deliveryResult = await activities.deliverPackage();
    state.deliveryDate = deliveryResult.deliveryDate;
    state.workflowComplete = true;

    return { status: 'OK', deliveryDate: state.deliveryDate };

  } catch (err) {
    console.error('Workflow failed:', err.message);
    state.workflowFailed = true;
    state.failureMessage = err.message;
    state.currentStep = 'Failed'; // Set a final "Failed" step
    throw err; // Re-throw to mark the workflow as failed in Temporal
  }
}