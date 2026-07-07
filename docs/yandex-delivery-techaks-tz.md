# ТЗ: интеграция Яндекс Доставки (Taxi Business API) в Techaks

Дата: 2026-07-07  
Проект: Techaks  
Контур: checkout, заказы, админка, доставка, операционные статусы

## 1. Цель

Интегрировать Яндекс Доставку через Taxi Business API в Techaks так, чтобы:

- доставка считалась прямо на checkout;
- заказ в Яндекс создавался из заказа Techaks по управляемым правилам;
- оператор видел весь жизненный цикл доставки в админке;
- покупатель видел понятный статус доставки в личном кабинете;
- система оставалась отказоустойчивой и не создавала дублей при ретраях или сетевых сбоях.

Главный принцип: **Techaks остаётся system of record для заказа**, а Яндекс Доставка становится внешним delivery-provider с прозрачным состоянием, ценой, ETA и idempotent-интеграцией.

## 2. Источники и ограничения

Интеграция проектируется по официальной документации Яндекс Taxi Business API:

- Quickstart
- Route stats
- Order create
- Order progress
- OAuth refresh

Ограничения:

- фронтенд не должен ходить в API Яндекса напрямую;
- OAuth token хранится только на backend;
- все внешние вызовы должны быть журналируемыми без утечки секретов;
- API-ошибки Яндекса не должны ломать checkout целиком;
- повторный запрос создания заказа должен быть безопасным за счёт idempotency.

## 3. Бизнес-сценарии

### 3.1 Основной сценарий

1. Покупатель кладёт товар в корзину.
2. На checkout выбирает `Доставка`.
3. Вводит адрес.
4. Techaks запрашивает у Яндекса расчёт маршрута и получает:
   - стоимость;
   - ETA;
   - доступные классы/тарифы;
   - offer.
5. Покупатель подтверждает заказ.
6. Techaks создаёт внутренний заказ.
7. После успешного создания внутреннего заказа backend создаёт заказ в Яндекс Доставке.
8. В заказе сохраняются:
   - delivery provider = yandex;
   - yandex order id;
   - offer snapshot;
   - цена доставки;
   - ETA;
   - status.
9. Статус доставки дальше обновляется автоматически.

### 3.2 Альтернативный сценарий: самовывоз

Если пользователь выбрал самовывоз:

- интеграция с Яндекс Доставкой не активируется;
- никакие quote/create запросы в Яндекс не выполняются;
- заказ живёт по текущей логике самовывоза.

### 3.3 Ошибка расчёта

Если `routestats` не вернул валидный расчёт:

- checkout не падает;
- пользователю показывается понятное сообщение:
  `Не удалось рассчитать курьерскую доставку. Попробуйте изменить адрес или выберите самовывоз.`
- оператор получает диагностическую запись в admin/audit.

### 3.4 Ошибка создания delivery-order

Если внутренний заказ уже создан, а вызов `orders/create` завершился ошибкой:

- заказ Techaks остаётся валидным;
- у заказа появляется delivery-state `creation_failed`;
- оператор видит кнопку повторной отправки в Яндекс;
- retry выполняется с новым управляемым вызовом, но с правильной защитой от дублей.

### 3.5 Отмена

Если заказ отменён до передачи в доставку:

- Techaks инициирует отмену и в Яндекс;
- в истории заказа сохраняется факт отмены;
- в ЛК покупателя статусы синхронизируются.

## 4. Границы первой фазы

В первую фазу входят:

- расчёт стоимости доставки;
- создание заказа в Яндекс;
- хранение linked delivery-state;
- отображение статусов в админке и ЛК;
- ручной retry / refresh;
- базовая отмена;
- аудит и observability.

Не входят в первую фазу:

- мульти-доставка одним заказом;
- split shipment;
- динамический выбор разных delivery-провайдеров по SLA;
- автоматический перерасчёт на лету по изменению состава после создания delivery-order;
- сложная оркестрация по частичным отгрузкам.

## 5. Архитектура решения

### 5.1 Контуры

Нужны 4 контура:

1. **Admin settings layer**
2. **Checkout quote layer**
3. **Order delivery orchestration layer**
4. **Delivery status sync / operational layer**

### 5.2 Принцип работы

- checkout работает с внутренним backend endpoint `getDeliveryQuote`;
- backend внутри вызывает Яндекс `routestats`;
- после подтверждения заказа backend вызывает Яндекс `orders/create`;
- дальнейшее состояние подтягивается через `order-progress` и/или polling jobs;
- UI в storefront и admin получает только нормализованные внутренние поля.

## 6. Данные и модель

### 6.1 Настройки Яндекс Доставки

Добавить managed settings:

- `enabled`
- `oauth_token_encrypted`
- `oauth_token_last4`
- `oauth_token_set_at`
- `corp_client_id`
- `default_city`
- `default_sender_name`
- `default_sender_phone`
- `default_comment`
- `allow_express`
- `allow_courier`
- `allow_same_day`
- `max_weight_kg`
- `max_order_sum`
- `quote_cache_ttl_sec`
- `status_sync_enabled`
- `status_poll_interval_sec`
- `mode` (`disabled`, `manual`, `auto`)

Секрет:

- хранить только в encrypted виде;
- не отдавать на frontend;
- если нет encryption key, сохранение секрета блокировать так же, как в YooKassa.

### 6.2 Заказ

Расширить модель заказа полями:

- `deliveryProvider` (`none`, `pickup`, `yandex`)
- `deliveryStatus`
- `deliveryExternalId`
- `deliveryServiceLevel`
- `deliveryEtaMinutes`
- `deliveryEtaText`
- `deliveryPrice`
- `deliveryCurrency`
- `deliveryQuoteExpiresAt`
- `deliveryAddressNormalized`
- `deliveryRawLastResponseJson`
- `deliveryLastSyncedAt`
- `deliveryErrorCode`
- `deliveryErrorMessage`
- `deliveryCancellationReason`

### 6.3 Quote snapshot

Для устойчивости quote должен сохраняться как snapshot:

- route;
- input address;
- normalized address;
- chosen tariff/class;
- offer payload;
- toll road flag;
- user-facing price/ETA.

### 6.4 Audit log

Каждое действие по доставке журналируется:

- quote requested
- quote failed
- quote accepted
- delivery create requested
- delivery created
- delivery create failed
- delivery status refreshed
- delivery canceled
- manual retry
- manual force refresh

Без секретов и без raw OAuth token.

## 7. Backend API / service contract

### 7.1 Admin API

Нужны методы:

- `GET admin/settings/yandex-delivery`
- `PUT admin/settings/yandex-delivery`
- `POST admin/settings/yandex-delivery/test-connection`
- `POST admin/settings/yandex-delivery/refresh-token-check`

Если проект уже использует tRPC для админки, реализовать через `trpc.settings.*`.

### 7.2 Checkout API

Нужны методы:

- `POST /api/delivery/yandex/quote`
- `POST /api/delivery/yandex/validate-address` (опционально, если захотим отдельный pre-check)

Ответ quote:

- `available`
- `price`
- `currency`
- `etaMinutes`
- `etaText`
- `serviceLevels[]`
- `selectedServiceLevel`
- `offer`
- `expiresAt`
- `warnings[]`

### 7.3 Order orchestration API

Нужны внутренние методы:

- `createYandexDeliveryForOrder(orderId)`
- `refreshYandexDeliveryStatus(orderId)`
- `cancelYandexDelivery(orderId)`
- `retryYandexDeliveryCreate(orderId)`

### 7.4 Operational API

Для админки заказа:

- `POST admin/orders/:id/delivery/retry`
- `POST admin/orders/:id/delivery/refresh`
- `POST admin/orders/:id/delivery/cancel`

## 8. Интеграция с внешним API Яндекса

### 8.1 Авторизация

Каждый запрос:

- `Authorization: Bearer <token>`
- при необходимости `X-YaTaxi-Selected-Corp-Client-Id`

### 8.2 Расчёт маршрута

Использовать `routestats`:

- origin = магазин / точка отправки;
- destination = адрес клиента;
- route = координаты;
- при необходимости `user_id`;
- requirements по зоне.

Важно:

- расчёт не должен пересоздаваться на каждый ререндер формы;
- нужен debounce;
- нужен короткий server-side cache.

### 8.3 Создание заказа

Использовать `orders/create`.

Обязательные меры:

- `X-Idempotency-Token`
- snapshot offer
- service level/class
- due_date, если нужен отложенный выезд

Если Яндекс вернул stale offer:

- помечаем quote устаревшим;
- просим пересчитать;
- не создаём битый delivery-link.

### 8.4 Статусы

Использовать `order-progress`.

Нужен нормализатор статусов Яндекса в статусную модель Techaks:

- `new`
- `searching`
- `driver_assigned`
- `arriving_to_sender`
- `pickup_in_progress`
- `in_delivery`
- `delivered`
- `cancelled`
- `failed`

Отдельно хранить и raw status, и mapped status.

### 8.5 Отмена

Для cancel нужен отдельный service wrapper.

Даже если cancel API будет ограничен или unavailable по состоянию, оператор должен видеть причину, почему отмена не прошла.

## 9. Checkout UX

### 9.1 Поведение

Если выбран тип `Доставка`:

- появляется адрес;
- после ввода валидного адреса запускается расчёт;
- показывается skeleton;
- затем показываются:
  - стоимость;
  - ETA;
  - выбранный вариант доставки.

### 9.2 Ошибки UX

Ошибки должны быть спокойными:

- `Не удалось рассчитать доставку`
- `Этот адрес сейчас не обслуживается`
- `Для этого заказа доставка временно недоступна`

Никаких сырых API-errors на фронтенде.

### 9.3 Сохранение выбора

При подтверждении заказа должны сохраняться:

- тип доставки;
- адрес;
- quote snapshot;
- выбранный service level.

Если quote просрочен к моменту submit:

- повторно валидируем на backend;
- если цена изменилась, просим подтвердить обновлённую стоимость.

## 10. Админка

### 10.1 Новый раздел

Добавить:

`Админка -> Настройки -> Доставка -> Яндекс Доставка`

Блоки:

1. Основные настройки
2. OAuth token
3. Corp client
4. Отправитель
5. Режимы и тарифы
6. Проверка подключения
7. Последние ошибки
8. Operational notes

### 10.2 В карточке заказа

Показывать:

- провайдер доставки;
- статус доставки;
- ID заказа в Яндекс;
- стоимость доставки;
- ETA;
- дата последней синхронизации;
- ошибки;
- raw summary без секретов.

Кнопки:

- `Обновить статус`
- `Повторить создание`
- `Отменить доставку`

### 10.3 В списке заказов

Для заказов с delivery provider = yandex:

- компактный бейдж статуса;
- цветовая метка;
- фильтр по статусам доставки.

## 11. Личный кабинет покупателя

В истории заказов показывать:

- `Доставка Яндекс`
- текущий статус;
- ETA / ожидаемую дату;
- итоговую стоимость доставки;
- при наличии — понятный progress-text.

Не выводить технические коды и внутренние идентификаторы, кроме случаев, когда это полезно пользователю.

## 12. Выбор магазина-отправителя

Для Techaks это критично, потому что уже есть логика по складам/магазинам.

Нужно определить правило source store:

### Фаза 1

Использовать один заранее выбранный store/source point по умолчанию.

### Фаза 2

Развить до выбора магазина-отправителя:

- по наличию;
- по pickup / delivery geography;
- по operator override.

В ТЗ первой реализации обязательно заложить поле `sourceStoreId`, даже если пока логика простая.

## 13. Безопасность

- токен только encrypted;
- никаких секретов в логах;
- rate-limit admin test connection;
- validate all public inputs;
- маскировать телефоны/адреса в debug logs, если нужно;
- raw JSON ответа хранить осмысленно и ограниченно.

## 14. Надёжность и retry policy

### 14.1 Quote

- короткий timeout;
- 1 controlled retry максимум;
- cache по ключу route+cart signature на короткое время.

### 14.2 Create order

- idempotency token обязателен;
- при 500 повторяем с тем же token;
- при сетевой ошибке помечаем состояние `unknown_create_result`, затем делаем reconciliation.

### 14.3 Status sync

- polling job;
- exponential backoff при ошибках;
- stale delivery detection.

## 15. Observability

Нужны:

- admin audit events;
- delivery integration logs;
- counters:
  - quotes success/fail
  - create success/fail
  - stale offers
  - retry count
  - cancel success/fail
- operational panel в админке позже можно расширить.

## 16. Тестовый режим и rollout

Нужен безопасный rollout:

### Stage A

- settings page;
- test connection;
- backend wrappers;
- без подключения в checkout.

### Stage B

- quote-only режим на checkout;
- без create.

### Stage C

- create delivery order после оформления;
- только для тестовых заказов / ограниченного флага.

### Stage D

- полный rollout.

## 17. Миграции

Все миграции только additive:

- settings storage
- delivery columns в orders
- audit/events таблицы, если нужны отдельно

Rollback strategy:

- UI можно выключить feature-flag;
- старые заказы не ломаются;
- delivery provider null-compatible.

## 18. Definition of Done

Задача считается выполненной, если:

1. В админке есть управляемые настройки Яндекс Доставки.
2. OAuth token хранится зашифрованно.
3. На checkout можно получить расчёт доставки.
4. После оформления заказа создаётся связанный заказ в Яндексе.
5. Повторные запросы не плодят дубли.
6. В админке заказа виден статус доставки и есть ручные действия.
7. В ЛК пользователь видит понятный статус доставки.
8. Ошибки API Яндекса не валят checkout или заказы.
9. Есть аудит и observability.
10. Есть rollout checklist и QA matrix.

## 19. Pipeline реализации

### Phase YD-A — foundation

- settings model
- encrypted token storage
- admin settings UI
- test connection

### Phase YD-B — quote layer

- backend routestats wrapper
- checkout quote UX
- cache / debounce / validation

### Phase YD-C — order creation

- create delivery order
- idempotency
- save snapshot in order
- operator retry

### Phase YD-D — status sync

- progress polling
- admin/manual refresh
- customer-facing status projection

### Phase YD-E — cancel / recovery / QA

- cancel flow
- reconciliation
- rollout runbook
- production acceptance

## 20. Приоритет решений

При конфликте требований приоритет такой:

1. Не плодить дубли заказов в Яндексе
2. Не ломать checkout
3. Не терять внутренний заказ Techaks
4. Давать оператору управляемый recovery path
5. Давать покупателю понятный статус

