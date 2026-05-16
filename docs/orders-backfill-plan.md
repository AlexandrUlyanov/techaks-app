# Orders Backfill Plan

## Назначение

Этот документ описывает только план возможного backfill для раздела `Заказы`.

Backfill в рамках текущего этапа:

- не выполняется;
- не запускается автоматически;
- не должен применяться на production без backup, staging и smoke-проверки.

## Что можно будет backfill-ить позже

Только после отдельного подтверждения можно рассматривать backfill следующих полей:

### Таблица `orders`

- `order_number` для legacy-заказов;
- `subtotal = total_price`;
- `discount_total = 0`;
- `delivery_price = 0`;
- `paid_amount` — только если есть подтверждённый источник данных;
- `source = 'legacy'`;
- `customer_name` / `customer_email` / `customer_phone` — только если источник данных подтверждён.

### Таблица `order_items`

- `total = quantity * price`;
- `product_name` / `image` / `sku` — только по подтверждённой snapshot-стратегии.

## Что нельзя делать автоматически

Нельзя автоматически:

- пересчитывать исторические суммы по новой логике;
- угадывать delivery/payment значения;
- менять старые статусы без карты соответствия;
- делать backfill без backup / staging / smoke-проверки.

## Безопасная стратегия backfill

Если backfill когда-либо будет утверждён, выполнять его нужно так:

1. снять backup / snapshot;
2. проверить SQL на staging;
3. прогнать smoke по разделу `Заказы`;
4. применять батчами;
5. логировать количество затронутых строк;
6. после каждого шага проверять:
   - `listOrders`
   - `getOrderById`
   - `exportOrdersCsv`
   - `exportOrdersXlsx`
   - `updateOrderStatus`

## Что требует отдельного решения

Отдельного подтверждения требуют:

- источник данных для `customer_*`;
- стратегия генерации `order_number`;
- стратегия snapshot-полей `order_items`;
- допустимость заполнения `paid_amount`;
- допустимость массовой миграции старых статусов.

