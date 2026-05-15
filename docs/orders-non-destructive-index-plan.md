# Non-destructive index plan for `orders`

Этот план **не применяется автоматически**. Он нужен как безопасный следующий шаг для ускорения списка заказов и карточек без удаления данных и без изменения схемы колонок.

## Что хотим ускорить

- список заказов `/admin/leads`
- фильтрацию по `status`, `payment_status`
- сортировку и пагинацию по `created_at`
- выборки заказов пользователя
- загрузку позиций заказа по `order_id`

## Принципы

- не удаляем существующие индексы
- не добавляем foreign keys
- не меняем типы колонок
- перед применением проверяем, что индекса еще нет
- на production применять в окно низкой нагрузки

## Проверка существующих индексов

```sql
SHOW INDEX FROM orders;
SHOW INDEX FROM order_items;
```

## Рекомендуемые индексы

Если СУБД поддерживает `IF NOT EXISTS`, можно использовать такой вариант:

```sql
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders (payment_status);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);
```

Если `IF NOT EXISTS` не поддерживается, сначала проверить индексы через `SHOW INDEX`, потом применять только отсутствующие:

```sql
CREATE INDEX orders_created_at_idx ON orders (created_at);
CREATE INDEX orders_status_idx ON orders (status);
CREATE INDEX orders_payment_status_idx ON orders (payment_status);
CREATE INDEX orders_user_id_idx ON orders (user_id);
CREATE INDEX order_items_order_id_idx ON order_items (order_id);
```

## Порядок применения

1. Проверить существующие индексы.
2. Снять `EXPLAIN` для медленных запросов списка заказов.
3. Добавить только отсутствующие индексы.
4. Повторить `EXPLAIN`.
5. Проверить:
   - `/admin/leads`
   - открытие карточки заказа
   - оформление нового заказа

## Что нельзя делать без отдельного подтверждения

- добавлять foreign keys
- удалять старые индексы
- перестраивать таблицы
- массово пересчитывать суммы заказов
- выполнять destructive migrations
