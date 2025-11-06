import { Context } from '@temporalio/activity'; // <-- FIX 1: 'Info' (uppercase)
import { ApplicationFailure } from '@temporalio/common';
import { LabDecision, CrisisDecision } from './shared';

// This is our simulation helper.
// We'll keep the 3-second delay to see things happen.
async function sim(name: string, delayMs = 3000): Promise<string> {
  console.log(`[Activity] Running: ${name}`);
  await new Promise(r => setTimeout(r, delayMs));
  console.log(`[Activity] Finished: ${name}`);
  return `ok:${name}`;
}

// --- STANDARD ACTIVITIES ---

export async function processPayment(orderId: string, scenario: string): Promise<string> {
  if (scenario === 'CURRENCY_VOLATILITY') {
    console.log(`[Activity] Detected CURRENCY_VOLATILITY. Adjusting margins...`);
    await sim("adjustCurrency", 2000);
    console.log(`[Activity] Margins protected.`);
  }
  return sim("processPayment", 1000); // Payment is fast
}

export async function allocateWarehouse(orderId: string, scenario: string): Promise<string> {
  if (scenario === 'HIGH_DEMAND_STOCK_FAIL') {
    console.error(`[Activity] FAILED: Warehouse Allocation. Stock is 0.`);
    // 👇 FIX 2: Pass a single object
    throw ApplicationFailure.create({
      message: 'Stock level is 0 due to high demand',
      type: 'SimulatedFailure',
      nonRetryable: true,
    });
  }
  return sim("allocateWarehouse");
}

export async function packageOrder(orderId: string, scenario: string): Promise<string> {
  if (scenario === 'QUALITY_FAIL') {
    console.error(`[Activity] FAILED: Quality inspection failed.`);
    // 👇 FIX 2: Pass a single object
    throw ApplicationFailure.create({
      message: 'QA check found defects',
      type: 'SimulatedFailure',
      nonRetryable: true,
    });
  }
  return sim("packageOrder");
}

export async function startTransport(orderId: string, scenario: string): Promise<string> {
  if (scenario === 'LOGISTICS_JAM_DELAY') {
    console.error(`[Activity] FAILED: Transport route blocked (Major Accident).`);
    // 👇 FIX 2: Pass a single object
    throw ApplicationFailure.create({
      message: 'Major traffic accident detected',
      type: 'SimulatedFailure',
      nonRetryable: true,
    });
  }
  if (scenario === 'CARRIER_BANKRUPTCY') {
    console.error(`[Activity] FAILED: Original carrier (BudgetShip) filed for bankruptcy.`);
    // 👇 FIX 2: Pass a single object
    throw ApplicationFailure.create({
      message: 'Carrier is bankrupt',
      type: 'SimulatedFailure',
      nonRetryable: true,
    });
  }
  return sim("startTransport");
}

export async function clearCustoms(orderId: string, scenario: string): Promise<string> {
  // 👇 FIX 1: Use Context.current()
  const attempt = Context.current().info.attempt;
  console.log(`[Activity] clearCustoms, attempt #${attempt}`);

  // Simulate the 3s delay
  await new Promise(r => setTimeout(r, 3000)); 

  if (scenario === 'CHINA_CUSTOMS_FAIL' && attempt <= 2) {
    console.error(`[Activity] Customs check FAILED (Attempt ${attempt})`);
    // 👇 FIX 2: Pass a single object
    throw ApplicationFailure.create({
      message: `Customs check failed on attempt ${attempt}`,
      type: 'SimulatedFailure',
      nonRetryable: false, // This is key! We WANT it to be retryable.
    });
  }

  console.log(`[Activity] Customs check PASSED (Attempt ${attempt})`);
  return `ok:clearCustoms (attempt ${attempt})`;
}

export async function localDelivery(orderId: string): Promise<string> {
  return sim("localDelivery");
}
export async function deliverOrder(orderId: string): Promise<string> {
  return sim("deliverOrder");
}

// --- HUMAN-IN-THE-LOOP ACTIVITIES ---

export async function applyLabDecision(decision: LabDecision): Promise<string> {
  console.log(`[Activity] Applying lab decision: ${decision.choice}`);
  await sim(`applyLabDecision: ${decision.choice}`, 5000); // This takes longer
  return `ok:lab:${decision.choice}`;
}

export async function applyCrisisDecision(decision: CrisisDecision): Promise<string> {
  console.log(`[Activity] Applying crisis decision: ${decision.choice}`);
  await sim(`applyCrisisDecision: ${decision.choice}`, 5000);
  return `ok:crisis:${decision.choice}`;
}

// --- NEW: AUTOMATIC RECOVERY ACTIVITIES ---

export async function packageOrderChina(orderId: string): Promise<string> {
  console.log(`[Activity] REROUTE: Packaging order at China factory.`);
  return sim("packageOrderChina");
}

export async function replaceWithCertifiedBatch(orderId: string): Promise<string> {
  console.log(`[Activity] RECOVERY: Recalling defective batch.`);
  await sim("recallDefectiveBatch", 2000);
  console.log(`[Activity] RECOVERY: Replacing with certified-grade batch.`);
  await sim("replaceWithCertifiedBatch", 4000);
  return "ok:batchReplaced";
}

export async function upgradeToExpressShipping(orderId: string): Promise<string> {
  console.log(`[Activity] RECOVERY: Upgrading to Express Air Shipping.`);
  await sim("upgradeToExpressShipping", 4000);
  return "ok:expressUpgrade";
}

export async function findAlternativeCarrier(orderId: string): Promise<string> {
  console.log(`[Activity] RECOVERY: Finding new carrier...`);
  await sim("findAlternativeCarrier", 2000);
  console.log(`[Activity] RECOVERY: Booked with new carrier (PremiumLogistics).`);
  await sim("bookNewCarrier", 2000);
  return "ok:newCarrierBooked";
}