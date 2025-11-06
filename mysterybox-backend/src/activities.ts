import { LabDecision, CrisisDecision } from './shared'; // <-- THIS IS THE FIX

// These are your "real world" tasks.
// They are just simulated with a delay here.

async function sim(name: string): Promise<string> {
  console.log(`[Activity] Running: ${name}`);
  await new Promise(r => setTimeout(r, 1500)); // Simulate 1.5s of work
  console.log(`[Activity] Finished: ${name}`);
  return `ok:${name}`;
}

export async function processPayment(orderId: string): Promise<string> {
  return sim("processPayment");
}
export async function allocateWarehouse(orderId: string): Promise<string> {
  return sim("allocateWarehouse");
}
export async function packageOrder(orderId: string): Promise<string> {
  return sim("packageOrder");
}
export async function startTransport(orderId: string): Promise<string> {
  return sim("startTransport");
}
export async function clearCustoms(orderId: string): Promise<string> {
  return sim("clearCustoms");
}
export async function localDelivery(orderId: string): Promise<string> {
  return sim("localDelivery");
}
export async function deliverOrder(orderId: string): Promise<string> {
  return sim("deliverOrder");
}

// Special activities for handling interventions
export async function applyLabDecision(decision: LabDecision): Promise<string> {
  console.log(`[Activity] Applying lab decision: ${decision.choice}`);
  await new Promise(r => setTimeout(r, 2000));
  return `ok:lab:${decision.choice}`;
}

export async function applyCrisisDecision(decision: CrisisDecision): Promise<string> {
  console.log(`[Activity] Applying crisis decision: ${decision.choice}`);
  await new Promise(r => setTimeout(r, 2000));
  return `ok:crisis:${decision.choice}`;
}