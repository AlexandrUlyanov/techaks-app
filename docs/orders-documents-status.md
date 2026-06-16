# Orders Documents Status

Дата обновления: 2026-05-16  
Проект: TechAks

## Статусы документов

- `current` — актуальный operational source of truth;
- `reference` — полезный рабочий reference;
- `archival` — исторический snapshot rollout или audit;
- `draft` — черновик будущей фазы.

## Матрица документов

| document | status | purpose | notes |
|---|---|---|---|
| [orders-phase3-final-production-status.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-final-production-status.md>) | current | Финальный production status по Orders rollout | Главный operational статус order rollout |
| [orders-phase3-1-followup-result.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-1-followup-result.md>) | current | Follow-up по schema/code mismatch | Важен для modern write-path и capabilities |
| [orders-production-additive-rollout-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-additive-rollout-result.md>) | reference | Результат additive rollout | Полезен для детализации rollout phase |
| [orders-production-readonly-audit-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-readonly-audit-result.md>) | reference | Read-only audit legacy schema | Базовый reference по исходной структуре |
| [orders-production-stabilization-report.md](</E:/work/ru/tehax/s/app/docs/orders-production-stabilization-report.md>) | archival | Ранний stabilization report | Snapshot до финального rollout |
| [orders-safe-migration-plan.md](</E:/work/ru/tehax/s/app/docs/orders-safe-migration-plan.md>) | reference | Safe migration strategy | Основной migration reference |
| [orders-phase3-safe-migration-plan.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-safe-migration-plan.md>) | archival | Ранний planning artifact | Сохраняется как исторический trace |
| [orders-production-rollout-proposal.md](</E:/work/ru/tehax/s/app/docs/orders-production-rollout-proposal.md>) | reference | Proposal controlled rollout | Нужен для восстановления логики rollout decision |
| [orders-staging-rollout-runbook.md](</E:/work/ru/tehax/s/app/docs/orders-staging-rollout-runbook.md>) | archival | Staging runbook | Staging path фактически не стал главным |
| [orders-staging-readonly-audit-result.md](</E:/work/ru/tehax/s/app/docs/orders-staging-readonly-audit-result.md>) | archival | Staging audit result | Historical trace |
| [orders-staging-rollout-result.md](</E:/work/ru/tehax/s/app/docs/orders-staging-rollout-result.md>) | archival | Staging rollout result | Historical trace |
| [orders-staging-indexes-readiness.md](</E:/work/ru/tehax/s/app/docs/orders-staging-indexes-readiness.md>) | archival | Staging indexes readiness | Historical trace |
| [orders-batch-d-production-readiness.md](</E:/work/ru/tehax/s/app/docs/orders-batch-d-production-readiness.md>) | reference | Batch D readiness snapshot | Counts в документе относятся к моменту до очистки тестовых orders |
| [orders-batch-d-rollout-runbook.md](</E:/work/ru/tehax/s/app/docs/orders-batch-d-rollout-runbook.md>) | draft | Controlled rollout runbook for indexes | Не применять автоматически |
| [orders-backfill-plan.md](</E:/work/ru/tehax/s/app/docs/orders-backfill-plan.md>) | draft | План будущего backfill | Не выполнять без отдельного решения |
| [orders-legacy-status-mapping-draft.md](</E:/work/ru/tehax/s/app/docs/orders-legacy-status-mapping-draft.md>) | draft | Draft по legacy status mapping | Не применять автоматически |
| [orders-non-destructive-index-plan.md](</E:/work/ru/tehax/s/app/docs/orders-non-destructive-index-plan.md>) | draft | План отдельных non-destructive индексов | Отдельная future phase |

## Как читать эти документы сейчас

Если нужно понять orders быстро, читаем так:

1. [orders-phase3-final-production-status.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-final-production-status.md>)
2. [orders-phase3-1-followup-result.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-1-followup-result.md>)
3. [orders-production-additive-rollout-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-additive-rollout-result.md>)
4. [orders-production-readonly-audit-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-readonly-audit-result.md>)

## Важная оговорка

После последующей очистки тестовых order-данных:

- текущие live counts в production уже не равны некоторым старым rollout snapshot-документам;
- это не ошибка документации, а естественный эффект того, что historical docs фиксируют состояние “на тот момент”.
