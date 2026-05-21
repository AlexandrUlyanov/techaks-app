# Project Current Status

Дата обновления: 2026-05-21  
Проект: TechAks

## Коротко

Сейчас проект находится в рабочем production-состоянии:

- обычный deploy безопасен и не должен менять production-БД;
- раздел `Заказы` работает на новой additive-схеме с сохранённым compatibility mode;
- тестовые заказы и тестовые customer-пользователи в production очищены;
- product visibility для zero-price / invalid-price товаров внедрён и подтверждён на production;
- локальные инженерные проверки `check`, `build`, `test` проходят.

## Production app

- основной домен: [https://techaks.ru](https://techaks.ru)
- PM2 process: `techaks`
- reverse proxy: nginx
- app runtime: `dist/boot.js`

## Production server

Актуальная production-конфигурация после расширения тарифа:

- `2 vCPU`
- `2 GB RAM`
- `38 GB disk`
- Ubuntu 26.04 LTS
- виртуализация: KVM / OpenStack Nova

Operational note:

- запас диска больше не является аварийным узким местом;
- но обычный deploy всё равно должен оставаться additive и аккуратным по I/O.

## Production DB

Текущее правило:

- обычный deploy не должен мутировать production-БД;
- DB-операции допустимы только отдельным controlled шагом;
- schema sync, backfill и индексы не должны смешиваться с обычным кодовым rollout.

## Orders

Что важно сейчас:

- additive rollout по orders выполнен;
- Phase 3.1 follow-up закрыт;
- `listOrders` работает в `modern` compatibility path;
- `addOrderComment` пишет в `order_comments`;
- `getOrderHistory` читает materialized history/comments;
- compatibility mode остаётся включённым как защитный слой.

Важно читать как current:

- [orders-phase3-final-production-status.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-final-production-status.md>)
- [orders-phase3-1-followup-result.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-1-followup-result.md>)

Важно помнить:

- часть order-документов — исторические snapshot-отчёты;
- после последующей очистки тестовых заказов некоторые старые counts в historical docs больше не равны текущему production состоянию.

## Users / admin cleanup

Production очищен от тестовых customer-данных:

- тестовые заказы удалены;
- тестовые customer-пользователи удалены;
- `super_admin` аккаунты сохранены;
- в админке есть удаление пользователей и заказов только для `super_admin`.

## Product visibility

В production уже применены:

1. additive schema changes для `products`;
2. controlled backfill для `is_auto_blocked` / `auto_block_reason`.

Итог:

- товары с нулевой или невалидной ценой не попадают в публичный каталог;
- не попадают в поиск;
- не попадают в sitemap;
- не проходят в корзину и checkout;
- остаются видимыми в админке.

## Deploy pipeline

Сейчас безопасная модель такая:

- push в `master` => code deploy only;
- DB maintenance => отдельный manual workflow или отдельный ручной rollout.

Reference:

- [deployment-safety.md](</E:/work/ru/tehax/s/app/docs/deployment-safety.md>)
- [deploy-pipeline-final-safety-status.md](</E:/work/ru/tehax/s/app/docs/deploy-pipeline-final-safety-status.md>)

## Engineering health

Локально подтверждено:

- `npm run check` — OK
- `npm run build` — OK
- `npm test` — OK

## Как читать документацию дальше

Если нужно быстро понять проект, порядок такой:

1. [operations-index.md](</E:/work/ru/tehax/s/app/docs/operations-index.md>)
2. [project-current-status.md](</E:/work/ru/tehax/s/app/docs/project-current-status.md>)
3. [deployment-safety.md](</E:/work/ru/tehax/s/app/docs/deployment-safety.md>)
4. профильные документы по Orders / product visibility / sync

## Что нельзя делать без отдельного подтверждения

- destructive migrations;
- drop таблиц/колонок;
- изменение типов живых production-колонок;
- массовый backfill как часть обычного deploy;
- `db:push --force` по production;
- отключение compatibility mode без отдельной фазы.
