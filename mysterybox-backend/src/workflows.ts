import { proxyActivities, setHandler, condition, defineQuery } from '@temporalio/workflow';
import { ApplicationFailure } from '@temporalio/common';
import * as wf from '@temporalio/workflow';
import type * as activities from './activities';
import {
  labDecisionSignal,
  crisisDecisionSignal,
  statusQuery,
  LabDecision,
  CrisisDecision
} from './shared';

// --- Proxy Setup ---

// 1. Standard activities
const stdActivities = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
});

// 2. Special proxy for clearCustoms, with a retry policy
const customsActivity = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes', // Customs can take a while
  retry: {
    initialInterval: '5s', // Wait 5s after first failure
    backoffCoefficient: 1.0,
    maximumAttempts: 3, // Try 3 times total
  },
});

// --- Workflow Definition ---

export async function logisticsWorkflow(scenario: string): Promise<string> {
  const orderId = wf.workflowInfo().workflowId;
  let currentStatus = "Order Received";
  setHandler(statusQuery, () => currentStatus);

  // --- Step 2: Payment ---
  currentStatus = "At Step: Payment OK";
  await wf.sleep('50ms');
  currentStatus = "RUNNING: processPayment";
  // This activity handles CURRENCY_VOLATILITY internally
  await stdActivities.processPayment(orderId, scenario);
  
  // --- Step 3: Warehouse Allocation ---
  currentStatus = "At Step: Warehouse Allocation";
  await wf.sleep('50ms');
  
  let isRerouted = false; // Flag to track rerouting
  try {
    currentStatus = "RUNNING: allocateWarehouse";
    await stdActivities.allocateWarehouse(orderId, scenario);
  } catch (err) {
    if (err instanceof ApplicationFailure && err.nonRetryable && scenario === 'HIGH_DEMAND_STOCK_FAIL') {
      currentStatus = "RECOVERY: Warehouse";
      await wf.sleep('50ms');
      currentStatus = "RUNNING: packageOrderChina";
      await stdActivities.packageOrderChina(orderId);
      isRerouted = true; // Mark as rerouted
    } else {
      throw err; // It was an unexpected error
    }
  }

  // --- Step 4: Packaging ---
  // Only run this if we weren't rerouted to China
  if (!isRerouted) {
    currentStatus = "At Step: Packaged (Factory)";
    await wf.sleep('50ms');
    try {
      currentStatus = "RUNNING: packageOrder";
      await stdActivities.packageOrder(orderId, scenario);
    } catch (err) {
      if (err instanceof ApplicationFailure && err.nonRetryable && scenario === 'QUALITY_FAIL') {
        currentStatus = "RECOVERY: Factory";
        await wf.sleep('50ms');
        currentStatus = "RUNNING: replaceWithCertifiedBatch";
        await stdActivities.replaceWithCertifiedBatch(orderId);
      } else {
        throw err; // Unexpected error
      }
    }
  }
  
  // --- Step 5: Transport ---
  currentStatus = "At Step: Transport Started";
  await wf.sleep('50ms');
  
  try {
    currentStatus = "RUNNING: startTransport";
    if (scenario === 'LAB_FAIL_SCREWS') {
      // Don't run transport yet, wait for lab decision
    } else {
      await stdActivities.startTransport(orderId, scenario);
    }
  } catch (err) {
    if (err instanceof ApplicationFailure && err.nonRetryable) {
      // Handle all the different transport failures
      if (scenario === 'LOGISTICS_JAM_DELAY') {
        currentStatus = "RECOVERY: Transport";
        await wf.sleep('50ms');
        currentStatus = "RUNNING: upgradeToExpressShipping";
        await stdActivities.upgradeToExpressShipping(orderId);
      } else if (scenario === 'CARRIER_BANKRUPTCY') {
        currentStatus = "RECOVERY: Transport";
        await wf.sleep('50ms');
        currentStatus = "RUNNING: findAlternativeCarrier";
        await stdActivities.findAlternativeCarrier(orderId);
      } else {
        throw err; // Unexpected non-retryable error
      }
    } else {
      throw err; // Retryable error
    }
  }

  // --- Human-in-the-loop checks ---
  
  if (scenario === 'LAB_FAIL_SCREWS') {
    currentStatus = "PAUSED: WAITING_FOR_LAB_DECISION";
    let decision: LabDecision | null = null;
    setHandler(labDecisionSignal, (payload: LabDecision) => { decision = payload; });
    await condition(() => decision !== null);
    
    currentStatus = `Resuming with decision: ${decision!.choice}`;
    await wf.sleep('50ms');
    currentStatus = "RUNNING: applyLabDecision";
    await stdActivities.applyLabDecision(decision!);
    
    if (decision!.choice === 'SHUTDOWN') {
      currentStatus = "Completed (via Shutdown)";
      return "Workflow Halted by Management Decision";
    }
  }
  
  if (scenario === 'CHINA_CRISIS_FAIL') {
    currentStatus = "PAUSED: WAITING_FOR_CRISIS_DECISION";
    let decision: CrisisDecision | null = null;
    setHandler(crisisDecisionSignal, (payload: CrisisDecision) => { decision = payload; });
    await condition(() => decision !== null);

    currentStatus = `Resuming with decision: ${decision!.choice}`;
    await wf.sleep('50ms');
    currentStatus = "RUNNING: applyCrisisDecision";
    await stdActivities.applyCrisisDecision(decision!);
  }

  // --- Step 6: Customs ---
  currentStatus = "At Step: Customs Clearance";
  await wf.sleep('50ms');
  currentStatus = "RUNNING: clearCustoms";
  
  // Use the special retryable proxy
  await customsActivity.clearCustoms(orderId, scenario);

  // --- Step 7: Local Delivery ---
  currentStatus = "At Step: Local Delivery";
  await wf.sleep('50ms');
  currentStatus = "RUNNING: localDelivery";
  await stdActivities.localDelivery(orderId);
  
  // --- Step 8: Delivered ---
  currentStatus = "At Step: Delivered";
  // 👇 FIXED TYPO
  await wf.sleep('50ms');
  currentStatus = "RUNNING: deliverOrder";
  await stdActivities.deliverOrder(orderId);

  currentStatus = "Completed";
  return "Workflow Completed Successfully";
}