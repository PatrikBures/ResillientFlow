import { proxyActivities, setHandler, condition, defineQuery } from '@temporalio/workflow';
import * as wf from '@temporalio/workflow';
import type * as activities from './activities';
import {
  labDecisionSignal,
  crisisDecisionSignal,
  statusQuery,
  LabDecision,
  CrisisDecision
} from './shared';

// Setup activities with a retry policy
const {
  processPayment,
  allocateWarehouse,
  packageOrder,
  startTransport,
  clearCustoms,
  localDelivery,
  deliverOrder,
  applyLabDecision,
  applyCrisisDecision
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
});

/**
 * This is the main workflow definition.
 * It orchestrates the activities and waits for signals.
 */
export async function logisticsWorkflow(scenario: string): Promise<string> {
  const orderId = wf.workflowInfo().workflowId;
  
  // This variable will be queryable by the frontend
  let currentStatus = "Order Received";
  
  // 1. Set up the Query handler
  setHandler(statusQuery, () => currentStatus);

  // --- Step 2 ---
  currentStatus = "At Step: Payment OK";
  await processPayment(orderId);
  
  // --- Step 3 ---
  currentStatus = "At Step: Warehouse Allocation";
  await allocateWarehouse(orderId);

  // --- Step 4 (Package) & Lab Fail Check ---
  currentStatus = "At Step: Packaged (Factory)";
  await packageOrder(orderId);

  if (scenario === 'LAB_FAIL_SCREWS') {
    currentStatus = "PAUSED: WAITING_FOR_LAB_DECISION";
    let decision: LabDecision | null = null;
    
    // Set up the signal handler
    setHandler(labDecisionSignal, (payload: LabDecision) => {
      decision = payload;
    });

    // Pause the workflow until the signal arrives
    await condition(() => decision !== null);
    
    // Workflow resumes!
    currentStatus = `Resuming with decision: ${decision!.choice}`;
    await applyLabDecision(decision!);
  }
  
  // --- Step 5 (Transport) & Crisis Fail Check ---
  currentStatus = "At Step: Transport Started";
  
  if (scenario === 'CHINA_CRISIS_FAIL') {
    currentStatus = "PAUSED: WAITING_FOR_CRISIS_DECISION";
    let decision: CrisisDecision | null = null;
    
    setHandler(crisisDecisionSignal, (payload: CrisisDecision) => {
      decision = payload;
    });

    await condition(() => decision !== null);

    currentStatus = `Resuming with decision: ${decision!.choice}`;
    await applyCrisisDecision(decision!);

  } else {
    // Only run normal transport if not in the crisis scenario
    // (The crisis decision activity *replaces* this step)
    await startTransport(orderId);
  }

  // --- Remaining Steps ---
  currentStatus = "At Step: Customs Clearance";
  await clearCustoms(orderId);

  currentStatus = "At Step: Local Delivery";
  await localDelivery(orderId);
  
  currentStatus = "At Step: Delivered";
  await deliverOrder(orderId);

  currentStatus = "Completed";
  return "Workflow Completed Successfully";
}