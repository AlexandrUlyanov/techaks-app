# Orders Phase 3 Final Production Status

Дата фиксации: 2026-05-15  
Окружение: production  
Проект: TechAks

## Итоговый статус

- push в `master` выполнен успешно;
- deploy через GitHub Actions прошёл успешно;
- обычный deploy больше не запускает `db:push`, `drizzle-kit push` или inline SQL;
- PM2 process `techaks` перезапущен успешно;
- healthcheck после deploy прошёл успешно;
- production pages отвечают `200 OK`;
- smoke-test раздела `Заказы` прошёл успешно;
- `listOrders` работает в `compatibilityMode: modern`;
- `addOrderComment` пишет в `order_comments`;
- `getOrderHistory` читает materialized `history/comments`;
- `updateOrderDelivery` для delivery сохраняет:
  - `delivery_service`
  - `delivery_track_number`
  - `delivery_price`
  - `delivery_status`
- rollback не требуется.

## Подтверждённые production checks

Проверены и подтверждены:

- `https://techaks.ru/` отвечает `200`;
- `https://techaks.ru/admin/leads` отвечает `200`;
- карточки заказов `#14`, `#15`, `#18`, `#20` открываются;
- список заказов работает;
- поиск по ID работает;
- фильтры по заказам работают;
- экспорт `CSV` работает;
- экспорт `XLSX` работает;
- `getOrderHistory` работает;
- `addOrderComment` на тестовом заказе работает;
- `updateOrderDelivery` для pickup даёт controlled warning;
- `updateOrderDelivery` для delivery работает в modern path.

## Что важно по логам

В PM2 logs присутствуют старые исторические ошибки, включая прежние `Unknown column` и legacy/history записи.

Зафиксировано отдельно:

- эти ошибки являются историческими;
- текущим production smoke-test они не воспроизводятся;
- по актуальному smoke раздел `Заказы` работает корректно.

## Что НЕ делалось

Подтверждено, что после push:

- `DB push` не запускался;
- миграции после push не запускались;
- backfill не выполнялся;
- `Batch D indexes` не запускался;
- `compatibility mode` не отключался.

## Вывод

Текущее production-состояние можно считать стабильным для Phase 3.

Раздел `Заказы`:

- синхронизирован с актуальным кодом;
- проходит production smoke-check;
- не требует rollback;
- не выполнял повторных автоматических DB mutations во время deploy.
