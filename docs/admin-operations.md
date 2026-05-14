# Admin Operations (Current)

Инфраструктурные ограничения прод-сервера:
- `1 vCPU`
- `1 GB RAM`
- `10 GB disk`

## Stores

Page: `/admin/stores`

- Full CRUD for store cards.
- Manual warehouse binding:
  - click `Привязать склад` on a store card;
  - select a MoySklad warehouse from live list;
  - save binding to `stores.ms_id`.
- Card badge shows current binding status.

## Sync (MoySklad)

Page: `/admin/sync`

- Token/login-based authorization support.
- Step-by-step full sync flow:
  1. склады,
  2. категории,
  3. запуск с параметрами (товары/цены/остатки).
- Профили полной синхронизации:
  - несколько профилей (`sync_profiles`);
  - выбор активного профиля;
  - запуск full sync по активному профилю;
  - сохранение snapshot в `sync_runs`.
- Fuzzy store matching by name/address; mapping persisted via `stores.ms_id`.
- Full sync lock:
  - ключ `moysklad_full_sync_lock` в `app_settings`;
  - TTL: 2 часа;
  - параллельный full sync не запускается.
- Sync logs:
  - таблица `sync_logs` + файловый лог в `public/logs`.

### Webhook queue

- Таблица очереди: `webhook_events`.
- Прием: `POST /api/webhooks/moysklad`.
- Включена дедупликация по `provider + event_key`.
- Поддержка секрета:
  - `app_settings.moysklad_webhook_secret`;
  - вход: `x-webhook-secret` / `x-moysklad-secret` / `?secret=...`.
- Фоновая обработка очереди:
  - цикл каждые 60 секунд;
  - статусы: `new -> processing -> done/failed/dead`;
  - backoff: 1m / 5m / 15m / 60m;
  - ручной прогон: `POST /api/webhooks/moysklad/process`.

### Reconcile stocks

- Reconcile остатков (страховка при потере webhook):
  - цикл каждые 30 минут;
  - ручной запуск: `POST /api/sync/moysklad/reconcile`;
  - результат пишется в `sync_runs` с `runType = reconcile`;
  - при активном full sync lock reconcile пропускается.

### Nightly full sync

- Ночной запуск full sync:
  - ежедневно в `03:00` (локальное время процесса);
  - выполняется через системный caller от `super_admin`;
  - использует активный профиль.

### Admin monitoring (sync page)

На `/admin/sync` доступны:
- lock status full sync;
- метрики overview:
  - webhook lag (минуты),
  - `failed` / `dead`,
  - последний успешный full sync,
  - последний успешный reconcile;
- таблица очереди вебхуков;
- manual actions:
  - process queue,
  - retry failed/dead,
  - reconcile now.

## Sync Runbook

### 1) Вебхуки не приходят

Проверка:
1. Есть ли новые записи в `webhook_events`.
2. Совпадает ли секрет (`moysklad_webhook_secret`) и заголовок/параметр.
3. Доходит ли HTTP до `POST /api/webhooks/moysklad`.

Что делать:
1. Исправить секрет/маршрут в настройках МойСклад.
2. Запустить `Reconcile остатков` вручную.
3. Проверить, что очередь снова пополняется.

### 2) Очередь растет (lag увеличивается)

Проверка:
1. Счетчики `new/failed/dead` на `/admin/sync`.
2. Ошибки в `last_error` у `failed/dead`.
3. Жив ли фоновой процесс приложения.

Что делать:
1. Нажать `Обработать очередь`.
2. Для `failed/dead` нажать `Retry selected`.
3. Если проблема по данным МойСклад — сделать `Reconcile остатков`.

### 3) Full sync не стартует

Проверка:
1. Статус lock в админке (`Синхронизация уже выполняется`).
2. Нет ли зависшего процесса после аварии.

Что делать:
1. Подождать истечения TTL lock (2 часа), либо дождаться завершения текущего запуска.
2. Проверить `sync_logs` и `sync_runs` на последний error.

### 4) Ночной sync упал

Проверка:
1. `sync_runs` (`runType=full`, `status=error`) около 03:00.
2. Логи приложения.

Что делать:
1. Запустить full sync вручную из `/admin/sync`.
2. После успешного запуска проверить lag вебхуков и выполнить reconcile при необходимости.

## Merchandising

Page: `/admin/merchandising`

- Product scoring (`Merchandising Score`) for recommendation placements.
- Badge assignment and manual priority.
- Recommended pools used by homepage blocks including popular products.

## Product spec standardization

Page: `/admin/products`

- Key standardization and value standardization.
- Visibility/filterability control for category filters.
- Normalization can move key-value lines from description to specs and rebuild
  filter index.

## AI settings

Page: admin settings area

- API/proxy fields for AI-assisted standardization are configurable.
- Intended for external model routing (for example, Gemini via proxy).
