# Orders Production Rollout Proposal

## Назначение

Этот документ описывает proposal для production rollout после успешного staging-прогона.

Важно:

- это proposal, а не инструкция к немедленному запуску;
- rollout на production не выполняется в рамках текущего этапа;
- backfill в rollout не входит;
- compatibility mode должен оставаться включённым.

## Какие batches нужны на production

По итогам production read-only audit нужны все batches:

- `Batch A` — расширение `orders`
- `Batch B` — расширение `order_items`
- `Batch C` — создание `order_history` / `order_comments`
- `Batch D` — индексы

## Почему нужны все A / B / C / D

### Batch A

В production отсутствуют новые поля `orders`, включая:

- `order_number`
- `delivery_status`
- `subtotal`
- `discount_total`
- `delivery_price`
- `paid_amount`
- `payment_method`
- `payment_id`
- `source`
- `customer_*`
- `updated_at`

### Batch B

В production отсутствуют snapshot- и total-поля `order_items`:

- `sku`
- `product_name`
- `image`
- `discount`
- `total`
- `stock_status`

### Batch C

В production отсутствуют таблицы:

- `order_history`
- `order_comments`

### Batch D

В production почти нет прикладных индексов по заказам, кроме PK.

## Почему Batch D лучше запускать отдельно

Batch D лучше выполнять отдельно, потому что:

- индексы могут повлиять на длительность rollout;
- структурные изменения лучше отделить от performance-изменений;
- если проблема возникнет, легче локализовать, связано ли это с DDL структуры или с индексами.

## Какие SQL будут выполняться

После отдельного подтверждения:

1. `docs/sql/orders-additive-batch-a-orders.sql`
2. `docs/sql/orders-additive-batch-b-order-items.sql`
3. `docs/sql/orders-additive-batch-c-history-comments.sql`
4. `docs/sql/orders-additive-batch-d-indexes.sql` — отдельно и только после подтверждения

## Какие smoke tests выполнять после каждого batch

### После Batch A

- `/admin/leads`
- открытие карточки заказа
- поиск по ID
- фильтры
- export CSV
- export XLSX

### После Batch B

- карточка legacy-заказа
- изменение количества позиции
- пересчёт total

### После Batch C

- `getOrderHistory`
- `addOrderComment`
- история/комментарии в карточке заказа

### После Batch D

- повторная проверка списка заказов
- повторная проверка карточки заказа
- контроль времени ответа

## Какие логи смотреть

После каждого batch следить за:

- application logs;
- backend error logs;
- SQL errors / migration logs;
- admin UI errors;
- API responses для `listOrders`, `getOrderById`, `exportOrdersCsv`, `exportOrdersXlsx`.

## Когда rollout можно считать успешным

Rollout можно считать успешным, если:

- все additive SQL применились без ошибок;
- `/admin/leads` работает;
- карточки legacy и новых заказов открываются;
- export работает;
- history/comments работают после Batch C;
- fallback по-прежнему не ломается;
- нет новых production error spikes.

## Что делать при ошибке

Если появляется ошибка:

1. остановить дальнейшие batch;
2. сохранить SQL/log output;
3. не делать destructive rollback;
4. при необходимости откатить только код к стабильному compatibility-path;
5. разбирать проблему до следующего шага rollout.

## Почему backfill не входит в этот rollout

Backfill не входит в rollout, потому что:

- additive rollout должен сначала только расширить схему;
- исторические данные нельзя безопасно переписывать без отдельного анализа;
- для backfill нужен отдельный backup / staging / smoke plan;
- status migration и historical totals требуют отдельного подтверждения.
