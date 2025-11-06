Phase 1: Project Setup & The "Happy Path"

Prompt 1: Project Setup "Help me set up a Python project using FastAPI and the Temporal SDK. First, what should I put in my requirements.txt file?"

(Wait for the AI to answer, then...)

Prompt 2: File Structure "Great. Now, create the basic project structure. Please create these empty files for me:

    activities.py (for our business logic)

    workflows.py (for our workflow definitions)

    shared.py (for shared constants)

    run_worker.py (to run the Temporal worker)

    server.py (to run the FastAPI server)"

Prompt 3: Shared Constant "In shared.py, I need to define our Temporal Task Queue name. Let's create one constant: LOGISTICS_TASK_QUEUE = 'logistics-queue'"

Prompt 4: Define "Happy Path" Activities "In activities.py, let's define our 'happy path' business logic. Please create three simple, async Python functions:

    process_payment(order_input: dict) -> str

    run_logistics_triage(order_input: dict) -> str

    send_order_confirmation_email(customer_info: dict) -> str

Import activity from temporalio.activity. Each function should be decorated with @activity.defn, print a log message, sleep for 1 second, and return a success string."

Prompt 5: Define "Happy Path" Workflow "Now, let's create the basic workflow in workflows.py.

    Import @workflow.defn, @workflow.run, and proxy_activity from temporalio.workflow.

    Import all activities from activities.py.

    Import LOGISTICS_TASK_QUEUE from shared.py.

    Define a class OrderWorkflow.

    Inside the class, define a run method: async def run(self, order_input: dict): and decorate it with @workflow.run.

    Inside run, use proxy_activity to call process_payment, run_logistics_triage, and send_order_confirmation_email in sequence. Use a start_to_close_timeout of 60 seconds."

Prompt 6: Create the Worker "Let's create the worker in run_worker.py. Write the async main function to:

    Import Worker and Client from temporalio.worker and temporalio.client.

    Import LOGISTICS_TASK_QUEUE from shared.py.

    Import the OrderWorkflow from workflows.py and all activities from activities.py.

    Connect to a local Temporal client.

    Create a Worker that listens on the LOGISTICS_TASK_QUEUE and registers the OrderWorkflow and all the imported activities.

    Call worker.run()."

Prompt 7: Create the FastAPI Server (Start Endpoint) "Now for the API in server.py. Create a FastAPI app.

    Import FastAPI, Client, and Pydantic's BaseModel.

    Import OrderWorkflow and LOGISTICS_TASK_QUEUE.

    Create a Pydantic model StartWorkflowRequest that just takes scenario: str and customerInfo: dict.

    Create a global client variable, and connect to Temporal in a @app.on_event('startup') async function.

    Create a POST /api/start_workflow endpoint that takes the StartWorkflowRequest body.

    Inside the endpoint, generate a unique workflow_id (like f'order-{uuid.uuid4().hex[:6]}').

    Use await client.start_workflow() to start the OrderWorkflow. Pass the task queue, workflow ID, and the request body's dict() as the argument.

    Return {'workflowId': workflow_id}."

Phase 2: Add Triage & Error Handling

Prompt 8: Add "Triage" Activities "Let's add the 'triage' activities to activities.py. Create these new async, @activity.defn functions:

    run_china_logistics(order_input: dict) -> str

    find_new_carrier(order_input: dict) -> str

    resume_shipping(new_carrier: str) -> str

    execute_alternative_route(decision: dict) -> str

Just add a time.sleep() and print statement to each for now."

Prompt 9: Update Worker with New Activities "In run_worker.py, we need to register all the new activities we just created. Update the Worker to include these new activities."

Prompt 10: Simulate Activity Failures "We need run_logistics_triage in activities.py to actually fail based on the scenario.

    Import ApplicationError from temporalio.activity.

    Inside run_logistics_triage, get the scenario from the order_input.

    If scenario == 'ESTONIA_FAIL_REROUTE', raise ApplicationError('Stock in Estonia failed.', type='StockUnavailableError', non_retryable=True).

    If scenario == 'CARRIER_BANKRUPTCY', raise ApplicationError('Carrier bankrupt.', type='CarrierBankruptError', non_retryable=True).

    If scenario == 'CHINA_CRISIS_FAIL', raise ApplicationError('Geopolitical crisis.', type='GeopoliticalError', non_retryable=True).

    Otherwise, just return 'Logistics OK'."

Prompt 11: Add Triage Logic (Level 2 - Auto) "Time to build the Triage logic in workflows.py.

    Inside the run method of OrderWorkflow, wrap the call to run_logistics_triage in a try...except block.

    Import ApplicationError from temporalio.exceptions.

    In the except ApplicationError as e: block:

        Check if e.type == 'StockUnavailableError'. If it matches, log a warning and then await a call to the run_china_logistics activity.

        Add an elif e.type == 'CarrierBankruptError'. If it matches, await find_new_carrier and then await resume_shipping with the result."

Prompt 12: Add Triage Logic (Level 3 - Human) "Let's add the 'Human-in-the-Loop' logic to workflows.py.

    In OrderWorkflow, add a @workflow.query handler named get_status. Initialize a self._status dict in __init__.

    Update self._status with {'currentStep': 'PaymentOK', ...} before each activity call.

    In the try...except block, add an elif e.type == 'GeopoliticalError':

        Set self._status['humanInterventionState'] = {'showModal': True, 'message': '...'}.

        Use decision = await workflow.wait_for_signal('resolveCrisis') to pause the workflow.

        After receiving the signal, set self._status['humanInterventionState']['showModal'] = False.

        Finally, await the execute_alternative_route activity, passing in the decision payload."

Phase 3: Connect Frontend Polling & Signaling

Prompt 13: Add Status Endpoint (Query) "Back to server.py. We need an endpoint for the frontend to poll for status.

    Create a GET /api/workflow_status/{workflow_id} endpoint.

    Inside, get the workflow handle: handle = client.get_workflow_handle(workflow_id).

    Call status_data = await handle.query('get_status').

    Also, get the workflow description: desc = await handle.describe() and check desc.status.

    Return a JSON combining status_data and the overall status.name (e.g., 'RUNNING', 'COMPLETED')."

Prompt 14: Add Signal Endpoint "We need to handle the modal's 'Confirm' button. In server.py:

    Create a Pydantic model SignalRequest that takes signalName: str and payload: dict.

    Create a POST /api/signal_workflow/{workflow_id} endpoint that accepts this SignalRequest.

    Inside, get the handle for the workflow_id.

    Use await handle.signal(body.signalName, body.payload).

    Return a success message."

Prompt 15: Add Stock Status (Singleton Workflow) "Last part: the stock widget.

    In workflows.py, create a new class StockWorkflow.

    In its @workflow.run method, create a while True: loop.

    Inside the loop, update a self._stock dict with random values for stockLevel and demandStatus.

    Then, await workflow.sleep(timedelta(seconds=5)).

    Add a @workflow.query handler get_stock_status that returns self._stock."

Prompt 16: Add Stock Worker & Server Code "Final steps:

    In run_worker.py, register the new StockWorkflow with the worker.

    In server.py, in the startup event, try to await client.start_workflow for the StockWorkflow. Use a fixed id='global-stock-workflow' and task_queue=LOGISTICS_TASK_QUEUE. except a WorkflowExecutionAlreadyStartedError.

    In server.py, create a GET /api/stock_status endpoint. Inside, get the handle for 'global-stock-workflow', query it for get_stock_status, and return the data."

    ## 🏗️ System Architecture

### __1. Database Design (Couchbase)__

__Collections:__

- `shipments` - Main shipment documents
- `issues` - Issue tracking documents
- `events` - Event log for real-time updates

__Shipment Document Schema:__

```json
{
  "id": "SHIP-2025-001",
  "tracking_number": "CN-SE-123456",
  "supplier": {
    "name": "Shanghai Electronics",
    "location": "China",
    "contact": "supplier@example.com"
  },
  "destination": {
    "country": "Sweden",
    "city": "Stockholm",
    "address": "..."
  },
  "status": "in_transit|customs|delivered|delayed",
  "customs_status": "pending|cleared|hold",
  "current_location": "Shanghai Port",
  "timeline": [
    {"stage": "picked_up", "timestamp": "...", "location": "..."},
    {"stage": "customs", "timestamp": "...", "location": "..."}
  ],
  "has_issues": false,
  "created_at": "2025-01-06T10:00:00Z",
  "estimated_delivery": "2025-01-15T10:00:00Z"
}
```

### __2. Backend API (FastAPI)__

__Key Endpoints:__

- `POST /shipments` - Create new shipment (triggers Temporal workflow)
- `GET /shipments` - List all shipments with filtering
- `GET /shipments/{id}` - Get shipment details
- `GET /shipments/{id}/events` - Get real-time event stream (SSE/WebSocket)
- `GET /issues` - List all issues
- `POST /issues/{id}/resolve` - Human decision on issue resolution
- `GET /dashboard/stats` - Dashboard statistics

### __3. Temporal Workflows__

__Main Workflows:__

__A. ShipmentTrackingWorkflow__

- Duration: Simulated ~2-3 minutes for China → Sweden demo

- Activities:

  1. `pickup_from_supplier` (10 seconds)
  2. `transit_to_port` (20 seconds)
  3. `departure_from_china` (15 seconds)
  4. `in_transit_to_sweden` (30 seconds)
  5. `arrival_in_sweden` (15 seconds)
  6. `customs_processing` (30 seconds) ← Issues may trigger here
  7. `final_delivery` (20 seconds)

- After each activity, emit events to Couchbase for real-time updates

- Random issue injection (50% chance) at customs stage

__B. IssueResolutionWorkflow__

- Triggered when issue detected

- Sends signal to pause main workflow

- Creates issue document with options:

  - __Option 1__: Pay €500 extra for express customs (2-hour wait)
  - __Option 2__: Standard resolution (24-hour wait)
  - __Option 3__: Cancel and order from EU supplier

- Wait for human decision with timeout (5 minutes for demo)

- If no response → Escalation workflow triggers

- Resume main workflow based on decision

__C. EscalationWorkflow__

- Triggered if human doesn't respond within timeout
- Sends high-priority notification
- Extends timeout by 3 minutes
- After second timeout, auto-selects standard resolution

### __4. Frontend (React + shadcn/ui)__

__Pages & Components:__

__Dashboard Page (`/`)__

- Overview cards: Total shipments, In Transit, Issues, Delivered
- Active shipments table with real-time status updates
- Issue alerts prominently displayed

__Shipment Detail Page (`/shipments/:id`)__

- Visual timeline showing shipment progress
- Current location map/indicator
- Event log table
- Issue resolution panel (when issues exist)

__Key Components:__

- `ShipmentTimeline` - Visual progress tracker
- `IssueResolutionDialog` - Modal for human decision with 3 options
- `RealtimeStatusBadge` - Live updating status indicator
- `EventStream` - Real-time event feed using SSE
- `StatCard` - Dashboard statistics cards

### __5. Demo Features__

__Simulated Issues (Random Injection):__

1. __Customs Hold__ - Missing documentation (40% chance)
2. __Shipment Delay__ - Weather/logistics issue (30% chance)
3. __Documentation Issue__ - Incorrect paperwork (30% chance)

__Fast Demo Mode:__

- Total demo time: 2-3 minutes per shipment
- Visual updates every 10-20 seconds
- Issues trigger at ~60 seconds mark
- Real-time UI updates show progress smoothly

## 📋 Implementation Plan

### __Phase 1: Infrastructure Setup__

1. Initialize Couchbase database
2. Initialize Temporal server + UI
3. Create FastAPI backend service
4. Create React frontend service
5. Set up development environment with hot reload

### __Phase 2: Backend Development__

1. Create SQLModel/Pydantic models for shipments and issues
2. Implement Couchbase repositories
3. Build FastAPI endpoints
4. Add Server-Sent Events (SSE) for real-time updates
5. Create Temporal activities for each shipment stage

### __Phase 3: Temporal Workflows__

1. Implement ShipmentTrackingWorkflow with timed activities
2. Add random issue injection logic
3. Create IssueResolutionWorkflow with human-in-the-loop
4. Build EscalationWorkflow with timeouts
5. Test workflow interactions

### __Phase 4: Frontend Development__

1. Set up React Router with dashboard and detail pages
2. Create layout with shadcn/ui components
3. Build dashboard with statistics cards
4. Implement shipment list with real-time updates
5. Create detailed timeline component
6. Build issue resolution dialog with 3-option buttons
7. Connect to backend API and SSE stream

### __Phase 5: Integration & Testing__

1. Test end-to-end shipment flow
2. Verify issue detection and resolution
3. Test escalation workflow
4. Ensure real-time updates work smoothly
5. Polish UI/UX for demo presentation

### __Phase 6: Demo Preparation__

1. Add seed data functionality
2. Create demo script/scenarios
3. Add "Create Demo Shipment" button
4. Optimize timing for presentation

## 🎯 Key Demo Scenarios

1. __Happy Path__: Shipment completes without issues in ~2 minutes
2. __Issue Resolution - Quick__: Issue detected → Human selects express option → Completed
3. __Issue Resolution - Standard__: Issue detected → Human selects standard option → Delayed delivery
4. __Escalation__: Issue detected → No response → Escalation → Auto-resolved

---
