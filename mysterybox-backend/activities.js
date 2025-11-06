// This is a simple async sleep function to simulate work
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// These are your activities. They are just async functions.
// In a real app, they would make API calls, access databases, etc.

export async function checkPayment(customerName) {
  console.log(`Checking payment for ${customerName}...`);
  await sleep(1500);
  console.log("Payment OK.");
  return { status: "OK" };
}

export async function allocateWarehouse(scenario, customerName) {
  console.log(`Allocating warehouse for ${customerName} (Scenario: ${scenario})...`);
  await sleep(2000);

  if (scenario === "ESTONIA_FAIL_REROUTE") {
    console.warn("Warehouse allocation FAILED in Estonia.");
    // This data will be sent to the frontend for the intervention
    return {
      status: "FAIL",
      errorCode: "NO_STOCK_ESTONIA",
      message: "No stock in Tallinn warehouse for 'Volatile Stock' Box.",
      // This is where you could call an AI to get suggestions!
      suggestions: [
        { id: "SWEDEN", cost: 30, days: 2 },
        { id: "GERMANY", cost: 15, days: 5 },
        { id: "VIETNAM", cost: 5, days: 14 },
      ],
    };
  }

  console.log("Warehouse allocated in Estonia.");
  return { status: "OK", warehouse: "Tallinn, Estonia" };
}

export async function packageBox(warehouse) {
  console.log(`Packaging box in ${warehouse}...`);
  await sleep(3000);
  console.log("Box packaged.");
  return { status: "OK" };
}

export async function startTransport(warehouse) {
  console.log(`Starting transport from ${warehouse}...`);
  await sleep(1000);
  console.log("Transport started.");
  return { status: "OK" };
}

/**
 * UPDATED
 * This function now provides suggestions for CHINA_CUSTOMS_FAIL
 * but still hard-fails for CHINA_CRISIS_FAIL.
 */
export async function checkCustoms(scenario) {
  console.log(`Checking customs (Scenario: ${scenario})...`);
  await sleep(4000);

  if (scenario === "CHINA_CUSTOMS_FAIL") {
    console.warn("Customs check FAILED in China. Intervention required.");
    return {
      status: "FAIL",
      errorCode: "CUSTOMS_BLOCKED_CHINA",
      message: "High-risk item flagged at Shanghai customs. Please advise.",
      // NEW: We now provide suggestions to the human!
      suggestions: [
        { id: "REROUTE_HK", cost: 40, days: 3 },
        { id: "SUBMIT_PAPERWORK", cost: 5, days: 7 },
        { id: "RETURN_TO_SENDER", cost: 0, days: 0 },
      ],
    };
  }
  
  if (scenario === "CHINA_CRISIS_FAIL") {
    console.error("Customs check FAILED. Geopolitical crisis.");
    // This is still a hard fail (no suggestions)
    return {
      status: "FAIL",
      errorCode: "GEOPOLITICAL_BLOCK",
      message: "Port closed due to geopolitical crisis. Total loss.",
    };
  }

  console.log("Customs cleared.");
  return { status: "OK" };
}

export async function startLocalDelivery() {
  console.log("Starting local delivery...");
  await sleep(2000);
  console.log("Local delivery in progress.");
  return { status: "OK" };
}

export async function deliverPackage() {
  console.log("Delivering package...");
  await sleep(1000);
  console.log("Package Delivered.");
  const deliveryDate = new Date().toISOString();
  return { status: "OK", deliveryDate };
}

export async function handleReroute(solution) {
  console.log(`Handling reroute to ${solution}...`);
  // This would be a complex activity, but for now, it's fast
  await sleep(1000);
  let newWarehouse = "";
  if (solution === "SWEDEN") newWarehouse = "Arlanda, Sweden";
  if (solution === "GERMANY") newWarehouse = "Berlin, Germany";
  if (solution === "VIETNAM") newWarehouse = "Hanoi, Vietnam";

  console.log(`Reroute to ${newWarehouse} confirmed.`);
  return { status: "OK", warehouse: newWarehouse };
}


/**
 * NEW ACTIVITY
 * This handles the choice from the customs intervention.
 */
export async function handleCustomsIntervention(solution) {
  console.log(`Handling customs intervention: ${solution}...`);
  await sleep(2500);

  switch (solution) {
    case "REROUTE_HK":
      console.log("Rerouting package via Hong Kong customs.");
      // The workflow can continue
      return { status: "OK", message: "Rerouted via Hong Kong." };
    case "SUBMIT_PAPERWORK":
      console.log("Submitting additional paperwork. This will add a 7-day delay.");
      // The workflow can continue (after a simulated delay)
      await sleep(7000); // Simulate 7-day delay
      return { status: "OK", message: "Paperwork submitted." };
    case "RETURN_TO_SENDER":
      console.log("Order is being returned. Issuing refund.");
      // This will cause the workflow to fail, but in a *controlled* way
      return { status: "FAIL", message: "Order returned to sender. Refund issued." };
    default:
      return { status: "FAIL", message: "Unknown solution." };
  }
}