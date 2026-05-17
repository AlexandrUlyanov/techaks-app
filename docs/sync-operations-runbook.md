# Sync Operations Runbook

Дата обновления: 2026-05-17  
Проект: TechAks  
Контур: MoySklad / full sync / webhook queue / reconcile / watchdog

## Назначение

Этот документ описывает ежедневную эксплуатацию sync-контура:

- где смотреть текущее состояние;
- как настраивать расписание;
- как отличать живой full sync от зависшего;
- когда использовать `Остановить синхронизацию`;
- когда допустимо использовать `Очистить stale lock`;
- где искать причины ошибок.

## Где работать оператору

Основная страница:

- `/admin/sync/moysklad`

Что теперь видно на этой странице:

- задержка вебхуков;
- количество `failed` и `dead` событий;
- время последней успешной полной синхронизации;
- время последней успешной сверки остатков;
- runtime-настройки scheduler и watchdog;
- текущий active full sync:
  - статус;
  - фаза;
  - heartbeat;
  - counters;
  - offsets;
- lock state;
- queue controls и reconcile controls.

## Основные runtime-настройки

На странице `/admin/sync/moysklad` теперь можно менять:

- включён ли webhook worker;
- интервал webhook worker;
- включена ли reconcile-сверка;
- интервал reconcile;
- включён ли nightly full sync;
- время nightly full sync;
- timezone nightly full sync;
- max duration full sync;
- heartbeat timeout full sync.

Изменения сохраняются в `app_settings`.

## Как понимать живой full sync

Признаки живого full sync:

- `status = running`;
- фаза меняется или counters/offsets растут;
- heartbeat обновляется;
- lock активен и owner совпадает с running run.

Допустимо, что:

- одна и та же фаза держится долго на больших батчах;
- heartbeat не меняется каждую секунду;
- batch offset стоит на месте во время длинной внутренней обработки одной пачки.

## Как понимать зависший full sync

Подозрение на зависание возникает, если:

- heartbeat не обновлялся дольше timeout;
- длительность run уже превысила max duration;
- progress/counters не меняются слишком долго;
- в логах видна повторяющаяся ошибка без движения дальше.

Система сама проверяет это через watchdog раз в минуту.

Если run признан stale:

- `sync_runs.status` переводится в `error`;
- `phase` становится `watchdog_recovered`;
- в `abort_reason` записывается причина;
- при совпадении owner lock снимается.

## Что делает кнопка «Проверить watchdog»

Кнопка запускает manual watchdog cycle:

- проверяет running full sync;
- если всё живо — ничего не меняет;
- если запуск stale — переводит его в `error` и снимает lock при безопасном совпадении owner.

Использовать, когда:

- оператор видит подозрительно долгий run;
- хочется не ждать следующую автоматическую минуту watchdog.

## Что делает кнопка «Остановить синхронизацию»

Это мягкая остановка, не force kill.

Что происходит:

- в `sync_runs.cancel_requested = true`;
- причина записывается в `abort_reason`;
- running full sync видит этот флаг на ближайшей безопасной точке цикла;
- sync завершится через controlled error path.

Использовать, когда:

- нужно завершить sync по окну работ;
- выбран неправильный профиль/настройки;
- оператор видит, что процесс лучше остановить до конца.

## Что делает кнопка «Очистить stale lock»

Это уже более чувствительное действие.

Кнопка:

- не снимает lock безусловно;
- сначала проверяет, есть ли running full sync;
- если running run выглядит живым — действие запрещается;
- если running run stale или вообще отсутствует — lock снимается.

Использовать, когда:

- sync уже явно мёртв;
- lock остался и блокирует новый запуск;
- watchdog ещё не снял его автоматически;
- оператор уже проверил, что активный run не выглядит живым.

## Правильный порядок действий при проблеме

Если full sync выглядит зависшим:

1. Открыть `/admin/sync/moysklad`.
2. Посмотреть:
   - фазу;
   - heartbeat;
   - counters;
   - offsets;
   - lock age.
3. Посмотреть PM2-лог:
   - `pm2 logs techaks`
4. Нажать `Проверить watchdog`.
5. Если sync ещё живой, но нужно завершить — нажать `Остановить синхронизацию`.
6. Если run уже stale и lock не снялся — использовать `Очистить stale lock`.

## Где смотреть технические логи

1. Админка `/admin/sync/moysklad`
2. Таблицы:
   - `sync_runs`
   - `sync_logs`
   - `webhook_events`
   - `app_settings`
3. PM2:
   - `pm2 logs techaks`
4. Файловые логи full sync:
   - `public/logs/sync_*.log`

## Webhook secret

Теперь `moysklad_webhook_secret` управляется через админку:

- `/admin/settings`
- блок `МойСклад`

Использовать один и тот же секрет:

- в админке TechAks;
- в настройке webhook на стороне МойСклад.

Webhook endpoint:

- `https://techaks.ru/api/webhooks/moysklad`

## QA checklist после изменения настроек

После изменения runtime-настроек проверить:

1. Страница `/admin/sync/moysklad` открывается.
2. Runtime settings читаются после перезагрузки страницы.
3. `schedulerLastFullSyncKey` сохраняется и отображается.
4. Запуск ручного full sync работает.
5. Во время full sync обновляются:
   - `phase`
   - `progress`
   - `heartbeat`
6. `Остановить синхронизацию` ставит stop-request.
7. `Проверить watchdog` не ломает живой sync.
8. `Очистить stale lock` не разрешает снимать живой lock.
9. Вебхук secret сохраняется и маскируется в `/admin/settings`.

## Что не делает этот контур

Сейчас этот слой не решает:

- стоп реального HTTP-запроса к внешнему API прямо посреди `await`;
- “убийство” sync без кооперативной остановки;
- универсальный distributed scheduler на несколько приложений/нод;
- детальный progress для каждого подэтапа normalize/reindex на уровне внутренних сущностей.

## Текущий статус

На текущий момент реализованы:

- persisted scheduler settings;
- heartbeat/progress tracking;
- watchdog;
- manual stop request;
- safe stale lock clear;
- UI runtime controls;
- UI live full sync status;
- webhook secret settings в админке.
