# Orders Batch D - Production Readiness

Дата: 2026-05-16  
Окружение: production  
База данных: `techaks_prod`

## Статус документа

Этот документ нужно читать как historical readiness snapshot.

Он фиксирует состояние production на момент, когда:

- структурные order batches уже были применены;
- таблицы `order_history` / `order_comments` уже существовали;
- тестовые заказы ещё не были очищены.

После последующей очистки test orders текущие live counts в production уже отличаются от чисел ниже.

## Важное подтверждение

На момент фиксации этого snapshot:

- production-БД не менялась;
- индексы не создавались;
- `Batch D` не запускался;
- backfill не выполнялся;
- compatibility mode не отключался.

## Snapshot состояния таблиц на момент проверки

Количество строк:

| table | rows |
|---|---:|
| `orders` | 27 |
| `order_items` | 22 |
| `order_history` | 77 |
| `order_comments` | 18 |

## Snapshot состояния индексов

### orders

Сейчас есть только:

- `PRIMARY (id)`
- дополнительный индекс `id (id)`

Отсутствуют:

- `created_at`
- `status`
- `payment_status`
- `user_id`

### order_items

Сейчас есть только:

- `PRIMARY (id)`
- дополнительный индекс `id (id)`

Отсутствует:

- `order_id`

### order_history

Сейчас есть только:

- `PRIMARY (id)`

Отсутствует:

- `order_id`

### order_comments

Сейчас есть только:

- `PRIMARY (id)`

Отсутствует:

- `order_id`

## Исторический вывод

На момент этой проверки `Batch D` действительно был нужен как отдельная performance-phase.

## Current interpretation

Сейчас этот документ полезен как reference:

- какие индексы планировались;
- почему Batch D был вынесен отдельно;
- какой была логика rollout decision.

Но для нового production apply нужно заново снять read-only audit, а не опираться на старые counts из этого snapshot.
