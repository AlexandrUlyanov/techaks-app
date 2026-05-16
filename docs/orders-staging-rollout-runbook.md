# Orders Staging Rollout Runbook

## Назначение

Этот runbook описывает безопасный порядок staging rollout для additive-миграций раздела `Заказы`.

Важно:

- staging only;
- production не трогаем;
- backfill не выполняем;
- `legacy compatibility mode` не отключаем;
- `FOREIGN KEY` не добавляем.

## Before staging rollout

1. Убедиться, что staging-БД является копией production или максимально близка к ней.
2. Снять backup / snapshot staging.
3. Выполнить read-only audit на staging.
4. Сравнить staging audit с production audit.
5. Убедиться, что staging тоже находится в legacy-compatible состоянии.

## Apply on staging only

### Этап 1. Batch A — orders

1. Применить `docs/sql/orders-additive-batch-a-orders.sql`
2. Выполнить post-validation для `orders`
3. Прогнать smoke:
   - список заказов
   - карточка заказа
   - export CSV
   - export XLSX

### Этап 2. Batch B — order_items

1. Применить `docs/sql/orders-additive-batch-b-order-items.sql`
2. Выполнить post-validation для `order_items`
3. Прогнать smoke:
   - карточка legacy-заказа
   - изменение количества позиции
   - пересчёт total

### Этап 3. Batch C — order_history / order_comments

1. Применить `docs/sql/orders-additive-batch-c-history-comments.sql`
2. Выполнить post-validation для новых таблиц
3. Прогнать smoke:
   - `getOrderHistory`
   - `addOrderComment`
   - карточка заказа с history/comments

### Этап 4. Batch D — indexes

1. Применять только после отдельного подтверждения
2. Применить `docs/sql/orders-additive-batch-d-indexes.sql`
3. Перепроверить:
   - скорость списка заказов
   - скорость карточки заказа
   - отсутствие SQL-ошибок

### Этап 5. Final smoke

После всех применённых batch:

- `/admin/leads`
- список заказов
- поиск по ID
- фильтры `status` / `payment` / `deliveryType`
- карточка legacy-заказа
- карточка нового заказа
- изменение статуса
- изменение количества позиции
- export CSV
- export XLSX
- `getOrderHistory`
- `addOrderComment`
- `updateOrderDelivery` для `pickup`
- `updateOrderDelivery` для `delivery`
- создание заказа через prod-like API
- `checkout UI`, если staging-витрина доступна

## Smoke tests after staging rollout

Проверяем руками и/или smoke-скриптом:

1. Открывается ли `/admin/leads`
2. Работает ли поиск по ID заказа
3. Работают ли фильтры
4. Открывается ли legacy-заказ
5. Открывается ли новый заказ
6. Меняется ли статус
7. Меняется ли количество позиции
8. Работает ли CSV export
9. Работает ли XLSX export
10. Возвращает ли `getOrderHistory` данные без fallback warning
11. Работает ли `addOrderComment`
12. Не падает ли `updateOrderDelivery` для `pickup`
13. Не падает ли `updateOrderDelivery` для `delivery`
14. Создаётся ли заказ через prod-like API
15. Если доступна витрина — проходит ли `checkout UI`

## Rollback strategy

### Важный принцип

Так как rollout additive, rollback обычно не должен требоваться.

### Если всё же нужна реакция на проблему

1. Сначала откатываем код на compatibility mode, а не удаляем колонки.
2. `DROP COLUMN` / `DROP TABLE` не выполнять без отдельного решения.
3. Fallback-код должен оставаться включённым.
4. Если проблема связана с индексами — Batch D можно откатить отдельно только после отдельного решения.

## Что не делать

Нельзя:

- применять staging-пакет на production;
- делать backfill в рамках staging rollout;
- отключать compatibility mode;
- добавлять foreign keys;
- пересчитывать исторические суммы;
- массово мигрировать legacy-статусы.
