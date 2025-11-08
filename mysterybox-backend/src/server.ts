import express from 'express';
import cors from 'cors';
// 1. IMPORT THE PROMISE (and Client type for safety)
import { clientPromise } from './client';
import { Client } from '@temporalio/client';
import { logisticsWorkflow } from './workflows';
import { labDecisionSignal, crisisDecisionSignal, statusQuery } from './shared';

const PORT = 5000;

// 2. WRAP THE ENTIRE SERVER IN AN ASYNC FUNCTION
async function runServer() {
  // Get the resolved client from the promise
  const client: Client = await clientPromise;

  const app = express();
  app.use(express.json());
  app.use(cors()); // Allow all cross-origin requests

  // --- ALL YOUR API HANDLERS BELOW ARE UNCHANGED ---
  
  // 1. Start a new workflow
  app.post('/api/start-workflow', async (req, res) => {
    const { scenario } = req.body;
    if (!scenario) {
      return res.status(400).json({ error: 'Scenario is required' });
    }

    try {
      const handle = await client.workflow.start(logisticsWorkflow, {
        taskQueue: 'logistics-task-queue',
        workflowId: `logistics-${Date.now()}`, // Create a unique workflow ID
        args: [scenario],
      });

      console.log(`Started workflow: ${handle.workflowId}`);
      res.json({ workflowId: handle.workflowId });
    } catch (err) {
      console.error('Failed to start workflow', err);
      res.status(500).json({ error: 'Failed to start workflow' });
    }
  });

  // 2. Send the "Lab Decision" Signal
  app.post('/api/signal/lab/:workflowId', async (req, res) => {
    const { workflowId } = req.params;
    const decisionData = req.body; // { choice, cost, delayWeeks, risk }

    try {
      const handle = client.workflow.getHandle(workflowId);
      await handle.signal(labDecisionSignal, decisionData);
      res.json({ success: true, message: `Signal 'labDecision' sent to ${workflowId}` });
    } catch (err) {
      console.error('Failed to send signal', err);
      res.status(500).json({ error: 'Failed to send signal' });
    }
  });

  // 3. Send the "Crisis Decision" Signal
  app.post('/api/signal/crisis/:workflowId', async (req, res) => {
    const { workflowId } = req.params;
    const decisionData = req.body; // { choice, cost, days }

    try {
      const handle = client.workflow.getHandle(workflowId);
      await handle.signal(crisisDecisionSignal, decisionData);
      res.json({ success: true, message: `Signal 'crisisDecision' sent to ${workflowId}` });
    } catch (err) {
      console.error('Failed to send signal', err);
      res.status(500).json({ error: 'Failed to send signal' });
    }
  });

  // 4. Query the workflow status (for polling)
  app.get('/api/status/:workflowId', async (req, res) => {
    const { workflowId } = req.params;
    try {
      const handle = client.workflow.getHandle(workflowId);
      const status = await handle.query(statusQuery);
      res.json({ status });
    } catch (err) {
      // If query fails, workflow might be completed or failed
      try {
        const description = await client.workflow.getHandle(workflowId).describe();
        res.json({ status: description.status.name });
      } catch (descErr) {
        console.error('Failed to query/describe workflow', descErr);
        res.status(500).json({ error: 'Failed to get workflow status' });
      }
    }
  });

  // --- END OF HANDLERS ---

  // 3. START THE SERVER (moved inside the async function)
  app.listen(PORT, () => {
    console.log(`API server listening on http://localhost:${PORT}`);
  });
}

// 4. CALL THE ASYNC FUNCTION (just like in worker.ts)
runServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
