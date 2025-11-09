# ResillientFlow - Polytope Migration

This project has been migrated from docker-compose to Polytope for better orchestration and development workflow.

## Architecture

The application consists of the following services:

### Infrastructure Services
- **Postgres** - Database for Temporal persistence
- **Temporal** - Workflow orchestration engine
- **Temporal UI** - Web interface for Temporal (accessible at http://localhost:8233)

### Application Services
- **Frontend** - Static web application served by Nginx (accessible at http://localhost:8080)
- **API** - Node.js/Express backend API (accessible at http://localhost:5000)
- **Worker** - Temporal worker for processing workflow tasks

## Getting Started

### Prerequisites
- Polytope CLI installed and configured
- Access to the Polytope runtime environment

### Running the Application

Start all services with the default tool:
```bash
polytope run default
```

Or start services individually:
```bash
# Start infrastructure
polytope run temporal
polytope run temporal-ui
polytope run postgres

# Start application services
polytope run frontend
polytope run api
polytope run worker
```

### Service Endpoints

- Frontend: http://localhost:8080
- API: http://localhost:5000
- Temporal UI: http://localhost:8233
- Temporal gRPC: localhost:7233
- Postgres: localhost:5432

## Project Structure

```
ResillientFlow/
├── polytope.yml              # Main Polytope configuration
├── modules/
│   ├── temporal/             # Temporal server configuration
│   │   └── polytope.yml
│   ├── postgres/             # PostgreSQL configuration
│   │   └── polytope.yml
│   ├── frontend/             # Frontend service module
│   │   └── polytope.yml
│   ├── api/                  # API service module
│   │   └── polytope.yml
│   └── worker/               # Worker service module
│       └── polytope.yml
├── frontend/                 # Frontend static files
│   ├── index.html
│   ├── style.css
│   └── scripts.js
└── mysterybox-backend/       # Backend Node.js application
    ├── src/
    ├── package.json
    └── tsconfig.json
```

## Development

### Making Changes

All services are configured with hot-reload capabilities:
- Frontend files are mounted directly from the `frontend/` directory
- Backend code is mounted from `mysterybox-backend/` directory

Changes to the code will be reflected automatically.

### Viewing Logs

Use Polytope CLI to view container logs:
```bash
# List running containers
polytope list containers

# View logs for a specific container
polytope logs <container-id>
```

### Debugging

Access the Temporal UI at http://localhost:8233 to monitor workflows and debug execution.

## Migration Notes

This project was migrated from docker-compose to Polytope:
- All service definitions have been converted to Polytope modules
- Service dependencies are properly configured
- Environment variables are preserved
- Port mappings remain the same for backward compatibility

## Advantages of Polytope

- Better dependency management between services
- Integrated development workflows
- Automatic service discovery
- Enhanced debugging and monitoring capabilities
- Simplified configuration management
