# CoDev OSRS Backend

NestJS API for the CoDev Office Supplies Request System. It provides Google Workspace sign-in, user and inventory management, and office-supply request workflows backed by PostgreSQL.

## Local Setup

Prerequisites: Node.js 24, npm, and Docker with Compose. A working Google OAuth client and SMTP account are needed to use sign-in and email notifications. The API verifies the SMTP connection during startup.

1. Install dependencies and create a local environment file:

```bash
npm install
cp .env.example .env
```

2. Edit `.env` with local PostgreSQL, Google OAuth, and SMTP settings. Keep credentials out of git.
3. Start PostgreSQL, apply migrations, and start the API:

```bash
docker compose up -d
npm run migration:run
npm run start:dev
```

The API listens on [http://localhost:3000](http://localhost:3000) by default. Swagger UI is served at `/` and is the interactive API reference. Schema synchronization is disabled; use migrations for database changes.

See [Architecture](docs/ARCHITECTURE.md), [Contributing](docs/CONTRIBUTING.md), [Deployment](docs/DEPLOYMENT.md), and [Integration](docs/INTEGRATION.md) for domain concepts, development workflow, production operations, and integration details.

## Common Commands

```bash
npm run start:dev       # Start the API in watch mode
npm run lint            # Lint source and tests
npm test                # Run unit tests
npm run test:e2e        # Run end-to-end tests
npm run test:cov        # Run tests with coverage
npm run build           # Compile for production
npm run migration:run   # Apply pending database migrations
```

The e2e suite imports the full application and requires a reachable PostgreSQL database and SMTP server. CI currently runs lint and build; it does not run the test suites.

## Deployment

See [Deployment](docs/DEPLOYMENT.md) for the CI pipeline, production environment, migrations, and release process.

## Local Services

Stop PostgreSQL with `docker compose down`. Its named volume keeps data between restarts. To delete the local database volume as well, run `docker compose down -v`.
