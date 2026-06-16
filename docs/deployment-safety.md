# Deployment Safety

Дата обновления: 2026-05-16  
Проект: TechAks

## Принцип

Обычный deploy приложения не должен менять production-БД.

Для проекта действуют два разных operational track:

1. code deploy;
2. DB maintenance.

Они не должны смешиваться в одном автоматическом шаге.

## Текущая безопасная модель

### Regular deploy

Обычный deploy на push в `master` должен делать только:

- получить код;
- обновить рабочую копию на сервере;
- установить зависимости;
- собрать приложение;
- обновить nginx config;
- перезапустить PM2 process `techaks`;
- выполнить healthcheck.

### Regular deploy не должен делать

Запрещено в обычном deploy:

- `npm run db:push`
- `drizzle-kit push`
- `drizzle-kit migrate`
- inline SQL (`ALTER`, `INSERT`, `UPDATE`, `DELETE`)
- schema sync
- backfill
- ручные data-fix скрипты

## Что это значит practically

Если меняется только код:

- достаточно обычного push/deploy.

Если меняется production-БД:

- нужен отдельный rollout;
- нужен backup;
- нужен preflight;
- нужен post-check;
- нужен документированный результат.

## Почему это важно именно для TechAks

В проекте уже были ручные controlled rollout-фазы:

- additive rollout по `Orders`;
- follow-up Phase 3.1;
- product visibility schema rollout;
- product visibility controlled backfill.

Повторный автоматический schema sync поверх production здесь опасен, потому что:

- production уже менялся контролируемыми отдельными шагами;
- repo history и production schema могут расходиться по времени применения;
- `db:push --force` может повторно применить нежелательные изменения.

## Workflow model

### Automatic deploy

Используется:

- [/.github/workflows/deploy.yml](</E:/work/ru/tehax/s/app/.github/workflows/deploy.yml>)

Этот workflow должен оставаться code-only.

### Manual DB maintenance

Используется:

- [/.github/workflows/db-maintenance.yml](</E:/work/ru/tehax/s/app/.github/workflows/db-maintenance.yml>)

Он:

- запускается только вручную;
- требует explicit confirmation;
- по умолчанию не делает DB-операций автоматически.

## Обязательные правила перед production DB operation

Перед любой production DB change:

1. сделать backup;
2. подтвердить target DB;
3. выполнить read-only sanity check;
4. применить только согласованный SQL/rollout;
5. сделать post-validation;
6. зафиксировать результат документом.

## Что уже подтверждено

Подтверждено operationally:

- обычный push/deploy больше не должен автоматически мутировать production-БД;
- Phase 3.1 по orders был применён вручную и не должен повторяться автоматикой;
- product visibility backfill тоже выполнялся отдельно, не как часть deploy.

## Что запрещено без отдельного решения

- `db:push --force` против production;
- destructive migrations;
- drop колонок/таблиц;
- bulk backfill как часть обычного deploy;
- inline SQL inside deploy workflow;
- отключение compatibility mode как “побочный эффект” deploy.
