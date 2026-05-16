# Orders Production Stabilization Report

## 1. Production status

- Раздел `Заказы` на production работает стабильно.
- Rollback не требуется.
- `legacy compatibility mode` активен и работает корректно.

## 2. Проверенные сценарии

На production были проверены следующие сценарии:

- список заказов;
- поиск по ID;
- фильтры `status` / `payment` / `deliveryType`;
- карточка заказа;
- редактирование клиента и адреса;
- изменение количества позиции;
- смена статуса;
- `getOrderHistory` / `addOrderComment` в `legacy mode`;
- `export CSV` / `export XLSX`;
- frontend diagnostics и compatibility warnings.

## 3. Тестовые заказы

Во время production-проверки были созданы тестовые заказы:

- `#14`
- `#15`

Эти заказы нужно пометить как тестовые или исключить из обработки, чтобы они не попали в рабочий процесс менеджеров и склада.

## 4. Найденный edge-case

Был найден edge-case:

- `updateOrderDelivery` на legacy-заказе с `deliveryType=pickup` возвращал `500`.

## 5. Внесённый фикс

Для legacy-заказов с самовывозом `delivery update` теперь возвращает controlled warning:

> Для заказа с самовывозом статус доставки не применяется. Обновление пропущено.

Это устраняет падение backend и сохраняет безопасное поведение в режиме совместимости.

## 6. Финальный коммит

- `1fcec3d` — `fix(orders): soften legacy pickup delivery updates`

## 7. Оставшиеся ограничения

- `order_history` / `order_comments` отсутствуют в legacy-БД;
- новые delivery-поля не сохраняются в старой схеме;
- `checkout UI` через `/checkout` не проверен из-за `maintenance mode`;
- `legacy mode` — это режим совместимости, а не полноценная новая схема.

## 8. Что проверить после отключения maintenance mode

После отключения `maintenance mode` нужно отдельно проверить:

- оформление заказа через `/checkout`;
- `success flow`;
- переход пользователя к подтверждению;
- клиентский frontend mutation path `placeOrder` через браузер.

## 9. Что нельзя делать без отдельного подтверждения

- destructive migrations;
- удаление таблиц / колонок;
- изменение типов колонок;
- массовая миграция legacy-статусов;
- пересчёт исторических сумм;
- добавление foreign keys на живые legacy-таблицы;
- массовое редактирование старых заказов.
