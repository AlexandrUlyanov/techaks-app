# Tech Stack

Дата обновления: 2026-05-21  
Проект: Techaks

## Назначение

Этот документ фиксирует текущий технологический стек проекта:

- что используется на frontend;
- что используется на backend;
- на чём стоит БД и data layer;
- чем собирается и тестируется проект;
- какие внешние интеграции и инфраструктурные сервисы участвуют в runtime.

Это не marketing-описание, а живой reference для разработки, onboarding и operational-решений.

## 1. Базовая платформа

- `TypeScript`
- `Node.js`
- `ES Modules`

Проект работает как единый monorepo-style application:

- storefront;
- admin;
- API/server;
- DB migrations;
- sync/integration jobs.

## 2. Frontend

Основной frontend стек:

- `React 19`
- `React DOM 19`
- `React Router 7`
- `Vite 7`

### UI and styling

- `Tailwind CSS`
- `PostCSS`
- `Autoprefixer`
- `tailwindcss-animate`
- `tw-animate-css`

Конфиги:

- [tailwind.config.js](</E:/work/ru/tehax/s/app/tailwind.config.js>)
- [postcss.config.js](</E:/work/ru/tehax/s/app/postcss.config.js>)
- [vite.config.ts](</E:/work/ru/tehax/s/app/vite.config.ts>)

### UI primitives and component layer

Используются:

- `Radix UI`
- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `lucide-react`

Radix покрывает основные примитивы:

- accordion
- alert-dialog
- aspect-ratio
- avatar
- checkbox
- collapsible
- context-menu
- dialog
- dropdown-menu
- hover-card
- label
- menubar
- navigation-menu
- popover
- progress
- radio-group
- scroll-area
- select
- separator
- slider
- switch
- tabs
- toggle
- tooltip

### Theme and design system

Тема и runtime-дизайн-система построены на:

- `next-themes`
- CSS variables
- internal theme runtime bridge
- admin theme management UI

Сейчас поддерживаются отдельные bundle-темы:

- `siteLight`
- `siteDark`
- `admin`

### Forms

- `react-hook-form`
- `@hookform/resolvers`
- `zod`
- `input-otp`

### Client-side data and state

- `@tanstack/react-query`
- `tRPC React client`
- `Zustand`
- `SuperJSON`

## 3. Backend

Основной backend стек:

- `Hono`
- `@hono/node-server`
- `tRPC server`

Серверный entrypoint:

- [api/boot.ts](</E:/work/ru/tehax/s/app/api/boot.ts>)

Общий router:

- [api/router.ts](</E:/work/ru/tehax/s/app/api/router.ts>)

### API architecture

Основной API-слой построен как:

- Hono app
- tRPC procedures
- shared contracts / schemas
- server-side service modules в `api/lib/*`

### Auth and access control

- `jose`
- `bcryptjs`
- `@casl/ability`
- `@casl/react`

Это используется для:

- JWT/token logic;
- password/OTP flows;
- permissions and abilities;
- protected admin and customer routes.

## 4. Database and data layer

Основная БД:

- `MySQL`

Data stack:

- `mysql2`
- `Drizzle ORM`
- `drizzle-kit`

Конфиг:

- [drizzle.config.ts](</E:/work/ru/tehax/s/app/drizzle.config.ts>)

Схема и миграции:

- [db/schema.ts](</E:/work/ru/tehax/s/app/db/schema.ts>)
- [db/migrations](</E:/work/ru/tehax/s/app/db/migrations>)

## 5. Media and images

Для изображений и медиа используются:

- `sharp`
- local `public/images`
- generated product image variants

Сейчас проект умеет:

- хранить оригинал;
- генерировать `thumbnail`, `card`, `medium`;
- раздавать изображения локально через сервер;
- использовать fallback-изображения для товаров без фото.

## 6. Content, blog, and sanitization

Для контентных поверхностей используются:

- `sanitize-html`

Это покрывает:

- sanitization blog content;
- безопасный рендер HTML-контента;
- подготовку richer editorial surfaces.

## 7. Motion, interactive UI, and layout helpers

Используются:

- `gsap`
- `@gsap/react`
- `embla-carousel-react`
- `vaul`
- `react-resizable-panels`
- `react-day-picker`

Это покрывает:

- animations;
- carousels/sliders;
- drawers/sheets;
- date pickers;
- resizable panel surfaces.

## 8. Charts, tables, and admin visualization

Используются:

- `recharts`

Для spreadsheet/export use cases:

- `xlsx`

## 9. Notifications and communication

Используются:

- `sonner`
- `nodemailer`
- `web-push`

Это покрывает:

- toast notifications;
- outgoing email;
- push notifications.

## 10. HTTP, integrations, and sync

Для внешних интеграций используются:

- `axios`
- `axios-retry`

Главная внешняя бизнес-интеграция сейчас:

- `МойСклад`

В проекте также есть:

- sync jobs;
- reconciliation / watchdog flows;
- webhook processing;
- order sync and product sync layers.

## 11. Search and command-style UI

Используются:

- `cmdk`

## 12. Dates and formatting

В проекте присутствует:

- `date-fns`

Но часть пользовательских экранов уже переведена на нативные browser/platform formatters (`Intl`) там, где это даёт более стабильный runtime без лишней зависимости.

## 13. Testing

Используются:

- `Vitest`
- `jsdom`
- `Playwright`

Это покрывает:

- unit/integration tests;
- browser smoke checks;
- UI verification after deploy-sensitive changes.

## 14. Tooling and code quality

Используются:

- `TypeScript`
- `ESLint 9`
- `typescript-eslint`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `Prettier`

Конфиги:

- [eslint.config.js](</E:/work/ru/tehax/s/app/eslint.config.js>)
- [tsconfig.json](</E:/work/ru/tehax/s/app/tsconfig.json>)
- [tsconfig.app.json](</E:/work/ru/tehax/s/app/tsconfig.app.json>)
- [tsconfig.node.json](</E:/work/ru/tehax/s/app/tsconfig.node.json>)
- [tsconfig.server.json](</E:/work/ru/tehax/s/app/tsconfig.server.json>)
- [vitest.config.ts](</E:/work/ru/tehax/s/app/vitest.config.ts>)

## 15. Build and runtime

Build pipeline:

- frontend: `vite build`
- backend bundle: `esbuild`

Scripts:

- [package.json](</E:/work/ru/tehax/s/app/package.json>)

Основные команды:

- `npm run dev`
- `npm run build`
- `npm run check`
- `npm run test`
- `npm run db:generate`
- `npm run db:migrate`

## 16. Production infrastructure

Текущее production окружение:

- `Ubuntu 26.04 LTS`
- `2 vCPU`
- `2 GB RAM`
- `38 GB disk`
- `Nginx`
- `PM2`

Runtime model:

- Nginx работает как reverse proxy;
- Node app слушает локально;
- PM2 держит процесс приложения;
- статика и SPA routing обслуживаются через application server + Nginx.

## 17. External integrations and business surfaces

По текущему проекту используются или уже встроены:

- `МойСклад`
- email notifications
- push notifications
- Telegram contact surfaces / links
- blog/content system
- reviews/trust layer
- design system / theme management

## 18. Короткая версия stack summary

Если нужен самый короткий способ описать проект, Techaks сейчас стоит на:

`React + TypeScript + Vite + Tailwind + Radix + tRPC + Hono + MySQL + Drizzle + PM2 + Nginx`

## 19. Что считать source of truth

Если нужно проверить актуальное состояние зависимостей и runtime:

1. [package.json](</E:/work/ru/tehax/s/app/package.json>)
2. [api/boot.ts](</E:/work/ru/tehax/s/app/api/boot.ts>)
3. [db/schema.ts](</E:/work/ru/tehax/s/app/db/schema.ts>)
4. [vite.config.ts](</E:/work/ru/tehax/s/app/vite.config.ts>)
5. [project-current-status.md](</E:/work/ru/tehax/s/app/docs/project-current-status.md>)
