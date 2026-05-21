# Sync Epic Plan (MoySklad)

## Epic
**Название:** `SYNC-EPIC: Надежная синхронизация каталога/цен/остатков + вебхуки`  
**Цель:** сохранить конфиг полной синхронизации, перевести дневную актуализацию на вебхуки, оставить full/reconcile как страховку.  
**Актуальная production-конфигурация сервера:** `2 vCPU / 2 GB RAM / 38 GB disk`.

Актуальное подробное ТЗ на следующую operational фазу:

- [sync-fullsync-watchdog-scheduler-tz.md](</E:/work/ru/tehax/s/app/docs/sync-fullsync-watchdog-scheduler-tz.md>)
- [sync-operations-runbook.md](</E:/work/ru/tehax/s/app/docs/sync-operations-runbook.md>)

---

## Milestones

## Статус реализации (на текущий момент)

- `SYNC-101` done
- `SYNC-102` done
- `SYNC-103` done
- `SYNC-104` done
- `SYNC-201` done
- `SYNC-202` done
- `SYNC-203` done
- `SYNC-204` partial (обрабатываются stock-события; расширение event coverage — next)
- `SYNC-301` done
- `SYNC-302` done
- `SYNC-303` done
- `SYNC-304` done
- `SYNC-401` done
- `SYNC-402` done
- `SYNC-403` done (runbook добавлен в `docs/admin-operations.md`)
- `SYNC-410` done
- `SYNC-411` done
- `SYNC-412` done
- `SYNC-413` done
- `SYNC-414` done
- `SYNC-415` done
- `SYNC-416` done
- `SYNC-417` done
- `SYNC-418` done

## M1 — Profiles + Full Sync Runtime
**Срок:** 3-5 дней  
**Результат:** конфиг полной синхронизации сохраняется и переиспользуется.

### Issues

1. **[SYNC-101] DB: таблицы профилей и запусков синхронизации**
   - Добавить `sync_profiles`
   - Добавить `sync_runs`
   - Добавить индексы по `provider`, `is_default`, `started_at`
   - AC:
     - Миграции применяются без потери данных
     - Можно хранить несколько профилей

2. **[SYNC-102] API: CRUD профилей синхронизации**
   - `syncProfile.list/create/update/delete/setActive`
   - Валидация: хотя бы 1 склад для stock-sync
   - AC:
     - Активный профиль ровно один
     - Роли: admin/super_admin

3. **[SYNC-103] Admin UI: экран профилей синхронизации**
   - Multi-select складов
   - Tree-select категорий
   - Флаги (`syncProducts/syncPrices/syncStocks/...`)
   - AC:
     - Сохранение профиля с восстановлением при перезагрузке страницы

4. **[SYNC-104] Full Sync: запуск из активного профиля**
   - Изменить `runSync`, чтобы брал профиль по умолчанию
   - Добавить runtime override без сохранения
   - AC:
     - “Запустить сейчас” работает без ручного выбора
     - `sync_runs` фиксирует входной snapshot конфига

---

## M2 — Webhook Ingestion + Queue
**Срок:** 4-6 дней  
**Результат:** события МойСклад принимаются и обрабатываются асинхронно, идемпотентно.

### Issues

5. **[SYNC-201] DB: очередь webhook событий**
   - Таблица `webhook_events`
   - Поля: `provider,event_type,event_key,payload_json,status,attempts,last_error,processed_at`
   - Уникальный индекс: `provider + event_key`
   - AC:
     - Дубликаты не создаются

6. **[SYNC-202] Endpoint: /api/webhooks/moysklad**
   - Быстрый ACK (`200`)
   - Валидация payload schema
   - Проверка секрета/подписи (если доступно)
   - AC:
     - Событие попадает в `webhook_events` со статусом `new`

7. **[SYNC-203] Worker: обработка очереди webhook_events**
   - Статусы `new -> processing -> done/failed/dead`
   - Backoff retries: 1m/5m/15m/1h
   - AC:
     - После N попыток уходит в `dead`
     - Логи ошибок сохраняются

8. **[SYNC-204] Webhook handler: остатки по складам**
   - Маппинг `ms_product_id -> product.id`
   - Маппинг `ms_store_id -> store.id`
   - Upsert `product_stocks`
   - Пересчет `products.in_stock`
   - AC:
     - Изменение остатка видно на витрине <= 3 минут

---

## M3 — Reconcile Jobs + Locks + Observability
**Срок:** 3-4 дня  
**Результат:** авто-восстановление при пропуске вебхуков, понятный мониторинг.

### Issues

9. **[SYNC-301] Scheduler: reconcile stocks (каждые 15-30 минут)**
   - Выборка измененных товаров
   - Сверка остатков с MS
   - AC:
     - Устраняет рассинхрон при потере webhook

10. **[SYNC-302] Scheduler: nightly full sync (03:00)**
    - Запуск по активному профилю
    - Опциональный rebuild spec index
    - AC:
      - Ночной запуск не конфликтует с дневными задачами

11. **[SYNC-303] Locking: запрет параллельных тяжелых sync**
    - Глобальный lock (`sync_lock`) с TTL
    - AC:
      - Два full sync одновременно не стартуют

12. **[SYNC-304] Admin Monitoring: runs/events/errors**
    - Виджеты:
      - последний successful run
      - lag вебхуков
      - события `failed/dead`
    - AC:
      - Есть ручной `retry` для dead-события

---

## M4 — Hardening + Security + Performance
**Срок:** 2-3 дня  
**Результат:** production-ready контур.

### Issues

13. **[SYNC-401] Security hardening для webhook**
    - Подпись/секрет
    - Rate limit endpoint
    - Audit log
    - AC:
      - Неавторизованные события не обрабатываются

14. **[SYNC-402] Performance tuning (сервер 2/2/38)**
    - Ограничить batch sizes
    - Снизить memory spikes
    - Ленивая обработка больших payload
    - AC:
      - Без OOM на full sync

15. **[SYNC-403] Runbook + аварийные инструкции**
    - “Вебхуки не идут”
    - “Очередь растет”
    - “Ночной sync упал”
    - AC:
      - Документация в `docs/admin-operations.md`

---

## Dependencies

- `SYNC-101` -> `SYNC-102` -> `SYNC-103` -> `SYNC-104`
- `SYNC-201` -> `SYNC-202` -> `SYNC-203` -> `SYNC-204`
- `SYNC-203` + `SYNC-204` -> `SYNC-301`
- `SYNC-104` -> `SYNC-302`
- `SYNC-301` + `SYNC-302` -> `SYNC-304`
- `SYNC-303` параллельно с `SYNC-301/302`

---

## Labels (GitHub)

- `epic:sync`
- `area:backend`
- `area:admin-ui`
- `area:db`
- `area:infra`
- `priority:p0` / `priority:p1`
- `risk:data-consistency`
- `needs-migration`

---

## Definition of Done (Epic)

1. Активный профиль синхронизации хранится и используется по умолчанию.
2. Дневные изменения остатков доходят через вебхуки в течение 1-3 минут.
3. Потери событий компенсируются reconcile-job.
4. Ночной full sync стабильно отрабатывает по расписанию.
5. В админке есть прозрачный мониторинг запусков и ошибок.
6. На сервере 2/2/38 задачи не вызывают деградацию сайта.

---

## Suggested rollout

1. `M1` -> релиз.
2. `M2` на staging + нагрузочный тест событий -> релиз.
3. `M3` -> релиз.
4. `M4` -> финальный production hardening.

---

## Реализованные endpoint'ы и задачи

### Webhook ingestion
- `POST /api/webhooks/moysklad` — прием и дедупликация событий.
- `POST /api/webhooks/moysklad/process` — ручной прогон очереди.

### Reconcile and jobs
- `POST /api/sync/moysklad/reconcile` — ручной reconcile остатков.
- Queue worker: раз в 60 сек.
- Reconcile worker: раз в 30 мин.
- Nightly full sync: ежедневно в 03:00.

### tRPC (admin)
- `sync.listProfiles`
- `sync.upsertProfile`
- `sync.setActiveProfile`
- `sync.deleteProfile`
- `sync.getSavedConfig`
- `sync.saveConfig`
- `sync.runSync`
- `sync.getSyncLockStatus`
- `sync.getWebhookQueueStats`
- `sync.processWebhookQueue`
- `sync.retryWebhookEvents`
- `sync.runStocksReconcile`
- `sync.getRecentReconcileRuns`
- `sync.getSyncOverview`
