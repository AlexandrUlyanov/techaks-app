# Orders Phase 3: Safe Migration Plan

## Цель

Подготовить безопасный план приведения legacy-структуры заказов к новой схеме раздела `Заказы` без немедленного запуска миграций на production.

Ключевой принцип:

- ничего не удалять;
- не делать destructive migrations;
- не пересчитывать массово исторические данные;
- не ломать текущий `legacy compatibility mode`;
- сначала добиться additive-совместимости БД, потом уже отключать fallback в коде.

## Текущее состояние

Сейчас раздел `Заказы` работает в production стабильно, но в режиме совместимости:

- часть production-БД живёт по legacy-структуре;
- код уже умеет fallback на старые таблицы и старые поля;
- новые сущности (`order_history`, `order_comments`, расширенные поля `orders`, расширенные поля `order_items`) не гарантированы на проде;
- rollback не требуется;
- переход к новой схеме нужно делать постепенно.

## Что считаем целевой схемой

Целевым состоянием считается рабочая новая схема, в которой доступны:

### `orders`

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

### `order_items`

- `sku`
- `product_name`
- `image`
- `discount`
- `total`
- `stock_status`

### отдельные таблицы

- `order_history`
- `order_comments`

## Phase 3 roadmap

### Шаг 1. Зафиксировать фактическую production-структуру

Сначала нужно только снять срез структуры production-БД и сохранить его как артефакт аудита.

Нужно проверить:

- какие колонки реально есть в `orders`;
- какие колонки реально есть в `order_items`;
- существуют ли `order_history` и `order_comments`;
- в каком состоянии таблица `users`;
- какие индексы уже есть;
- есть ли расхождения между schema/миграциями и живой БД.

Делать только read-only запросами к `information_schema`.

### Шаг 2. Подготовить additive migration set

Следующий шаг — подготовить миграции, которые:

- только добавляют недостающие nullable-колонки;
- только добавляют отсутствующие таблицы;
- не удаляют старые поля;
- не меняют типы существующих полей;
- не трогают существующие данные.

Допустимые действия:

- `ADD COLUMN ... NULL`
- `ADD TABLE ...`
- `ADD INDEX`, если отдельно подтверждено

Недопустимые действия:

- `DROP COLUMN`
- `DROP TABLE`
- `ALTER COLUMN TYPE`
- `SET NOT NULL` на колонках с живыми legacy-данными
- `ADD FOREIGN KEY` без отдельного подтверждения

### Шаг 3. Ввести dual-read / dual-write readiness

До применения миграций код уже работает через capability detection и fallback.

После additive-миграций нужно сохранить тот же принцип:

- новые рид-пути читают новые поля, если они есть;
- legacy-пути продолжают работать;
- write-path может постепенно писать в новые поля там, где они уже появились;
- отсутствие новых колонок не должно приводить к ошибкам.

То есть сначала БД догоняет код, а не наоборот.

### Шаг 4. Backfill plan без автоматического запуска

После появления новых колонок можно отдельно подготовить plan backfill, но не запускать его автоматически.

Что можно будет backfill-ить позже, только после подтверждения:

- `order_number` для legacy-заказов;
- `subtotal = total_price`;
- `discount_total = 0`;
- `delivery_price = 0`;
- `source = 'legacy'`;
- `customer_name/customer_email/customer_phone`, если корректный источник данных подтверждён;
- `order_items.total = quantity * price`;
- `order_items.product_name/image/sku` snapshot-значениями только по понятной стратегии.

Что не делать автоматически:

- не пересчитывать исторические суммы “по-новому”;
- не пытаться угадать потерянные delivery/payment значения;
- не синхронизировать старые статусы в новые enum без отдельной карты соответствия.

### Шаг 5. Включить мягкую валидацию после миграций

После additive-миграций должны появиться проверки:

- сколько заказов всё ещё без `order_number`;
- сколько заказов без customer-полей;
- сколько `order_items` без `total`;
- сколько строк не имеют данных для истории/комментариев;
- какие API всё ещё возвращают `compatibilityMode: legacy`.

Цель — понимать, когда можно реально уменьшать dependency от legacy fallback.

### Шаг 6. Только потом планировать отключение fallback

Отключение fallback — это не часть Phase 3.

Оно возможно только когда:

- новые колонки реально присутствуют на production;
- новые таблицы созданы;
- критичные legacy-заказы открываются без fallback;
- exports, listOrders, getOrderById и update-процедуры работают на новой схеме;
- есть подтверждение по данным и smoke-проверка.

## Safe migration batches

### Batch A — расширение `orders`

Подготовить отдельную additive migration, которая только добавляет отсутствующие nullable/default-safe поля:

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

- все новые поля либо `NULL`, либо с безопасным default;
- без unique constraints на первом шаге;
- без преобразования старых строк.

### Batch B — расширение `order_items`

Подготовить additive migration для:

- `sku`
- `product_name`
- `image`
- `discount`
- `total`
- `stock_status`

Требования:

- `discount` безопасно по умолчанию `0`, если решим использовать default;
- `total` сначала допускает `NULL` или безопасный default;
- без обязательности snapshot-полей на старых строках.

### Batch C — новые таблицы

Подготовить создание:

- `order_history`
- `order_comments`

Требования:

- без foreign keys на первом шаге;
- без каскадов;
- с простыми индексами по `order_id`, если отдельно подтверждено.

### Batch D — индексы

Индексы не применять автоматически в рамках этого плана, но держать отдельно как готовый rollout.

См. также:

- [orders-non-destructive-index-plan.md](</E:/work/ru/tehax/s/app/docs/orders-non-destructive-index-plan.md>)

## Read-only checklist before any migration

Перед запуском любой additive-миграции нужно выполнить read-only checklist:

1. Снять дамп структуры `orders`, `order_items`, `users`.
2. Снять список существующих индексов.
3. Проверить размеры таблиц.
4. Проверить количество заказов и order_items.
5. Проверить наличие строк с `NULL user_id`.
6. Проверить распределение legacy-статусов.
7. Проверить, есть ли коллизии по `order_number`, если колонка уже существует.
8. Проверить, нет ли уже частично созданных `order_history` / `order_comments`.

## Read-only validation queries to prepare

Нужно подготовить, но не запускать автоматически в коде:

- список колонок `orders`
- список колонок `order_items`
- список колонок `users`
- наличие таблиц `order_history`, `order_comments`
- список индексов по `orders` и `order_items`
- `COUNT(*)` по заказам
- `COUNT(*)` по позициям заказов
- `COUNT(*)` заказов без `user_id`
- top legacy statuses

## Migration execution strategy

Когда придёт время реально мигрировать, порядок должен быть таким:

1. Снять backup / snapshot.
2. Выполнить только additive SQL на staging-копии.
3. Прогнать smoke:
   - `listOrders`
   - `getOrderById`
   - `placeOrder`
   - `updateOrderStatus`
   - `updateOrderItemQuantity`
   - `exportOrdersCsv`
   - `exportOrdersXlsx`
4. Выполнить тот же additive rollout на production.
5. Повторить smoke на production.
6. Только после этого обсуждать controlled backfill.

## Что можно подготовить в Phase 3

В рамках Phase 3 можно безопасно подготовить:

- документ-карту миграций;
- SQL-файлы additive migration batches;
- read-only SQL-аудит структуры;
- validation checklist;
- backfill plan без запуска;
- карту перехода legacy status → new status, но без применения.

## Что не делать в Phase 3

Без отдельного подтверждения нельзя:

- запускать миграции на production;
- выполнять backfill старых заказов;
- добавлять foreign keys;
- переводить legacy status в новую модель массово;
- делать `NOT NULL` на новых колонках;
- удалять legacy-поля или таблицы;
- выключать `legacy compatibility mode`.

## Признак завершения Phase 3

Phase 3 считается завершённым, когда:

- есть зафиксированный safe migration plan;
- определены additive migration batches;
- подготовлен read-only DB audit checklist;
- подготовлен validation checklist после rollout;
- подготовлен plan по backfill, но без выполнения;
- нет ни одного изменения production-БД по этому этапу.
