import { Client } from '@temporalio/client';

// Read the address from an environment variable,
// defaulting to localhost if it's not set.
const temporalAddress = process.env.TEMPORAL_GRPC_ENDPOINT || 'localhost:7233';

console.log(`[Temporal Client] Connecting to Temporal at: ${temporalAddress}`);

// This is a singleton instance of the client
export const client = new Client({
  address: temporalAddress,
  // namespace: 'default', // ensure this matches your Temporal server
});