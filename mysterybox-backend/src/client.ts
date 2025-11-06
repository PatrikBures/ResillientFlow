import { Client } from '@temporalio/client';

// This is a singleton instance of the client
export const client = new Client({
  // namespace: 'default', // ensure this matches your Temporal server
  // address: 'localhost:7233', // ensure this matches your Temporal server
});