import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  // Create a NativeConnection to the Temporal service
  // This uses the environment variable and falls back to localhost
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_GRPC_ENDPOINT || '127.0.0.1:7233',
  });

  const worker = await Worker.create({
    connection, // Pass the NativeConnection here
    workflowsPath: require.resolve('./workflows'),
    activities,
    namespace: 'default',
    taskQueue: 'logistics-task-queue',
  });

  console.log('Worker started, listening on task queue: logistics-task-queue');
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
