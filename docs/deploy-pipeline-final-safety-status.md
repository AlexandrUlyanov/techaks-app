# Deploy Pipeline Final Safety Status

Дата фиксации: 2026-05-16  
Окружение: production  
Проект: TechAks

## Итог

Deploy pipeline находится в безопасном состоянии для обычного code rollout.

Подтверждено:

- push в `master` больше не должен автоматически менять production-БД;
- обычный deploy выполняет только code rollout;
- DB-операции вынесены из автоматического flow;
- production app после обычного deploy поднимается через `pm2 restart techaks` и healthcheck.

## Что делает обычный deploy

Current automatic deploy:

- checkout / sync code;
- install dependencies;
- build;
- deploy application files on server;
- update nginx config;
- restart PM2 process `techaks`;
- run healthcheck.

## Что обычный deploy больше НЕ делает

Из automatic deploy flow убрано:

- `npm run db:push`
- `drizzle-kit push`
- автоматические migrations
- inline SQL (`ALTER`, `UPDATE`, `INSERT`, `DELETE`)
- schema sync
- automatic backfill
- ручные data-fix sequences

## Manual DB workflow

Для production DB operations используется отдельный manual workflow:

- [/.github/workflows/db-maintenance.yml](</E:/work/ru/tehax/s/app/.github/workflows/db-maintenance.yml>)

Он:

- не запускается автоматически;
- требует explicit confirmation phrase;
- по умолчанию не содержит автоматического schema-изменения.

## Почему это важно

Это особенно критично для TechAks после нескольких controlled DB rollout-фаз:

- Orders Phase 3 / 3.1;
- product visibility schema rollout;
- product visibility controlled backfill.

Обычный code deploy не должен повторно вмешиваться в production schema или данные после таких ручных фаз.

## Что подтверждено практикой

Подтверждено после реальных push/deploy:

- pages отвечают `200`;
- `pm2` успешно перезапускается;
- healthcheck проходит;
- обычный deploy не выполняет автоматические DB mutations.

## Operational rule

Правило на будущее:

> приложение деплоится автоматически, БД меняется только отдельно и осознанно.

## Что НЕ делалось в рамках обычного deploy

- production-БД не менялась автоматически;
- `db:push` не запускался;
- migrations автоматически не запускались;
- backfill автоматически не запускался;
- destructive DB changes не выполнялись.
