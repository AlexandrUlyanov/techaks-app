# Orders Phase 3.1 Follow-Up Result

## Status

`OK`

Phase 3.1 выполнен как controlled production follow-up после partial additive rollout.

Важно:

- это point-in-time rollout result;
- указанные в документе тестовые заказы и counts относятся к моменту выполнения follow-up;
- после последующей очистки test orders документ нужно читать как historical engineering record.

Итог:

- remaining schema/code mismatch закрыт;
- `Batch A2` применён;
- `compatibility mode` остался включённым;
- `Unknown column` ошибки по `orders` write-path после follow-up больше не воспроизводятся;
- `addOrderComment` теперь пишет в `order_comments`;
- `getOrderHistory` читает материализованную историю и комментарии;
- backfill по-прежнему не выполнялся.

## Что было найдено

### 1. Missing `orders` columns после Batch A/B/C

Код уже ожидал дополнительные колонки `orders`, которых не было в production:

| column | expected by code | exists in schema.ts | existed in production before A2 | used in procedure | proposed action |
|---|---|---:|---:|---|---|
| `delivery_service` | yes | yes | no | `updateOrderDelivery`, `placeOrder`, `getOrderById` | add in Batch A2 |
| `delivery_city` | yes | yes | no | `updateOrderDetails`, `getOrderById` | add in Batch A2 |
| `delivery_region` | yes | yes | no | `updateOrderDetails`, `getOrderById` | add in Batch A2 |
| `delivery_postal_code` | yes | yes | no | `updateOrderDetails`, `getOrderById` | add in Batch A2 |
| `delivery_track_number` | yes | yes | no | `updateOrderDelivery`, `getOrderById` | add in Batch A2 |
| `delivery_comment` | yes | yes | no | `getOrderById` | add in Batch A2 |
| `shipped_at` | yes | yes | no | `placeOrder` / full `orders` insert model | add in Batch A2 |
| `delivered_at` | yes | yes | no | `placeOrder` / full `orders` insert model | add in Batch A2 |
| `paid_at` | yes | yes | no | `getOrderById`, `placeOrder` / full `orders` insert model | add in Batch A2 |
| `payment_error` | yes | yes | no | `getOrderById`, `placeOrder` / full `orders` insert model | add in Batch A2 |
| `manager_id` | yes | yes | no | `listOrders`, `getOrderById`, `placeOrder` / full `orders` insert model | add in Batch A2 |
| `is_problem` | yes | yes | no | full `orders` insert model | add in Batch A2 |
| `cancelled_at` | yes | yes | no | full `orders` insert model | add in Batch A2 |
| `cancelled_reason` | yes | yes | no | full `orders` insert model | add in Batch A2 |
| `completed_at` | yes | yes | no | full `orders` insert model | add in Batch A2 |

### 2. Capability detector был фактически сломан

Причина:

- `information_schema` через текущий MySQL/MariaDB driver возвращал ключи в верхнем регистре (`TABLE_NAME`, `COLUMN_NAME`);
- detector ожидал `table_name`, `column_name`;
- из-за этого все capabilities ложились в `false`, и приложение продолжало работать в `legacy` mode даже после появления новых колонок и таблиц.

### 3. `addOrderComment` оставался в legacy skip-path

Это было вторичным эффектом сломанного detector:

- `order_comments` уже существовала;
- но код думал, что таблицы нет;
- поэтому возвращал `compatibility warning` и писал `comment_skipped_legacy` в `order_history`.

## Какие missing columns были добавлены

`Batch A2` добавил:

- `delivery_service`
- `delivery_city`
- `delivery_region`
- `delivery_postal_code`
- `delivery_track_number`
- `delivery_comment`
- `shipped_at`
- `delivered_at`
- `paid_at`
- `payment_error`
- `manager_id`
- `is_problem`
- `cancelled_at`
- `cancelled_reason`
- `completed_at`

После применения:

- `COUNT(*) orders` остался `18` до post-smoke создания нового тестового заказа;
- после smoke `placeOrder` появился новый заказ `#20`;
- старые данные не исчезли;
- существующие legacy-заказы продолжили читаться.

## Backup

- Путь: `/root/backups/techaks_prod_before_orders_phase3_1_20260515_135012.sql`
- Время: `2026-05-15 13:50:12` UTC
- Размер: `8,881,655 bytes`

Подтверждено:

- backup создан до любых `ALTER` в рамках Phase 3.1;
- файл не пустой;
- файл читается;
- места на диске хватило для controlled rollout.

## Что было применено

- Batch A2: `yes`
- Batch D: `no`
- backfill: `no`
- foreign keys: `no`

Дополнительно:

- код compatibility detector и write-path gating обновлён;
- сервер собран вручную на production;
- перезапущен только PM2 process `techaks`;
- `db:push` на production не использовался.

## Smoke results

| scenario | result | notes |
|---|---|---|
| `/admin/leads` | OK | Страница заказов открывается |
| Список заказов | OK | После detector fix перешёл в `modern` mode |
| Поиск по ID | OK | Проверен на `#14` |
| Карточка `#14` | OK | Открывается в `modern` mode |
| Карточка `#15` | OK | Открывается в `modern` mode |
| Карточка `#18` | OK | Открывается в `modern` mode |
| Карточка старого legacy-заказа `#11` | OK | Открывается в `modern` mode, nullable gaps не ломают UI |
| `updateOrderDetails` на `#18` | OK | Сохранились адрес и delivery address details |
| `updateOrderItemQuantity` на `#18` | OK | Количество изменилось, сумма пересчиталась |
| `updateOrderStatus` на `#18` | OK | История materialized, transition валидный |
| `updateOrderDelivery` для `pickup` (`#14`) | OK | Не падает, работает без `Unknown column` |
| `updateOrderDelivery` для `delivery` (`#15`) | OK | `delivery_service`, `delivery_track_number`, `delivery_price`, `delivery_status` сохраняются |
| `addOrderComment` на `#18` | OK | Запись создана в `order_comments` |
| `getOrderHistory` на `#18` | OK | Возвращает materialized history + comments, `compatibilityMode=modern` |
| `export CSV` | OK | Работает в `modern` mode |
| `export XLSX` | OK | Работает в `modern` mode |
| `placeOrder` через prod API | OK | Создан новый заказ `#20`, `orderNumber` и `source=site` заполнились |
| `PM2 logs` | OK | После follow-up новых `Unknown column` записей не появилось |

## Errors

На финальном этапе критичных ошибок не осталось.

### Ранее найденные ошибки, теперь закрыты

1. `Unknown column 'delivery_service' in 'field list'`
   - закрыто через `Batch A2` + корректный gating.

2. `addOrderComment` → legacy warning при существующей `order_comments`
   - закрыто исправлением capability detector.

3. `getOrderHistory` → legacy warning при существующих `order_history` / `order_comments`
   - закрыто исправлением capability detector.

## Что НЕ делалось

Подтверждаю:

- destructive migrations не выполнялись;
- backfill не выполнялся;
- Batch D indexes не запускался;
- compatibility mode не отключался;
- foreign keys не добавлялись;
- исторические заказы не пересчитывались;
- массовые `UPDATE` по старым заказам не выполнялись;
- production `db:push` не запускался.

## Recommendation

### Можно ли считать additive schema rollout OK

Да.

После Phase 3.1 additive schema rollout можно считать `OK`:

- нужные nullable-колонки добавлены;
- modern write-path заработал;
- materialized comments/history работают;
- приложение не требует rollback;
- compatibility fallback остаётся доступным как защитный слой.

### Можно ли позже планировать Batch D indexes

Да, отдельно.

Batch D по-прежнему лучше делать отдельным controlled rollout:

- данных пока мало;
- срочной performance-потребности нет;
- сейчас важнее было догнать безопасную структуру и снять schema/code mismatch.

### Можно ли позже планировать controlled backfill

Да, но только отдельной фазой и после явного подтверждения.

Приоритеты для будущего backfill:

1. `order_number` для старых заказов;
2. `subtotal`, `discount_total`, `delivery_price`, `source`;
3. `order_items.total`, `stock_status`, snapshot fields;
4. customer fields только из подтверждённого источника.

### Какие code paths ещё требуют legacy fallback

Legacy fallback всё ещё нужен для безопасной работы со старыми строками, где:

- `order_number` ещё `NULL`;
- `source` ещё `NULL`;
- `subtotal` / `updated_at` могут быть `NULL`;
- `order_items.total` / `stock_status` / `sku` / `product_name` / `image` у legacy item могут оставаться пустыми.

Это нормально и не мешает считать rollout `OK`, потому что fallback остаётся частью текущей архитектуры совместимости.
