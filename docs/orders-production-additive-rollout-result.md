# Orders Production Additive Rollout Result

## Production rollout status

`Partial`

Rollout выполнен на production в controlled additive-режиме.

Что это означает:

- Batch A, Batch B и Batch C применены успешно;
- destructive changes не выполнялись;
- compatibility mode остался включённым;
- production продолжает работать;
- структура заказов догнана частично, но не полностью до всех ожиданий текущего кода;
- часть write-path после rollout всё ещё уходит в legacy fallback.

## Backup

- Путь: `/root/backups/techaks_prod_before_orders_phase3_20260515_100452.sql`
- Время создания: `2026-05-15 10:04:52` UTC
- Размер файла: `8,869,616 bytes`

Дополнительно:

- backup создан до любых `ALTER`;
- dump не пустой;
- файл читается;
- в дампе подтверждено наличие таблицы `orders`.

## Applied batches

- Batch A: `yes`
- Batch B: `yes`
- Batch C: `yes`
- Batch D: `no`

## Validation results

| check | result | notes |
|---|---|---|
| Preflight: текущая БД = `techaks_prod` | OK | Подключение шло к production DB `techaks_prod` |
| Preflight: PM2 процесс `techaks` | OK | Процесс online |
| Preflight: `/admin/leads` открывается | OK | Страница доступна до rollout |
| Preflight: MySQL доступен | OK | Read-only sanity check выполнен |
| Preflight: место на диске | Warning | На системном разделе около `942 MB` свободно, rollout всё же выполнен после создания backup |
| Backup создан | OK | Полный dump создан до Batch A |
| Batch A применён | OK | Новые nullable/default-safe поля `orders` добавлены |
| Проверка `COUNT(*) orders` после Batch A | OK | Количество заказов не уменьшилось |
| Новые `orders` columns появились | OK | Добавлены все поля из утверждённого Batch A |
| Batch B применён | OK | Новые поля `order_items` добавлены |
| Проверка `COUNT(*) order_items` после Batch B | OK | Количество позиций не уменьшилось |
| Новые `order_items` columns появились | OK | Добавлены все поля из Batch B |
| Batch C применён | OK | `order_history` и `order_comments` созданы |
| Проверка структуры `order_history` | OK | Таблица существует и заполняется |
| Проверка структуры `order_comments` | OK | Таблица существует |
| Batch D | Not Applied | По решению rollout не запускался |

## Smoke results

| scenario | result | notes |
|---|---|---|
| `/admin/leads` | OK | После Batch A/B/C страница открывается |
| Список заказов | OK | Загружается |
| Поиск по ID | OK | Проверен на `#14` |
| Фильтры `status/payment/deliveryType` | OK | Работают |
| Карточка заказа `#14` | OK | Открывается |
| Карточка заказа `#15` | OK | Открывается |
| Карточка legacy-заказа `#11` | OK | Открывается |
| Редактирование клиента/адреса на `#14` | OK | `updateOrderDetails` успешен |
| Изменение количества позиции на `#14` | OK | `updateOrderItemQuantity` успешен, сумма пересчитывается |
| Смена статуса на тестовом заказе | Partial | Для `#18` история записалась; отдельный smoke на `#14` вернул валидатор перехода, потому что заказ уже был в `cancelled` |
| `getOrderHistory` | Partial | История уже пишется в `order_history`, но UI/API в части сценариев продолжает возвращать compatibility warning |
| `addOrderComment` | Partial | Таблица существует, но endpoint всё ещё ушёл в legacy skip-path и не создал запись в `order_comments` |
| `export CSV` | OK | Работает после Batch A/B/C |
| `export XLSX` | OK | Работает после Batch A/B/C |
| `updateOrderDelivery` для `pickup` | OK | Возвращает controlled warning, не падает |
| `updateOrderDelivery` для `delivery` | Partial | Возвращает legacy warning, доставочные новые поля не сохраняет |
| Создание заказа через API | Partial | Заказ создаётся (`#18`), но full modern insert не активировался, сработал fallback |
| Checkout UI через витрину | Not Tested | На этом этапе не проверялся отдельно через витрину |
| PM2 logs | Partial | Критических падений нет, но зафиксированы fallback-ошибки по отсутствующим order columns |
| HTTP 500 / MySQL errors | Partial | Критичных user-facing 500 после rollout не выявлено, но в логах есть SQL errors, которые перехватываются fallback-логикой |

## Errors

### 1. Modern write-path всё ещё упирается в отсутствующие `orders` columns

- Batch: `post-rollout smoke`
- Affected table: `orders`
- Error:
  - `Unknown column 'delivery_service' in 'field list'`
- Где проявилось:
  - `updateOrderDelivery`
  - `placeOrder`
- Вероятная причина:
  - утверждённый Batch A добавляет только часть новых полей `orders`;
  - текущий код в modern path обращается также к дополнительным колонкам:
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
- Решение на текущем этапе:
  - fallback перехватил ошибку;
  - production не упал;
  - legacy compatibility mode продолжает защищать старые сценарии.

### 2. `addOrderComment` не начал писать в `order_comments`

- Batch: `post Batch C`
- Affected table: `order_comments`
- Симптом:
  - API возвращает legacy warning вместо materialized comment row
- Факт:
  - сама таблица существует;
  - запись в `order_comments` через админский сценарий не появилась;
  - в `order_history` при этом появилась запись `comment_skipped_legacy`.
- Вероятная причина:
  - код комментариев продолжает опираться на legacy-ветку даже после additive rollout.

### 3. Smoke по смене статуса на `#14`

- Batch: `post-rollout smoke`
- Affected table: `orders`
- Симптом:
  - attempted invalid transition from `cancelled` to `problem`
- Причина:
  - это не структурная ошибка БД, а невалидный тестовый переход для уже отменённого заказа.

## What was NOT done

Подтверждаю:

- Batch D indexes **не запускался**;
- backfill **не выполнялся**;
- foreign keys **не добавлялись**;
- compatibility mode **не отключался**;
- destructive migrations **не выполнялись**;
- типы существующих колонок **не менялись**;
- `NOT NULL` на новые колонки **не ставился**;
- массовое обновление старых заказов **не выполнялось**.

## Recommendation

### Можно ли оставить production в новом additive-состоянии

Да.

Текущее additive-состояние безопасно:

- новые nullable-колонки и новые таблицы добавлены;
- старые данные не потеряны;
- compatibility mode остаётся рабочим;
- rollback через срочное удаление колонок не требуется и не рекомендуется.

### Нужен ли hotfix

Да, рекомендуется отдельный follow-up hotfix / Phase 3.1:

1. либо расширить additive schema ещё одним безопасным batch для оставшихся `orders`-полей, которые уже ожидает код;
2. либо сузить modern write-path и capabilities gating так, чтобы код не пытался писать в отсутствующие дополнительные `orders` columns.

Без этого rollout остаётся `Partial`, а не полноценным `OK`.

### Можно ли позже планировать Batch D indexes

Да, но отдельно.

Поскольку данных пока мало, Batch D можно отложить и сделать отдельным controlled rollout после стабилизации write-path.

### Когда можно планировать backfill

Только в отдельной фазе после:

- закрытия оставшихся compatibility gaps;
- явного согласования snapshot-стратегии;
- backup;
- smoke-проверки;
- отдельного подтверждения владельца проекта.

## Итог

Controlled production additive rollout по Batch A/B/C выполнен успешно на уровне структуры, но итоговый статус — `Partial`.

Причина:

- структура расширена безопасно;
- история начала материализоваться;
- приложение не упало;
- однако current codebase всё ещё ожидает дополнительные `orders`-колонки, которые не входили в утверждённый Batch A, поэтому часть modern write-path продолжает работать через fallback.

Следующий логичный шаг:

- не трогая данные и не выключая compatibility mode, подготовить маленький follow-up пакет для устранения remaining schema/code mismatch.
