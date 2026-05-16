# Orders Safe Migration Plan

## Назначение документа

Этот документ фиксирует Phase 3 для раздела `Заказы`: подготовку безопасного плана перехода от legacy-структуры БД к новой схеме без немедленного применения миграций, без backfill и без изменений production-БД.

Документ предназначен для:

- разработчика;
- DevOps;
- владельца проекта.

Главная цель: подготовить понятный и безопасный маршрут перехода, не ломая текущую работу production, где раздел заказов уже стабилизирован и работает в `legacy compatibility mode`.

## Текущее состояние production

На production сейчас:

- раздел `Заказы` работает стабильно;
- rollback не требуется;
- включён и используется `legacy compatibility mode`;
- backend и frontend умеют работать с частично legacy-структурой `orders` / `order_items`;
- часть production-БД может не содержать всех колонок и таблиц, которые ожидает новая схема.

## Почему нельзя сразу отключать fallback

Fallback нельзя отключать сразу, потому что:

- production-БД может быть только частично домигрирована;
- старые заказы уже существуют и должны открываться безопасно;
- новые поля (`order_number`, `subtotal`, `delivery_status`, `customer_*`, `order_history`, `order_comments`, расширенные snapshot-поля `order_items`) могут отсутствовать;
- резкое отключение compatibility-логики может привести к ошибкам чтения, экспорта, обновления статусов, деталей заказа и карточки заказа;
- перед отключением fallback нужно сначала убедиться, что additive-миграции применены и данные валидированы.

## Целевая схема

### Таблица `orders`

Целевая схема должна поддерживать:

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

### Таблица `order_items`

Целевая схема должна поддерживать:

- `sku`
- `product_name`
- `image`
- `discount`
- `total`
- `stock_status`

### Таблицы истории и комментариев

Отдельные таблицы:

- `order_history`
- `order_comments`

## Roadmap Phase 3

### Шаг 1. Read-only аудит production-структуры

Сначала выполняются только безопасные `SELECT`-запросы:

- состав колонок `orders`, `order_items`, `users`;
- наличие `order_history`, `order_comments`;
- наличие индексов;
- размеры таблиц и распределение legacy-статусов;
- проверка того, какие API-critical поля уже существуют.

### Шаг 2. Подготовка additive migration batches

Нужно подготовить SQL-пакеты, которые:

- только добавляют недостающие nullable/default-safe поля;
- только создают отсутствующие таблицы;
- не удаляют ничего существующего;
- не меняют типы полей;
- не меняют исторические данные;
- не ставят `NOT NULL` на живые legacy-строки;
- не добавляют `FOREIGN KEY` без отдельного подтверждения.

### Шаг 3. Additive rollout только после подтверждения

После подготовки SQL-файлов rollout должен происходить отдельно и вручную:

1. backup / snapshot;
2. запуск на staging-копии;
3. smoke-проверка;
4. запуск на production;
5. повторная smoke-проверка;
6. только потом обсуждение backfill.

### Шаг 4. Backfill не входит в текущий этап

Backfill на Phase 3 не выполняется. Разрешено только подготовить план:

- какие поля можно будет заполнять позже;
- из каких источников;
- какие риски есть;
- почему без backup и staging запускать нельзя.

### Шаг 5. Отключение fallback — только после подтверждённой готовности

Fallback может быть отключён только когда:

- новые поля реально появились в production-БД;
- новые таблицы созданы;
- критичные legacy-заказы открываются без compatibility-path;
- API и админка проходят smoke-проверку в новой схеме;
- есть подтверждение по данным и безопасный план дальнейшего шага.

## Safe migration batches

### Batch A — расширение `orders`

Additive-миграция только для новых полей в `orders`:

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

Требования:

- только `ADD COLUMN IF NOT EXISTS`, если поддерживается СУБД;
- только nullable/default-safe поля;
- без `UNIQUE`;
- без `FOREIGN KEY`;
- без backfill;
- без изменения старых полей.

### Batch B — расширение `order_items`

Additive-миграция только для новых полей в `order_items`:

- `sku`
- `product_name`
- `image`
- `discount`
- `total`
- `stock_status`

Требования:

- только `ADD COLUMN IF NOT EXISTS`;
- snapshot-поля nullable;
- `discount` можно с безопасным `DEFAULT 0`;
- `total` nullable или safe default;
- без пересчёта старых строк;
- без backfill.

### Batch C — создание новых таблиц

Только создание, если отсутствуют:

- `order_history`
- `order_comments`

Требования:

- `CREATE TABLE IF NOT EXISTS`;
- без `FOREIGN KEY`;
- без каскадов;
- только минимально необходимые поля;
- `created_at` с безопасным default.

### Batch D — индексы

Индексы готовятся отдельно и не применяются автоматически:

- `orders(created_at)`
- `orders(status)`
- `orders(payment_status)`
- `orders(user_id)`
- `order_items(order_id)`
- `order_history(order_id)`, если таблица есть
- `order_comments(order_id)`, если таблица есть

Индексы должны применяться только после отдельного подтверждения.

## Read-only checklist

Перед любыми миграциями нужно выполнить только read-only проверки:

1. Снять структуру `orders`.
2. Снять структуру `order_items`.
3. Снять структуру `users`.
4. Проверить наличие `order_history` и `order_comments`.
5. Проверить существующие индексы.
6. Проверить `COUNT(*)` по `orders`.
7. Проверить `COUNT(*)` по `order_items`.
8. Проверить заказы без `user_id`.
9. Проверить распределение `orders.status`.
10. Проверить распределение `orders.payment_status`.
11. Проверить распределение `orders.delivery_type`.
12. Проверить наличие `order_number`, если колонка уже есть.
13. Проверить потенциальные дубли `order_number`, если колонка уже есть.
14. Проверить, не существуют ли уже частично созданные `order_history` / `order_comments`.

## Migration execution strategy

Когда придёт время rollout:

1. Снять backup / snapshot.
2. Выполнить read-only audit.
3. Запустить additive batches на staging.
4. Выполнить smoke-проверку:
   - `listOrders`
   - `getOrderById`
   - `placeOrder`
   - `updateOrderStatus`
   - `updateOrderItemQuantity`
   - `exportOrdersCsv`
   - `exportOrdersXlsx`
5. Если staging прошёл успешно — запуск на production.
6. Повторить smoke на production.
7. Только потом обсуждать controlled backfill.

## Что нельзя делать без подтверждения

Нельзя:

- делать destructive migrations;
- удалять таблицы;
- удалять колонки;
- менять типы существующих колонок;
- ставить `NOT NULL` на legacy-данные;
- добавлять `FOREIGN KEY` без отдельного подтверждения;
- выполнять backfill;
- массово мигрировать legacy-статусы;
- пересчитывать исторические суммы;
- отключать `legacy compatibility mode`.

## Критерии завершения Phase 3

Phase 3 можно считать завершённым, когда:

- подготовлен и зафиксирован safe migration plan;
- подготовлены read-only audit queries;
- подготовлены additive SQL batches A/B/C/D;
- подготовлены post-rollout validation queries;
- подготовлен backfill plan без выполнения;
- подготовлен draft legacy status mapping;
- production-БД ещё не изменялась в рамках этого этапа.
