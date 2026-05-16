# Orders Documents Status

Дата обновления: 2026-05-16  
Проект: TechAks

## Статусы документов

- `current` — актуальный operational source of truth, с него начинаем.
- `reference` — полезный рабочий reference, но не главный входной документ.
- `archival` — исторический след решений и rollout, хранится для контекста, но не должен быть первой точкой входа.
- `draft` — черновик будущей фазы, не применять автоматически.

## Матрица документов

| document | status | purpose | notes |
|---|---|---|---|
| [orders-phase3-final-production-status.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-final-production-status.md>) | current | Финальный production status по Orders | Главный operational статус раздела заказов |
| [orders-production-additive-rollout-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-additive-rollout-result.md>) | reference | Результат controlled additive rollout | Нужен при возврате к деталям rollout |
| [orders-phase3-1-followup-result.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-1-followup-result.md>) | reference | Follow-up по schema/code mismatch | Важен для write-path и compatibility fixes |
| [orders-production-readonly-audit-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-readonly-audit-result.md>) | reference | Read-only audit production schema | Базовый факт о legacy-структуре БД |
| [orders-production-stabilization-report.md](</E:/work/ru/tehax/s/app/docs/orders-production-stabilization-report.md>) | archival | Post-deploy stabilization report | Исторический этап до финального production status |
| [orders-safe-migration-plan.md](</E:/work/ru/tehax/s/app/docs/orders-safe-migration-plan.md>) | reference | Safe migration plan | Можно использовать как основной migration reference |
| [orders-phase3-safe-migration-plan.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-safe-migration-plan.md>) | archival | Ранний Phase 3 migration planning artifact | Держим как trace, но не как основной план |
| [orders-production-rollout-proposal.md](</E:/work/ru/tehax/s/app/docs/orders-production-rollout-proposal.md>) | reference | Proposal controlled production rollout | Полезен для восстановления логики принятия решений |
| [orders-staging-rollout-runbook.md](</E:/work/ru/tehax/s/app/docs/orders-staging-rollout-runbook.md>) | archival | Staging rollout runbook | Сценарий не был основным путём rollout |
| [orders-staging-readonly-audit-result.md](</E:/work/ru/tehax/s/app/docs/orders-staging-readonly-audit-result.md>) | archival | Staging audit result | Нужен только как trace, staging отдельно не использовался |
| [orders-staging-rollout-result.md](</E:/work/ru/tehax/s/app/docs/orders-staging-rollout-result.md>) | archival | Staging rollout result | Фиксирует, что staging rollout был остановлен |
| [orders-staging-indexes-readiness.md](</E:/work/ru/tehax/s/app/docs/orders-staging-indexes-readiness.md>) | archival | Оценка индексов для staging | Исторический вспомогательный документ |
| [orders-backfill-plan.md](</E:/work/ru/tehax/s/app/docs/orders-backfill-plan.md>) | draft | План будущего backfill | Не выполнять без отдельного решения |
| [orders-legacy-status-mapping-draft.md](</E:/work/ru/tehax/s/app/docs/orders-legacy-status-mapping-draft.md>) | draft | Draft по миграции legacy statuses | Не применять автоматически |
| [orders-non-destructive-index-plan.md](</E:/work/ru/tehax/s/app/docs/orders-non-destructive-index-plan.md>) | draft | План отдельных non-destructive индексов | Отдельная будущая фаза |

## Что считать главной точкой входа сейчас

Если нужно быстро понять текущее состояние заказов, читаем в таком порядке:

1. [orders-phase3-final-production-status.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-final-production-status.md>)
2. [orders-production-readonly-audit-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-readonly-audit-result.md>)
3. [orders-production-additive-rollout-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-additive-rollout-result.md>)
4. [orders-phase3-1-followup-result.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-1-followup-result.md>)

## Что не удалять

Даже документы со статусом `archival` сейчас сохраняем:

- они фиксируют sequence решений;
- помогают восстановить ход rollout;
- снижают риск повторить уже пройденные шаги.

То есть сейчас мы делаем не удаление, а аккуратную маркировку.
