# TechAks E-commerce Platform

TechAks is an internet store built with React, Vite, Hono, tRPC, and Drizzle ORM.  
The project includes:

- a public storefront;
- an admin panel;
- MoySklad synchronization;
- order management with compatibility support for legacy data;
- product visibility controls for zero-price and invalid-price products;
- a safe deploy pipeline where regular deploys do not mutate production DB.

## Project status

Current operational entrypoint:

- [docs/operations-index.md](</E:/work/ru/tehax/s/app/docs/operations-index.md>)

Current project snapshot:

- production app deploy is code-only by default;
- production DB changes are handled only through separate controlled procedures;
- orders additive rollout is complete and compatibility mode remains enabled;
- product visibility protection for zero-price products is implemented in code and in production data;
- `npm run check`, `npm run build`, and `npm test` currently pass locally.

## Stack

### Frontend

- React 19
- React Router v7
- Vite
- Tailwind CSS
- Radix UI
- Zustand
- TanStack Query via tRPC

### Backend

- Hono
- tRPC
- Node.js
- MySQL / MariaDB-compatible DB
- Drizzle ORM

## Main scripts

```bash
npm run dev
npm run build
npm run start
npm run check
npm run test
npm run lint
```

Database-related scripts exist, but must be treated carefully:

```bash
npm run db:generate
npm run db:migrate
npm run db:push
```

Important:

- `db:push` is a dangerous schema-sync tool and must not be used casually against production;
- production DB work should be done only through reviewed, explicit rollout steps.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create `.env` in the project root:

```env
DATABASE_URL="mysql://root:root@localhost:3306/tehax"
PORT=3000
NODE_ENV=development
```

3. Make sure local MySQL is available and the target DB exists.

4. If you really need schema sync locally, do it intentionally:

```bash
npm run db:push
```

5. Start dev server:

```bash
npm run dev
```

App URL:

- [http://localhost:3000](http://localhost:3000)

## Production deploy

Automatic deploy is handled by:

- [/.github/workflows/deploy.yml](</E:/work/ru/tehax/s/app/.github/workflows/deploy.yml>)

Regular deploy on push to `master` does:

- checkout / sync code;
- install dependencies;
- build;
- update nginx config;
- restart PM2 process `techaks`;
- run healthcheck.

Regular deploy does **not** do:

- `db:push`
- automatic migrations
- inline SQL
- backfill
- schema sync

DB operations are separated into a manual workflow:

- [/.github/workflows/db-maintenance.yml](</E:/work/ru/tehax/s/app/.github/workflows/db-maintenance.yml>)

Deployment safety reference:

- [docs/deployment-safety.md](</E:/work/ru/tehax/s/app/docs/deployment-safety.md>)
- [docs/deploy-pipeline-final-safety-status.md](</E:/work/ru/tehax/s/app/docs/deploy-pipeline-final-safety-status.md>)

## Orders

Orders are one of the most operationally sensitive areas of the project.

Current references:

- [docs/orders-phase3-final-production-status.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-final-production-status.md>)
- [docs/orders-phase3-1-followup-result.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-1-followup-result.md>)
- [docs/orders-documents-status.md](</E:/work/ru/tehax/s/app/docs/orders-documents-status.md>)

Important:

- compatibility mode is still part of the production architecture;
- historical rollout docs are preserved and must be read as point-in-time reports;
- do not treat every old order doc as current operational state.

## Product visibility

The storefront now hides products that should not be sold publicly.

Public visibility rule:

```txt
visibleOnSite = isActive && !isAutoBlocked && price > 0
```

Meaning:

- `isActive` is a manual admin decision;
- `isAutoBlocked` is a system safeguard;
- zero-price / invalid-price products stay visible in admin, but are hidden from the public site and blocked from checkout.

References:

- [docs/product-visibility-final-production-status.md](</E:/work/ru/tehax/s/app/docs/product-visibility-final-production-status.md>)
- [docs/product-visibility-backfill-plan.md](</E:/work/ru/tehax/s/app/docs/product-visibility-backfill-plan.md>)

## Admin and sync

Admin operational notes:

- [docs/admin-operations.md](</E:/work/ru/tehax/s/app/docs/admin-operations.md>)

Other reference docs:

- [docs/product-spec-normalization.md](</E:/work/ru/tehax/s/app/docs/product-spec-normalization.md>)
- [docs/sync-epic-plan.md](</E:/work/ru/tehax/s/app/docs/sync-epic-plan.md>)

## Important safety rules

Do not do the following without an explicit rollout decision:

- destructive migrations;
- dropping production tables or columns;
- changing column types on live production tables;
- running bulk backfill as part of normal deploy;
- using `db:push --force` against production as a convenience shortcut;
- mixing app deploy with DB maintenance in one unreviewed step.
