# ТЗ: Надёжный full sync, watchdog, расписание и наблюдаемость для МойСклад

Дата: 2026-05-17  
Проект: TechAks  
Контур: sync / webhook / reconcile / nightly full sync

## 1. Контекст

В проекте уже реализованы:

- ручной full sync из админки;
- профили синхронизации (`sync_profiles`);
- журнал запусков (`sync_runs`);
- журнал логов (`sync_logs`);
- очередь вебхуков (`webhook_events`);
- worker обработки очереди вебхуков;
- периодическая сверка остатков (`reconcile`);
- ночной автоматический full sync.

Текущее поведение в целом рабочее, но эксплуатационно уязвимо:

- full sync может зависнуть в статусе `running`;
- отсутствует полноценный watchdog/stuck-run supervisor;
- нет глобального timeout на весь full sync;
- нет heartbeat/progress marker для точной диагностики;
- расписание автоматического запуска зашито в коде;
- настройки расписания не управляются через админку;
- секрет вебхука виден в диагностике, но не оформлен как полноценная настраиваемая сущность в UI;
- оператору трудно понять, на каком именно шаге зависла синхронизация.

Это ТЗ описывает целевую безопасную архитектуру следующей фазы.  
На этом этапе документ только фиксирует требования. Код и БД этим документом не меняются.

---

## 2. Проблема

### 2.1. Operational-проблема

Если full sync зависает:

- в `sync_runs` остаётся `status = running`;
- в `sync_logs` остаётся `status = running`;
- lock может ещё держаться или уже устареть;
- админка показывает “В процессе” без точной причины;
- неясно, зависло ли:
  - API МойСклад,
  - получение категорий,
  - получение товаров,
  - пагинация,
  - загрузка картинок,
  - обработка остатков,
  - нормализация описаний,
  - переиндексация характеристик,
  - запись в БД,
  - retry/backoff по rate-limit.

### 2.2. Архитектурная проблема

Сейчас:

- lock есть, но он не равен watchdog;
- scheduler есть, но он не configurable;
- логи есть, но они не дают оператору точку зависания в реальном времени;
- worker-циклы есть, но их параметры жёстко определены в коде.

---

## 3. Цель

Сделать sync-контур production-ready для повседневной эксплуатации.

Нужно:

1. Сохранить текущую архитектуру без грубого переписывания.
2. Добавить управляемое расписание вместо hardcode.
3. Добавить heartbeat и progress-tracking для full sync.
4. Добавить watchdog, который автоматически завершает зависшие full sync.
5. Сделать причину зависания и текущий этап видимыми в админке.
6. Сохранить разделение:
   - full sync;
   - webhook queue;
   - reconcile;
   - manual retry.

---

## 4. Что должно получиться

После внедрения оператор должен уметь:

- видеть, выполняется ли сейчас full sync;
- видеть текущую фазу выполнения;
- видеть время старта, длительность и последний heartbeat;
- видеть текущий прогресс по батчам;
- видеть, где sync завис или упал;
- настраивать расписание ночной full sync через админку;
- настраивать включение/выключение reconcile и интервалы;
- видеть секрет вебхука как полноценную operational-настройку;
- вручную останавливать sync через админку;
- быть уверенным, что зависший sync сам уйдёт в `error`, даже если оператор ничего не сделал.

---

## 5. Термины

### Full sync

Тяжёлая полная синхронизация:

- категории;
- склады;
- товары;
- цены;
- остатки;
- нормализация;
- rebuild индексов характеристик.

### Webhook queue

Очередь событий МойСклад, применяемая асинхронно.

### Reconcile

Периодическая сверка остатков, которая страхует потери вебхуков.

### Lock

Защита от одновременного запуска тяжёлых sync-процессов.

### Heartbeat

Регулярная фиксация “я жив, я дошёл до такого-то этапа”.

### Watchdog

Отдельная проверка зависших запусков, которая:

- ищет застрявшие full sync;
- переводит их в `error`;
- освобождает lock;
- оставляет понятную диагностическую причину.

---

## 6. Текущее состояние (as-is)

### 6.1. Webhook ingestion

Есть endpoint:

- `POST /api/webhooks/moysklad`

Поведение:

- принимает payload;
- валидирует секрет;
- складывает события в `webhook_events`;
- dedupe по `provider + event_key`.

### 6.2. Webhook queue worker

Есть фоновая обработка:

- раз в 60 секунд;
- `processMoyskladWebhookQueue(50)`.

### 6.3. Reconcile

Есть:

- ручной reconcile;
- автоматический reconcile раз в 30 минут;
- reconcile не запускается, если full sync lock ещё валиден.

### 6.4. Nightly full sync

Есть:

- автоматический запуск каждый день в `03:00` server-time;
- расписание жёстко зашито в `api/boot.ts`;
- защита от повторного запуска в ту же минуту делается через in-memory `lastNightlyRunKey`.

### 6.5. Главные слабые места

1. Нет persisted scheduler state.
2. Нет configurable schedule.
3. Нет global timeout на full sync.
4. Нет heartbeat в `sync_runs`.
5. Нет stuck-run watchdog.
6. Нет полной видимости по текущему этапу и offset.
7. Нет operator-level stop action.
8. Нет полноценной UI-настройки webhook secret.

---

## 7. Целевая архитектура (to-be)

Нужно внедрить четыре слоя:

### 7.1. Scheduler settings layer

Настройки расписания должны храниться не в коде, а в БД.

### 7.2. Runtime progress layer

Каждый full sync должен публиковать heartbeat и progress marker.

### 7.3. Watchdog layer

Отдельный фоновой supervisor должен отслеживать stuck sync и завершать их.

### 7.4. Admin observability layer

Админка должна показывать:

- что идёт сейчас;
- где идёт;
- как давно идёт;
- почему остановилось;
- что можно сделать руками.

---

## 8. Требования к данным и настройкам

## 8.1. Настройки в `app_settings`

Нужно ввести отдельные operational keys.

Рекомендуемый набор:

- `moysklad_webhook_secret`
- `moysklad_webhook_worker_enabled`
- `moysklad_webhook_worker_interval_seconds`
- `moysklad_reconcile_enabled`
- `moysklad_reconcile_interval_minutes`
- `moysklad_full_sync_enabled`
- `moysklad_full_sync_time`
- `moysklad_full_sync_timezone`
- `moysklad_full_sync_max_duration_minutes`
- `moysklad_full_sync_heartbeat_timeout_minutes`
- `moysklad_scheduler_last_full_sync_key`
- `moysklad_full_sync_lock`

### Значение ключей

#### `moysklad_webhook_worker_enabled`
- включает/выключает фоновой queue worker.

#### `moysklad_webhook_worker_interval_seconds`
- интервал обработки очереди;
- по умолчанию `60`.

#### `moysklad_reconcile_enabled`
- включает/выключает автоматический reconcile.

#### `moysklad_reconcile_interval_minutes`
- например `30`.

#### `moysklad_full_sync_enabled`
- включает/выключает ночной full sync.

#### `moysklad_full_sync_time`
- формат `HH:mm`, например `03:00`.

#### `moysklad_full_sync_timezone`
- timezone, в которой интерпретируется время запуска;
- например `Europe/Moscow`.

#### `moysklad_full_sync_max_duration_minutes`
- общий hard timeout, например `120`.

#### `moysklad_full_sync_heartbeat_timeout_minutes`
- если heartbeat не обновлялся N минут, run считается зависшим;
- например `10` или `15`.

#### `moysklad_scheduler_last_full_sync_key`
- persisted ключ последнего ночного запуска;
- нужен вместо in-memory `lastNightlyRunKey`, чтобы после рестарта не запускать full sync повторно в ту же минуту.

## 8.2. Расширение `sync_runs`

Нужно добавить в `sync_runs` поля наблюдаемости.

Рекомендуемый набор:

- `phase` — текущая фаза
- `progress_json` — детальный прогресс
- `heartbeat_at` — время последнего heartbeat
- `lock_owner` — owner текущего lock
- `worker_id` — instance/process marker
- `cancel_requested` — флаг ручной остановки
- `abort_reason` — причина аварийного завершения

### Пример `phase`

Допустимые значения:

- `init`
- `categories`
- `stores`
- `products`
- `stocks`
- `normalize`
- `reindex`
- `finalize`

### Пример `progress_json`

```json
{
  "productsOffset": 2500,
  "stocksOffset": 1000,
  "productsProcessed": 2400,
  "stocksProcessed": 5400,
  "currentCategoryMsId": null,
  "currentProductMsId": "xxx",
  "lastAction": "Fetching assortment offset 2500"
}
```

## 8.3. Расширение `sync_logs`

Не обязательно делать сильную нормализацию, но желательно:

- поддержать `phase`;
- поддержать `run_id`;
- поддержать `severity`;
- поддержать `details_json`.

Если это слишком расползается, минимум нужно писать эти данные в `sync_runs.progress_json`.

---

## 9. Требования к full sync runtime

## 9.1. Heartbeat

Full sync обязан регулярно обновлять heartbeat:

- при старте;
- при переходе в новую фазу;
- при каждом батче пагинации;
- при длинных циклах обработки;
- перед финализацией.

Минимум:

- heartbeat не реже, чем раз в `30-60 секунд` активной работы;
- heartbeat должен записывать и `phase`, и `progress_json`.

## 9.2. Progress markers

Для каждой тяжёлой фазы должен быть progress marker:

### Categories
- количество найденных folders;
- текущий folder index;
- текущий `ms_id`.

### Stores
- количество stores;
- текущий store index.

### Products
- текущий `offset`;
- размер батча;
- количество обработанных товаров;
- последний `ms_product_id`.

### Stocks
- текущий `offset`;
- количество обработанных stock rows;
- последний `ms_product_id`.

### Normalize / reindex
- количество обработанных товаров;
- текущий этап;
- конфликтов / moved specs / indexed values.

## 9.3. Runtime cancellation

Full sync должен уметь останавливаться безопасно.

Механика:

- админ выставляет `cancel_requested = true`;
- активный run читает этот флаг между батчами;
- если флаг включён:
  - run завершается как `error` или `cancelled`;
  - lock освобождается;
  - message фиксирует, что запуск отменён вручную.

Важно:

- остановка не должна происходить посреди произвольного SQL-блока;
- проверка флага — между крупными шагами и между пагинированными батчами.

---

## 10. Требования к watchdog

## 10.1. Отдельный background supervisor

Нужен отдельный цикл, например раз в 1 минуту.

Он должен:

1. искать `sync_runs`, где:
   - `run_type = full`
   - `status = running`

2. для каждого проверять:
   - сколько времени прошло с `started_at`;
   - сколько времени прошло с `heartbeat_at`;
   - есть ли lock;
   - совпадает ли `lock_owner`.

## 10.2. Критерии stuck-run

Run считается зависшим, если выполняется хотя бы одно:

1. `NOW() - started_at > max_duration_minutes`
2. `NOW() - heartbeat_at > heartbeat_timeout_minutes`
3. есть `running`, но process умер и heartbeat не обновляется
4. lock отсутствует, а run всё ещё `running`

## 10.3. Действия watchdog

Если run признан зависшим:

- перевести `sync_runs.status = error`;
- записать `abort_reason`;
- заполнить `finished_at`;
- обновить `sync_logs`;
- очистить lock, если он относится к этому run;
- оставить понятное сообщение оператору.

Пример сообщения:

`Синхронизация остановлена watchdog: heartbeat отсутствует более 15 минут на фазе products (offset=2500).`

## 10.4. Защита от ложных срабатываний

Watchdog не должен убивать честно работающий sync.

Поэтому:

- heartbeat должен обновляться в коде достаточно часто;
- timeout должен быть выше реального среднего времени батча;
- watchdog должен использовать оба сигнала:
  - elapsed time,
  - stale heartbeat.

---

## 11. Требования к scheduler

## 11.1. Полный отказ от hardcode-времени

Нужно убрать жёсткое:

- `03:00` в коде;
- in-memory `lastNightlyRunKey`.

## 11.2. Новый scheduler behaviour

Каждую минуту scheduler должен:

1. читать настройки из БД;
2. проверять `moysklad_full_sync_enabled`;
3. вычислять текущее локальное время для `moysklad_full_sync_timezone`;
4. сравнивать с `moysklad_full_sync_time`;
5. смотреть persisted `moysklad_scheduler_last_full_sync_key`;
6. если запуск на сегодня уже был — не запускать;
7. если не был — запускать и сохранять `last_full_sync_key`.

## 11.3. Настраиваемые параметры

Через UI нужно уметь менять:

- включён / выключен ночной full sync;
- время запуска;
- timezone;
- включён / выключен reconcile;
- интервал reconcile;
- включён / выключен webhook worker;
- интервал queue worker;
- max duration full sync;
- heartbeat timeout.

---

## 12. Требования к админке

## 12.1. Блок operational settings

На `/admin/sync` или в `/admin/settings` должен появиться блок настроек:

### Full sync
- включить/выключить ночной запуск
- время запуска
- timezone
- max duration
- heartbeat timeout

### Reconcile
- включить/выключить
- интервал в минутах

### Webhook queue worker
- включить/выключить
- интервал в секундах

### Webhook secret
- задать secret
- очистить secret
- masked preview

## 12.2. Экран текущего запуска

Нужен отдельный блок “Текущая синхронизация”.

Что показывать:

- статус
- тип запуска
- время старта
- длительность
- текущая фаза
- последний heartbeat
- current progress
- lock owner
- last action
- source запуска:
  - manual
  - nightly
  - system

## 12.3. Экран истории запусков

Для `sync_runs` нужно показывать:

- тип запуска
- статус
- startedAt
- finishedAt
- duration
- phase, на которой упал
- abortReason / error message
- ссылку на лог-файл, если он есть

## 12.4. Ручные действия оператора

Должны быть доступны:

- `Запустить full sync сейчас`
- `Сверить остатки`
- `Обработать очередь`
- `Повторить failed/dead события`
- `Остановить текущий full sync`
- `Снять зависший lock`

Важно:

- “снять lock” должно быть отдельным сознательным действием;
- “остановить sync” предпочтительнее, чем просто сломать lock под живым процессом.

---

## 13. Требования к логированию

## 13.1. Sync logs

Для full sync должны логироваться:

- старт;
- получение lock;
- выбор активного профиля;
- переходы между фазами;
- каждый батч пагинации;
- retries/rate limit;
- ошибки API;
- ошибки БД;
- cancellation;
- watchdog abort;
- успешное завершение.

## 13.2. Файловый лог

Файловый лог нужно сохранить, но сделать более полезным:

- префикс `run_id`;
- текущая фаза;
- offset/heartbeat;
- явная отметка об ошибке и последнем progress marker.

## 13.3. PM2 logs

Критичные runtime-ошибки должны оставаться в PM2 logs, но этого недостаточно как единственного источника правды.

Главный operational источник состояния sync должен быть в БД и админке.

---

## 14. Безопасность

## 14.1. Webhook secret

Нужно оформить `moysklad_webhook_secret` как штатную настройку.

Требования:

- хранить в `app_settings`;
- показывать masked;
- уметь обновлять без выкладки кода;
- использовать для:
  - `POST /api/webhooks/moysklad`
  - `POST /api/webhooks/moysklad/process`
  - `POST /api/sync/moysklad/reconcile`

## 14.2. Rate limit

Текущий rate limit webhook endpoint нужно сохранить.

Дополнительно:

- логировать rate-limit rejections в понятном виде;
- в админке можно показывать счётчик последних reject, если это недорого.

## 14.3. Права доступа

Изменение operational sync-настроек должно быть доступно только:

- `admin`
- `super_admin`

Остановка текущего sync и снятие lock — предпочтительно только:

- `super_admin`

---

## 15. Ограничения и non-goals

Это ТЗ **не** требует:

- полной замены текущей sync-архитектуры;
- перехода на внешний cron/orchestrator;
- переписывания webhook-механизма на отдельный сервис;
- миграции на message broker;
- горизонтального масштабирования;
- удаления существующих `sync_logs` / `sync_runs`.

Это эволюционное усиление текущей архитектуры, а не её ломка.

---

## 16. Предлагаемая фаза внедрения

## Phase A — observability foundation

Сделать:

- heartbeat;
- `phase`;
- `progress_json`;
- `heartbeat_at`;
- persisted scheduler last-run key;
- нормальный UI текущего запуска.

## Phase B — scheduler settings

Сделать:

- хранение расписания в `app_settings`;
- UI-настройки времени, timezone, интервалов;
- убрать hardcoded `03:00`.

## Phase C — watchdog

Сделать:

- фоновый stuck-run supervisor;
- автоперевод в `error`;
- безопасный release lock;
- операторские причины остановки.

## Phase D — operator controls

Сделать:

- manual stop current sync;
- manual clear stale lock;
- webhook secret management UI;
- улучшенную историю запусков.

---

## 17. Acceptance criteria

Задача считается выполненной, если:

1. Ночной full sync больше не зависит от hardcoded `03:00` в коде.
2. Расписание full sync настраивается через админку.
3. Timezone запуска настраивается через админку.
4. Включение/выключение nightly full sync настраивается через админку.
5. Интервал reconcile настраивается через админку.
6. Интервал webhook queue worker настраивается через админку.
7. Full sync пишет heartbeat в БД.
8. Full sync пишет phase/progress marker.
9. В админке видно, на каком шаге идёт sync.
10. В админке видно время последнего heartbeat.
11. Есть автоматический watchdog зависших full sync.
12. Зависший full sync автоматически переводится в `error`.
13. Lock автоматически освобождается при watchdog-abort.
14. Есть возможность вручную остановить текущий sync.
15. Есть возможность вручную снять stale lock.
16. Secret вебхука управляется как штатная настройка.
17. Повторный старт после рестарта процесса не создаёт ложный повторный nightly run в ту же минуту.
18. Оператор может понять, на каком offset/этапе зависла синхронизация.
19. PM2 logs остаются вспомогательным источником, но не единственным способом понять состояние sync.
20. Всё это внедрено без разрушения текущих webhook/reconcile/full-sync сценариев.

---

## 18. Риски

### Риск 1. Watchdog убьёт живой sync

Снижение риска:

- heartbeat должен обновляться часто;
- timeout должен быть configurable;
- abort должен опираться на stale heartbeat, а не только на длительность.

### Риск 2. Scheduler запустит sync дважды

Снижение риска:

- persisted `last_full_sync_key`;
- lock owner;
- проверка active running run перед стартом.

### Риск 3. Оператор руками снимет lock у живого процесса

Снижение риска:

- отдельное действие;
- warning в UI;
- prefer “Request stop” over “Force clear lock”.

### Риск 4. Слишком много operational настроек запутают UI

Снижение риска:

- разделить basic и advanced settings;
- дать разумные defaults;
- убрать из basic всё, что редко меняется.

---

## 19. Минимально рекомендуемые defaults

- webhook worker enabled: `true`
- webhook worker interval: `60 sec`
- reconcile enabled: `true`
- reconcile interval: `30 min`
- nightly full sync enabled: `true`
- nightly full sync time: `03:00`
- nightly full sync timezone: `Europe/Moscow`
- full sync max duration: `120 min`
- full sync heartbeat timeout: `15 min`

---

## 20. Что нужно сделать после утверждения этого ТЗ

После согласования следующий шаг:

1. подготовить implementation plan по фазам A/B/C/D;
2. определить additive schema changes;
3. подготовить UI/DB/API change list;
4. только потом переходить к реализации.
