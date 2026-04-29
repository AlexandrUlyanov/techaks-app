# Context for AI Agents (GEMINI.md)

## Project Overview
**ТЕХАКС** — это интернет-магазин техники и аксессуаров в Пензе. 
- **Business Logic:** Продажа товаров, управление акциями, сбор лидов (заявок), информация о магазинах.
- **Environment:** Node.js (Runtime), Cloud Run (Deployment).

## Tech Stack
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui.
- **Backend:** Hono (Web Framework), tRPC (Type-safe API).
- **Database:** MySQL, Drizzle ORM.
- **State Management:** TanStack Query (via tRPC).

## Critical Architectural Rules
1. **API:** Почти всё взаимодействие идет через tRPC. Основной роутер: `api/router.ts`. 
2. **REST Endpoints:** Только для специфических задач (например, `POST /api/upload` для файлов в `api/boot.ts`).
3. **Database:** Схема в `db/schema.ts`. Миграции генерируются через `drizzle-kit`.
4. **File Storage:** Эфемерное хранилище. Файлы в `dist/public/images` (prod) или `public/images` (dev). При деплое загруженные файлы теряются.
5. **Styles:** Используется Vanilla CSS + Tailwind. Основные цвета: `#00bcd4` (Cyan), `#003238` (Dark Green).

## Database Entities
- `products`: Товары (цена, старая цена, badge "Акция", характеристики в JSON).
- `categories`: Категории товаров.
- `banners`: Акции/баннеры (slug, title, content, image, link).
- `leads`: Заявки (имя, телефон, тип, статус).
- `stores`: Магазины (адрес, время работы, рейтинг).

## Key Paths
- `app/src/pages/admin`: Админ-панель.
- `app/api/routers`: Логика tRPC (Banner, Product, Lead, Store).
- `app/src/pages/PromotionsPage.tsx`: Список акций.
- `app/src/pages/PromotionDetailPage.tsx`: Детальная страница акции.

## Common Tasks & Gotchas
- **Adding a page:** Add route in `App.tsx`, create component in `src/pages`.
- **Modifying Schema:** Edit `db/schema.ts`, run `npm run db:generate`, then `npm run db:push` (or migrate).
- **Navigation:** Header/Footer use `Link` from `react-router`. Ссылки на акции должны быть `/promotions/${slug}`.
