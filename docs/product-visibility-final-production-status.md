# Product Visibility Final Production Status

Дата фиксации: 2026-05-16  
Окружение: production  
Проект: TechAks

## Итог

Product visibility rollout можно считать завершённым и стабильным.

Подтверждено:

- схема `products` расширена полями visibility-control;
- controlled backfill выполнен;
- публичный сайт скрывает zero-price / invalid-price товары;
- админка продолжает видеть все товары;
- корзина и checkout защищены на backend;
- sitemap не публикует скрытые товары.

## Какие поля используются

В `products` используются:

- `is_active`
- `is_auto_blocked`
- `auto_block_reason`

Бизнес-правило видимости:

```txt
visibleOnSite = isActive && !isAutoBlocked && price > 0
```

## Что применено

### 1. Additive schema

Применена миграция:

- `0009_product_visibility_controls.sql`

Добавлены поля:

- `is_active`
- `is_auto_blocked`
- `auto_block_reason`

### 2. Controlled backfill

Backfill выполнен отдельно и не был частью обычного deploy.

Логика backfill:

- если `price IS NULL` или `price <= 0`:
  - `is_auto_blocked = 1`
  - `auto_block_reason = 'zero_price'`
- если `price > 0` и причина была `zero_price`:
  - `is_auto_blocked = 0`
  - `auto_block_reason = NULL`

`is_active` backfill не менял.

## Что подтверждено на production

Публично:

- скрытые товары не открываются как доступные товары;
- скрытые товары не попадают в поиск;
- скрытые товары не попадают в sitemap;
- `validateCartItems` удаляет недоступные товары из корзины;
- checkout не создаёт заказ с недоступным товаром.

Админка:

- товары с нулевой ценой не пропадают из admin list;
- администратор видит статус недоступности;
- ручная активность не перезаписывается системой.

## Что НЕ делалось

Подтверждено:

- destructive migrations не выполнялись;
- `is_active` массово не переписывался;
- не выполнялись unrelated DB changes;
- rollout не смешивался с обычным deploy;
- индексы не добавлялись в рамках visibility rollout.

## Operational note

Публичная защита теперь живёт в двух слоях одновременно:

1. в коде выборок и checkout-валидации;
2. в самих данных production через backfill.

Это уменьшает риск рассинхрона между логикой storefront и состоянием БД.

## Вывод

Текущее состояние product visibility можно считать `OK`.

Если цена товара снова станет валидной:

- system autoblock снимется по рабочей логике обновления товара;
- но товар всё равно появится на сайте только если ручной `isActive = true`.
