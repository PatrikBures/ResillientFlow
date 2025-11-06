import express from 'express';
import cors from 'cors';
import { Client } from '@temporalio/client';
import { mysteryBoxWorkflow } from './workflows.js'; // We import the workflow *type*
import { nanoid } from 'nanoid';

const app = express();
const port = 3030; // Matches your frontend's API_BASE_URL

app.use(cors());
app.use(express.json());

// Create a Temporal Client
const client = new Client();

// === API ENDPOINTS ===

/**
 * Health check
 */
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Mysterybox API is running' });
});


/**
 * POST /start-workflow
 * Starts a new mystery box workflow.
 */
app.post('/start-workflow', async (req, res) => {
  const { customerName, scenario } = req.body;

  if (!customerName || !scenario) {
    return res.status(400).json({ error: 'customerName and scenario are required.' });
  }

  // Generate a unique, human-readable workflow ID
  const workflowId = `order-${nanoid(6)}`;

  try {
    // Start the workflow
    await client.workflow.start(mysteryBoxWorkflow, {
      taskQueue: 'mystery-box-queue',
      workflowId: workflowId,
      args: [customerName, scenario], // Pass args to the workflow function
    });

    console.log(`Started workflow: ${workflowId}`);
    res.json({ workflowId: workflowId });

  } catch (err) {
    console.error('Failed to start workflow:', err);
    res.status(500).json({ error: 'Failed to start workflow.' });
  }
});

/**
 * GET /workflow-status/:workflowId
 * Polls the workflow for its current state.
 *
 * --- THIS ENDPOINT IS NOW MUCH MORE ROBUST ---
 *
 */
app.get('/workflow-status/:workflowId', async (req, res) => {
  const { workflowId } = req.params;

  try {
    const handle = client.workflow.getHandle(workflowId);
    let description;

    try {
      // describe() is a lightweight call to check the workflow's status
      description = await handle.describe();
    } catch (err) {
      // This happens if the workflow is not found (e.g., still starting up)
      console.warn(`Workflow ${workflowId} not found, likely starting up.`);
      // Send a "pending" state so the frontend waits gracefully
      return res.json({
        workflowId: workflowId,
        currentStep: 'OrderReceived', // The "starting" step
        workflowExists: false
      });
    }

    // Workflow exists, let's check its status
    const status = description.status.name;

    if (status === 'RUNNING') {
      // The workflow is running! This is the happy path.
      // We can safely query its internal state.
      const state = await handle.query('getStatus');
      state.workflowId = workflowId;
      return res.json(state);
    } else {
      // The workflow is NOT running. It's COMPLETED, FAILED, TIMED_OUT, etc.
      // We can't query it, but we can report its final state.
      console.warn(`Workflow ${workflowId} is not RUNNING. Status: ${status}`);

      let finalState = {
        workflowId: workflowId,
        currentStep: 'Failed', // Assume failed unless completed
        workflowFailed: true,
        failureMessage: 'Workflow ended unexpectedly',
        workflowComplete: false,
      };

      if (status === 'COMPLETED') {
        finalState.currentStep = 'Delivered';
        finalState.workflowFailed = false;
        finalState.workflowComplete = true;
      } else if (description.result && description.result.failure) {
        // Try to get the specific failure message
        finalState.failureMessage = description.result.failure.message || 'Workflow failed';
      }
      
      return res.json(finalState);
    }

  } catch (err) {
    // This is a catch-all for any other unexpected errors
    console.error(`Generic error polling ${workflowId}:`, err.message);
    res.status(500).json({ error: 'Failed to query workflow status.' });
  }
});


/**
 * POST /submit-intervention
 * Sends a Signal to the workflow to resolve a human intervention.
 */
app.post('/submit-intervention', async (req, res) => {
  const { workflowId, solution } = req.body;

  if (!workflowId || !solution) {
    return res.status(400).json({ error: 'workflowId and solution are required.' });
  }

  try {
    const handle = client.workflow.getHandle(workflowId);

    // Signal the workflow
    // 'resolveIntervention' matches the signal name in workflows.js
    await handle.signal('resolveIntervention', solution);

    console.log(`Intervention submitted for ${workflowId}: ${solution}`);
    res.json({ status: 'ok' });

  } catch (err) {
    console.error(`Failed to submit intervention for ${workflowId}:`, err);
    res.status(500).json({ error: 'Failed to signal workflow.' });
  }
});


app.listen(port, () => {
  console.log(`Backend API server listening at http://localhost:${port}`);
});