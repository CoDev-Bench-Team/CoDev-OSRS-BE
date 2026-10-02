# Contributing

## Branches and Pull Requests

Work from an up-to-date `main` branch on a short-lived feature branch named for the Linear ticket, for example `ABC-123`. Open a pull request targeting `main` with a title in the form `ABC-123 - Add user search`. Describe the behavior and implementation in the pull request body. A different developer reviews and approves it before merge. The full release and deployment flow is in [Deployment](DEPLOYMENT.md).

## Before You Start

Follow the [README local setup](README.md#local-setup). The application needs PostgreSQL and a reachable SMTP server during startup. Tests that import `AppModule` also initialize those providers, so configure them for the test environment as well.

## Tests and Checks

Run the relevant checks before requesting review:

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

`npm test` runs Vitest unit tests matching `*.spec.ts`; `npm run test:e2e` runs files matching `*.e2e-spec.ts`. The e2e configuration imports the full application and can require local PostgreSQL and SMTP. CI currently enforces lint and build only; unit and e2e tests are not enabled in the workflow.

The current e2e spec expects `GET /` to return `Hello World!`, while the application now serves Swagger UI at `/`. Treat a failure at that assertion as a stale test expectation, not as the intended API root response; update the test when changing the root route contract.

## Database Changes

Keep TypeORM `synchronize` disabled. Add a TypeORM migration under `src/migrations/`, following the existing migration naming and class conventions, and review its SQL and rollback behavior. Apply it locally with:

```bash
npm run migration:run
```

`npm run migration:revert` reverts the latest applied migration. Do not use `migration:drop` or `migration:reset` against a database whose data matters; these commands remove schema or migration files.

## Implementation Conventions

- Keep feature code in its module: controller, service, DTOs, and entities.
- Validate incoming data with DTO decorators and document API behavior with Swagger decorators.
- Keep authorization explicit with the existing `@Public()` and `@Roles()` decorators.
- Preserve the existing problem-details error response contract.
- Update or add focused tests when behavior changes, especially for authorization and request status transitions.
- Never commit `.env` files, credentials, or production data.
