import { Worker } from '@temporalio/worker';
import * as activities from './activities.js';
import { fileURLToPath } from 'url';

async function run() {
  // Create a new Worker
  const worker = await Worker.create({
    // Point to the workflows file
    workflowsPath: fileURLToPath(new URL('./workflows.js', import.meta.url)),
    // List all the activities
    activities,
    // Define the task queue this Worker will listen on
    taskQueue: 'mystery-box-queue',
  });

  console.log('Worker started. Listening on task queue: mystery-box-queue');
  
  // Start the Worker. This is a long-running process.
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});