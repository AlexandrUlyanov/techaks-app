# Orders Production Read-Only Audit Result

## Дата аудита

- Дата: `2026-05-15`
- Окружение: `production`
- База данных: `techaks_prod`
- СУБД: `MySQL / MariaDB-compatible`

## Важное подтверждение

Подтверждаю явно:

- production-БД не менялась;
- выполнялись только read-only `SELECT`-запросы;
- миграции не запускались;
- backfill не выполнялся;
- индексы не создавались.

## Таблица `orders`

| column | type | nullable | default | exists in target schema | comment |
|---|---|---:|---|---:|---|
| `id` | `bigint unsigned` | no | `NULL` | yes | PK, есть в legacy и target |
| `user_id` | `int` | yes | `NULL` | yes | есть, nullable |
| `status` | `varchar(20)` | no | `pending` | yes | legacy order status |
| `total_price` | `int` | no | `NULL` | yes | используется как основной total |
| `delivery_type` | `varchar(20)` | no | `pickup` | yes | есть |
| `address` | `text` | yes | `NULL` | yes | есть |
| `payment_type` | `varchar(20)` | no | `cash` | yes | есть |
| `payment_status` | `varchar(20)` | no | `unpaid` | yes | есть |
| `created_at` | `timestamp` | no | `now()` | yes | есть |

### Отсутствуют относительно целевой схемы `orders`

- `order_number`
- `delivery_status`
- `subtotal`
- `discount_total`
- `delivery_price`
- `paid_amount`
- `payment_method`
- `payment_id`
- `source`
- `customer_name`
- `customer_phone`
- `customer_email`
- `customer_first_name`
- `customer_last_name`
- `customer_comment`
- `internal_comment`
- `updated_at`

## Таблица `order_items`

| column | type | nullable | default | exists in target schema | comment |
|---|---|---:|---|---:|---|
| `id` | `bigint unsigned` | no | `NULL` | yes | PK |
| `order_id` | `int` | no | `NULL` | yes | есть |
| `product_id` | `int` | no | `NULL` | yes | есть |
| `quantity` | `int` | no | `1` | yes | есть |
| `price` | `int` | no | `NULL` | yes | есть |

### Отсутствуют относительно целевой схемы `order_items`

- `sku`
- `product_name`
- `image`
- `discount`
- `total`
- `stock_status`

## Таблица `users`

| column | type | nullable | default | exists in target schema | comment |
|---|---|---:|---|---:|---|
| `id` | `bigint unsigned` | no | `NULL` | yes | PK |
| `phone` | `varchar(20)` | no | `NULL` | yes | есть |
| `full_name` | `varchar(255)` | yes | `NULL` | yes | используется вместо `name` |
| `email` | `varchar(255)` | yes | `NULL` | yes | есть |
| `created_at` | `timestamp` | no | `now()` | yes | есть |
| `role` | `varchar(40)` | no | `customer` | yes | есть |
| `status` | `varchar(40)` | no | `active` | yes | есть |
| `password_hash` | `varchar(255)` | yes | `NULL` | yes | есть |

### Вывод по `users`

- `email` есть;
- `full_name` есть;
- отдельной колонки `name` нет;
- `role` / `status` / `password_hash` есть.

## Таблицы `order_history` / `order_comments`

- `order_history`: **не существует**
- `order_comments`: **не существует**

Следовательно:

- колонок в этих таблицах нет;
- индексов по ним нет;
- history/comments в production сейчас действительно работают только через compatibility fallback.

## Индексы

### `orders`

| table | index | non_unique | seq | column |
|---|---|---:|---:|---|
| `orders` | `id` | 0 | 1 | `id` |
| `orders` | `PRIMARY` | 0 | 1 | `id` |

### `order_items`

| table | index | non_unique | seq | column |
|---|---|---:|---:|---|
| `order_items` | `id` | 0 | 1 | `id` |
| `order_items` | `PRIMARY` | 0 | 1 | `id` |

### `order_history`

- таблица отсутствует;
- индексов нет.

### `order_comments`

- таблица отсутствует;
- индексов нет.

## Объёмы данных

| metric | value |
|---|---:|
| `orders_count` | 16 |
| `order_items_count` | 11 |
| `orders_without_user_id` | 0 |
| `order_items_without_order_id` | 0 |

## Распределение статусов

### `orders.status`

| status | total |
|---|---:|
| `pending` | 10 |
| `cancelled` | 3 |
| `assembling` | 1 |
| `completed` | 1 |
| `confirmed` | 1 |

### `orders.payment_status`

| payment_status | total |
|---|---:|
| `unpaid` | 16 |

### `orders.delivery_type`

| delivery_type | total |
|---|---:|
| `pickup` | 11 |
| `delivery` | 5 |

## `order_number`

### Факт

- колонка `order_number` в production **отсутствует**

### Следствия

- `NULL` / empty / duplicates проверить невозможно, пока колонка не добавлена;
- все текущие проверки на `order_number` должны работать через fallback (`#id`).

### Важная заметка по audit SQL

В исходном файле [docs/sql/orders-readonly-audit.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-readonly-audit.sql>) запрос на поиск дублей `order_number` не является универсально безопасным для legacy-схемы: он всё равно ссылается на колонку `orders.order_number`, и в текущем production-формате падает, потому что колонки нет.  
Данные не пострадали, но этот запрос нужно считать условным и запускать только после подтверждения наличия колонки либо переписать в более защищённой форме.

## Legacy gaps

### Missing `orders` columns

- `order_number`
- `delivery_status`
- `subtotal`
- `discount_total`
- `delivery_price`
- `paid_amount`
- `payment_method`
- `payment_id`
- `source`
- `customer_name`
- `customer_phone`
- `customer_email`
- `customer_first_name`
- `customer_last_name`
- `customer_comment`
- `internal_comment`
- `updated_at`

### Missing `order_items` columns

- `sku`
- `product_name`
- `image`
- `discount`
- `total`
- `stock_status`

### Missing tables

- `order_history`
- `order_comments`

### Missing indexes

Практически отсутствуют рабочие прикладные индексы:

- нет индекса `orders(created_at)`
- нет индекса `orders(status)`
- нет индекса `orders(payment_status)`
- нет индекса `orders(user_id)`
- нет индекса `order_items(order_id)`
- нет индексов по `order_history(order_id)` и `order_comments(order_id)`, потому что самих таблиц нет

### Risky nullable / data gaps

- `orders.user_id` уже nullable по схеме, но фактически сейчас пустых значений нет;
- customer-поля отсутствуют полностью как структура, а не только как данные;
- `subtotal` / `discount_total` / `delivery_price` / `paid_amount` отсутствуют полностью;
- snapshot-поля позиций заказа отсутствуют полностью;
- history/comments отсутствуют как сущности БД.

## Сравнение с draft batch-файлами

| batch | needed | reason | risk | requires approval |
|---|---|---|---|---|
| `Batch A — orders` | yes | В `orders` отсутствует весь новый слой полей | low / medium | yes |
| `Batch B — order_items` | yes | В `order_items` отсутствуют все snapshot- и total-поля | low / medium | yes |
| `Batch C — history/comments` | yes | Таблицы `order_history` и `order_comments` отсутствуют полностью | medium | yes |
| `Batch D — indexes` | yes | Прикладных индексов почти нет, кроме PK | medium | yes |

## Вывод

### Какие batches потенциально нужны

Нужны все подготовленные additive batches:

- `orders-additive-batch-a-orders.sql`
- `orders-additive-batch-b-order-items.sql`
- `orders-additive-batch-c-history-comments.sql`
- `orders-additive-batch-d-indexes.sql`

### Какие batches не нужны

На текущем production-срезе нет batch, который можно было бы считать полностью ненужным.

### Есть ли риск запускать additive migration

Да, риск есть, но он управляемый:

- структура production очень legacy;
- additive-миграции действительно нужны;
- перед реальным запуском обязательно нужен staging rollout и smoke;
- Batch D с индексами особенно желательно применять отдельно от структурных batch A/B/C.

### Можно ли готовить staging rollout

Да, можно готовить staging rollout:

- read-only audit подтвердил, что production находится в legacy-состоянии;
- состав missing columns / missing tables понятен;
- additive batches теперь можно сверять с staging и готовить к безопасному прогону.

### Что требует отдельного подтверждения

Отдельного подтверждения требуют:

- запуск `Batch A`
- запуск `Batch B`
- запуск `Batch C`
- запуск `Batch D`
- любой backfill
- любая массовая миграция legacy-статусов
- добавление `FOREIGN KEY`
- отключение `legacy compatibility mode`

