# Operations Index

Дата обновления: 2026-05-15  
Проект: TechAks

## Назначение

Этот документ — единая точка входа в операционную документацию проекта.

Его цель:

- быстро понять текущее состояние production;
- найти актуальные документы по deploy и safety;
- найти все материалы по rollout раздела `Заказы`;
- не искать вручную по десяткам отдельных markdown/sql-файлов.

## Статусы документов

Для документов по `Orders` теперь действует простая маркировка:

- `current` — актуальный operational source of truth;
- `reference` — рабочий справочный документ;
- `archival` — исторический след решений;
- `draft` — черновик будущей фазы.

Сводная матрица статусов:

- [orders-documents-status.md](</E:/work/ru/tehax/s/app/docs/orders-documents-status.md>)

## 1. Текущее production-состояние

### Финальный статус заказов

- [orders-phase3-final-production-status.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-final-production-status.md>)  
  Финальная фиксация production-состояния после push, deploy и smoke-test раздела `Заказы`.

### Финальный статус безопасности deploy pipeline

- [deploy-pipeline-final-safety-status.md](</E:/work/ru/tehax/s/app/docs/deploy-pipeline-final-safety-status.md>)  
  Подтверждает, что обычный deploy больше не должен автоматически менять production-БД.

## 2. Базовые правила безопасности

- [deployment-safety.md](</E:/work/ru/tehax/s/app/docs/deployment-safety.md>)  
  Базовые правила безопасного deploy и обращения с production-БД.

- [admin-operations.md](</E:/work/ru/tehax/s/app/docs/admin-operations.md>)  
  Операционные заметки по админке и ручным действиям.

## 3. Orders — production stabilization и rollout

### Stabilization / post-deploy

- [orders-production-stabilization-report.md](</E:/work/ru/tehax/s/app/docs/orders-production-stabilization-report.md>)  
  Отчёт по стабилизации раздела `Заказы` после deploy.

### Production additive rollout

- [orders-production-additive-rollout-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-additive-rollout-result.md>)  
  Результат controlled additive rollout на production.

### Phase 3.1 follow-up

- [orders-phase3-1-followup-result.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-1-followup-result.md>)  
  Follow-up по устранению оставшегося schema/code mismatch.

## 4. Orders — планирование и migration strategy

### Основные migration plan документы

- [orders-safe-migration-plan.md](</E:/work/ru/tehax/s/app/docs/orders-safe-migration-plan.md>)  
  Основной `reference` migration plan.

- [orders-phase3-safe-migration-plan.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-safe-migration-plan.md>)  
  `archival` planning artifact раннего этапа.

Оба документа относятся к безопасному приведению схемы заказов к новой модели без destructive changes, но как основной reference сейчас лучше использовать `orders-safe-migration-plan.md`.

### Read-only audit и proposal

- [orders-production-readonly-audit-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-readonly-audit-result.md>)  
  Результат read-only production audit.

- [orders-production-rollout-proposal.md](</E:/work/ru/tehax/s/app/docs/orders-production-rollout-proposal.md>)  
  Предложение production rollout strategy.

### Staging-related материалы

- [orders-staging-rollout-runbook.md](</E:/work/ru/tehax/s/app/docs/orders-staging-rollout-runbook.md>)
- [orders-staging-readonly-audit-result.md](</E:/work/ru/tehax/s/app/docs/orders-staging-readonly-audit-result.md>)
- [orders-staging-rollout-result.md](</E:/work/ru/tehax/s/app/docs/orders-staging-rollout-result.md>)
- [orders-staging-indexes-readiness.md](</E:/work/ru/tehax/s/app/docs/orders-staging-indexes-readiness.md>)

Сейчас они нужны главным образом как trace принятия решений, потому что фактический rollout пошёл напрямую на production controlled additive path.

## 5. Orders — будущие фазы

### Backfill

- [orders-backfill-plan.md](</E:/work/ru/tehax/s/app/docs/orders-backfill-plan.md>)  
  План backfill без выполнения.

### Legacy status mapping

- [orders-legacy-status-mapping-draft.md](</E:/work/ru/tehax/s/app/docs/orders-legacy-status-mapping-draft.md>)  
  Draft по маппингу старых статусов в новую модель.

### Индексы

- [orders-non-destructive-index-plan.md](</E:/work/ru/tehax/s/app/docs/orders-non-destructive-index-plan.md>)  
  Отдельный план non-destructive индексов.

## 6. SQL-артефакты Orders

SQL-артефакты лежат в каталоге:

- [docs/sql](</E:/work/ru/tehax/s/app/docs/sql>)

Ключевые файлы:

- [orders-readonly-audit.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-readonly-audit.sql>)
- [orders-additive-batch-a-orders.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-additive-batch-a-orders.sql>)
- [orders-additive-batch-a2-remaining-orders-columns.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-additive-batch-a2-remaining-orders-columns.sql>)
- [orders-additive-batch-b-order-items.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-additive-batch-b-order-items.sql>)
- [orders-additive-batch-c-history-comments.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-additive-batch-c-history-comments.sql>)
- [orders-additive-batch-d-indexes.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-additive-batch-d-indexes.sql>)
- [orders-post-rollout-validation.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-post-rollout-validation.sql>)

## 7. Что сейчас считается source of truth

Если нужна максимально короткая операционная картина проекта на текущий момент, начинаем отсюда:

1. [orders-phase3-final-production-status.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-final-production-status.md>)
2. [deploy-pipeline-final-safety-status.md](</E:/work/ru/tehax/s/app/docs/deploy-pipeline-final-safety-status.md>)
3. [deployment-safety.md](</E:/work/ru/tehax/s/app/docs/deployment-safety.md>)
4. [orders-documents-status.md](</E:/work/ru/tehax/s/app/docs/orders-documents-status.md>)

Если нужен именно полный исторический контекст по rollout заказов:

1. [orders-production-stabilization-report.md](</E:/work/ru/tehax/s/app/docs/orders-production-stabilization-report.md>)
2. [orders-production-readonly-audit-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-readonly-audit-result.md>)
3. [orders-production-additive-rollout-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-additive-rollout-result.md>)
4. [orders-phase3-1-followup-result.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-1-followup-result.md>)
5. [orders-phase3-final-production-status.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-final-production-status.md>)

## 8. Что нельзя делать без отдельного подтверждения

По-прежнему запрещено без отдельного решения:

- запускать destructive migrations;
- удалять таблицы или колонки;
- менять типы существующих колонок;
- выполнять backfill по историческим заказам;
- запускать `Batch D indexes` без отдельного controlled rollout;
- отключать compatibility mode;
- выполнять любые production DB operations как часть обычного deploy.

## 9. Рекомендуемый следующий шаг

Следующий логичный operational step:

- отдельно подготовить controlled plan для `Batch D indexes`;
- не смешивать его с обычным deploy;
- не совмещать индексы с backfill;
- rollout индексов делать только отдельной короткой фазой.
