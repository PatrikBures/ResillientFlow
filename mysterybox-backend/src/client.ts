import { Client, Connection } from '@temporalio/client';

// Read the address from an environment variable
const temporalAddress = process.env.TEMPORAL_GRPC_ENDPOINT || 'localhost:7233';

console.log(`[Temporal Client] Connecting to Temporal at: ${temporalAddress}`);

// This function creates and returns a promise that resolves to the client
async function createClient(): Promise<Client> {
  const connection = await Connection.connect({
    address: temporalAddress,
  });

  const client = new Client({
    connection,
    namespace: 'default',
  });

  console.log('[Temporal Client] Connection established.');
  return client;
}

// Export the promise
export const clientPromise = createClient();
