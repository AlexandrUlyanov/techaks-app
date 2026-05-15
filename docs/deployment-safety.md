# Deployment Safety

## Principle

Regular application deploys must not mutate the production database.

Code deploy and database maintenance are separate operational tracks:

- regular deploy: code only;
- database changes: manual, reviewed, backed up, and explicitly approved.

## Current rule set

1. Automatic deploy on push to `master` must not run:
   - `npm run db:push`
   - `drizzle-kit push`
   - `drizzle-kit migrate`
   - inline `ALTER TABLE`
   - inline `INSERT`, `UPDATE`, `DELETE`
   - backfill scripts
   - ad hoc production SQL

2. Any production DB operation requires:
   - a fresh backup;
   - an explicit rollout plan;
   - a manual trigger;
   - post-change validation;
   - a documented result.

3. `db:push --force` is not allowed as part of normal production deploy.

## Why this matters for TechAks

Phase 3.1 for orders schema compatibility was already applied manually on production.
Repeating schema sync automatically is undesirable because:

- production may already be ahead of repository artifacts in a controlled way;
- repeated `db:push --force` can apply unintended schema drift;
- inline SQL in deploy workflows is hard to audit and easy to rerun accidentally.

## Safe production model

### Automatic deploy

Allowed:

- checkout
- install dependencies
- build
- upload/sync code
- restart PM2
- healthcheck

Not allowed:

- schema sync
- migrations
- backfill
- store data mutation
- user/admin data mutation

### Manual DB maintenance

Any DB operation must go through a separate manual workflow and must be reviewed case by case.
If a workflow touches production DB, it must require an explicit confirmation phrase and should default to doing nothing.

## Orders-specific note

Orders Phase 3.1 already completed manually on production:

- additive schema only;
- no destructive migrations;
- no backfill;
- compatibility mode remains enabled.

Because of that, a normal Git sync must not rerun schema operations automatically.
