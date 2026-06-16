# Orders Batch D Rollout Runbook

Дата: 2026-05-16  
Проект: TechAks

## Назначение

Этот runbook описывает отдельный controlled rollout индексов для раздела `Заказы`.

Речь идёт только о:

- `orders(created_at)`
- `orders(status)`
- `orders(payment_status)`
- `orders(user_id)`
- `order_items(order_id)`
- `order_history(order_id)`
- `order_comments(order_id)`

Сам SQL уже подготовлен в:

- [docs/sql/orders-additive-batch-d-indexes.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-additive-batch-d-indexes.sql>)

## Что нельзя делать в рамках Batch D

Нельзя:

- запускать `db:push`;
- выполнять schema changes;
- менять типы колонок;
- выполнять backfill;
- добавлять foreign keys;
- совмещать rollout индексов с обычным deploy;
- совмещать rollout индексов с product backfill;
- совмещать rollout индексов с любыми ручными hotfix SQL.

## Preconditions

Перед запуском должны быть выполнены условия:

1. Structural rollout `Orders Phase 3 / 3.1` уже завершён.
2. Приложение стабильно работает на production.
3. Есть свежий backup БД.
4. Есть короткое окно низкой нагрузки.
5. Есть read-only подтверждение текущих индексов:
   - [orders-batch-d-production-readiness.md](</E:/work/ru/tehax/s/app/docs/orders-batch-d-production-readiness.md>)

## Preflight

Перед запуском:

1. Подтвердить, что база — `techaks_prod`.
2. Снять backup.
3. Проверить свободное место на диске.
4. Проверить, что `techaks` online.
5. Снять `SHOW INDEX` повторно по:
   - `orders`
   - `order_items`
   - `order_history`
   - `order_comments`

## Apply

Запускать только:

- [docs/sql/orders-additive-batch-d-indexes.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-additive-batch-d-indexes.sql>)

Особенности:

- скрипт guarded;
- создаёт только отсутствующие индексы;
- уже существующие пропускает;
- не добавляет `UNIQUE`;
- не добавляет `FOREIGN KEY`.

## Post-check

После применения проверить:

1. `SHOW INDEX FROM orders;`
2. `SHOW INDEX FROM order_items;`
3. `SHOW INDEX FROM order_history;`
4. `SHOW INDEX FROM order_comments;`

Убедиться, что появились:

- `idx_orders_created_at`
- `idx_orders_status`
- `idx_orders_payment_status`
- `idx_orders_user_id`
- `idx_order_items_order_id`
- `idx_order_history_order_id`
- `idx_order_comments_order_id`

## Smoke после Batch D

Проверить:

- `/admin/leads`
- список заказов
- поиск по ID
- фильтры `status / payment / delivery`
- открытие карточки заказа
- история заказа
- комментарии заказа
- создание нового заказа

## Rollback strategy

Так как это additive index rollout:

- обычно rollback не требуется;
- если после Batch D есть проблема, сначала анализируем её без удаления индексов;
- `DROP INDEX` не делать автоматически и не делать “на эмоциях”.

Если вдруг понадобится rollback:

1. сначала зафиксировать симптом;
2. подтвердить, какой именно индекс связан с проблемой;
3. отдельно согласовать ручной `DROP INDEX`.

## Recommendation

Batch D теперь можно планировать как отдельную production-фазу.

По текущему состоянию это:

- не срочный hotfix;
- не risky data migration;
- а короткий performance rollout.
