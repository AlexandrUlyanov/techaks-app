# Operations Index

Дата обновления: 2026-05-16  
Проект: TechAks

## Назначение

Этот документ — единая точка входа в operational-документацию проекта.

Он нужен, чтобы быстро:

- понять текущее состояние production;
- найти актуальные документы по deploy и safety;
- отделить живые документы от исторических rollout-отчётов;
- не путать current state с archival snapshot-материалами.

## Начинать отсюда

Если нужен самый короткий путь в проект:

1. [project-current-status.md](</E:/work/ru/tehax/s/app/docs/project-current-status.md>)
2. [deployment-safety.md](</E:/work/ru/tehax/s/app/docs/deployment-safety.md>)
3. [deploy-pipeline-final-safety-status.md](</E:/work/ru/tehax/s/app/docs/deploy-pipeline-final-safety-status.md>)
4. [admin-operations.md](</E:/work/ru/tehax/s/app/docs/admin-operations.md>)

## Статусы документов

Для rollout-документов по `Orders` и другим фазам используем такую маркировку:

- `current` — актуальный operational source of truth;
- `reference` — полезный рабочий reference;
- `archival` — исторический snapshot, хранится для контекста;
- `draft` — черновик следующей фазы, не выполнять автоматически.

Матрица по orders:

- [orders-documents-status.md](</E:/work/ru/tehax/s/app/docs/orders-documents-status.md>)

## 1. Current project state

- [project-current-status.md](</E:/work/ru/tehax/s/app/docs/project-current-status.md>)  
  Короткая актуальная картина проекта: deploy, orders, product visibility, production state.

## 2. Deploy and DB safety

- [deployment-safety.md](</E:/work/ru/tehax/s/app/docs/deployment-safety.md>)  
  Главные правила: обычный deploy не меняет production-БД.

- [deploy-pipeline-final-safety-status.md](</E:/work/ru/tehax/s/app/docs/deploy-pipeline-final-safety-status.md>)  
  Финальная фиксация безопасного CI/CD pipeline.

## 3. Admin and sync operations

- [admin-operations.md](</E:/work/ru/tehax/s/app/docs/admin-operations.md>)  
  Операционные заметки по админке, товарам, заказам, удалению тестовых данных и sync.

- [sync-epic-plan.md](</E:/work/ru/tehax/s/app/docs/sync-epic-plan.md>)  
  Более широкий reference по развитию sync-направления.

- [sync-fullsync-watchdog-scheduler-tz.md](</E:/work/ru/tehax/s/app/docs/sync-fullsync-watchdog-scheduler-tz.md>)  
  Подробное ТЗ на next phase для full sync watchdog, scheduler settings и operational observability.

- [sync-operations-runbook.md](</E:/work/ru/tehax/s/app/docs/sync-operations-runbook.md>)  
  Практический runbook по эксплуатации нового sync-контура: runtime settings, watchdog, stop flow и stale lock recovery.

## 4. Product visibility

### Current

- [product-visibility-final-production-status.md](</E:/work/ru/tehax/s/app/docs/product-visibility-final-production-status.md>)  
  Текущий production status по visibility-control товаров.

### Historical / execution artifacts

- [product-visibility-backfill-plan.md](</E:/work/ru/tehax/s/app/docs/product-visibility-backfill-plan.md>)  
  Исторический backfill plan. Сейчас важен как reference того, как выполнялся rollout.

SQL-артефакты:

- [product-visibility-backfill-audit.sql](</E:/work/ru/tehax/s/app/docs/sql/product-visibility-backfill-audit.sql>)
- [product-visibility-backfill-apply.sql](</E:/work/ru/tehax/s/app/docs/sql/product-visibility-backfill-apply.sql>)

## 5. Orders — current and reference

### Current / reference

- [orders-phase3-final-production-status.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-final-production-status.md>)
- [orders-phase3-1-followup-result.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-1-followup-result.md>)
- [orders-production-additive-rollout-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-additive-rollout-result.md>)
- [orders-production-readonly-audit-result.md](</E:/work/ru/tehax/s/app/docs/orders-production-readonly-audit-result.md>)

### Historical / planning trail

- [orders-production-stabilization-report.md](</E:/work/ru/tehax/s/app/docs/orders-production-stabilization-report.md>)
- [orders-production-rollout-proposal.md](</E:/work/ru/tehax/s/app/docs/orders-production-rollout-proposal.md>)
- [orders-safe-migration-plan.md](</E:/work/ru/tehax/s/app/docs/orders-safe-migration-plan.md>)
- [orders-phase3-safe-migration-plan.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-safe-migration-plan.md>)

### Batch D / indexes

- [orders-batch-d-production-readiness.md](</E:/work/ru/tehax/s/app/docs/orders-batch-d-production-readiness.md>)
- [orders-batch-d-rollout-runbook.md](</E:/work/ru/tehax/s/app/docs/orders-batch-d-rollout-runbook.md>)
- [orders-non-destructive-index-plan.md](</E:/work/ru/tehax/s/app/docs/orders-non-destructive-index-plan.md>)

Важно:

- документы по Batch D сейчас отражают snapshot до очистки тестовых orders-данных;
- их нужно читать как planning/reference, а не как текущие counts production.

### Draft / future

- [orders-backfill-plan.md](</E:/work/ru/tehax/s/app/docs/orders-backfill-plan.md>)
- [orders-legacy-status-mapping-draft.md](</E:/work/ru/tehax/s/app/docs/orders-legacy-status-mapping-draft.md>)

## 6. SQL artifacts

Orders SQL:

- [docs/sql/orders-readonly-audit.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-readonly-audit.sql>)
- [docs/sql/orders-additive-batch-a-orders.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-additive-batch-a-orders.sql>)
- [docs/sql/orders-additive-batch-a2-remaining-orders-columns.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-additive-batch-a2-remaining-orders-columns.sql>)
- [docs/sql/orders-additive-batch-b-order-items.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-additive-batch-b-order-items.sql>)
- [docs/sql/orders-additive-batch-c-history-comments.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-additive-batch-c-history-comments.sql>)
- [docs/sql/orders-additive-batch-d-indexes.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-additive-batch-d-indexes.sql>)
- [docs/sql/orders-post-rollout-validation.sql](</E:/work/ru/tehax/s/app/docs/sql/orders-post-rollout-validation.sql>)

Product visibility SQL:

- [docs/sql/product-visibility-backfill-audit.sql](</E:/work/ru/tehax/s/app/docs/sql/product-visibility-backfill-audit.sql>)
- [docs/sql/product-visibility-backfill-apply.sql](</E:/work/ru/tehax/s/app/docs/sql/product-visibility-backfill-apply.sql>)

## 7. Product/spec normalization

- [product-spec-normalization.md](</E:/work/ru/tehax/s/app/docs/product-spec-normalization.md>)

## 8. Merchandising and AI badges

- [ai-merchandising-badge-system-tz.md](</E:/work/ru/tehax/s/app/docs/ai-merchandising-badge-system-tz.md>)  
  Подробное ТЗ на следующий уровень merchandising-системы: каталог бейджей, AI category suggestions, assignment engine, review flow и quality layer.

## 9. Reviews and trust layer

- [product-reviews-system-tz.md](</E:/work/ru/tehax/s/app/docs/product-reviews-system-tz.md>)  
  Подробное ТЗ на полноценную систему отзывов: verified purchase, moderation, личный кабинет, ответы магазина и пересчёт рейтинга товара.

## 10. Product page UX

- [product-page-redesign-tz.md](</E:/work/ru/tehax/s/app/docs/product-page-redesign-tz.md>)  
  Подробное ТЗ на redesign карточки товара: decision panel, trust strip, compact availability, key specs, reviews UX и SVG micro-animations.

## 11. Site profile, contacts and legal settings

- [site-profile-and-legal-settings-tz.md](</E:/work/ru/tehax/s/app/docs/site-profile-and-legal-settings-tz.md>)  
  Подробное ТЗ на единый контур контактов, профиля продавца, банковских реквизитов, оферты и правовых текстов с управлением через админку.

## 12. Homepage performance

- [homepage-performance-optimization-tz.md](</E:/work/ru/tehax/s/app/docs/homepage-performance-optimization-tz.md>)  
  Подробное ТЗ на ускорение главной страницы: разгрузка CatalogProvider, единый homepage endpoint, server-side TTL cache, priority rendering и уменьшение initial payload.

## 13. Что сейчас считать source of truth

Если нужен минимальный набор актуальных документов, используем:

1. [project-current-status.md](</E:/work/ru/tehax/s/app/docs/project-current-status.md>)
2. [deployment-safety.md](</E:/work/ru/tehax/s/app/docs/deployment-safety.md>)
3. [admin-operations.md](</E:/work/ru/tehax/s/app/docs/admin-operations.md>)
4. [product-visibility-final-production-status.md](</E:/work/ru/tehax/s/app/docs/product-visibility-final-production-status.md>)
5. [orders-phase3-final-production-status.md](</E:/work/ru/tehax/s/app/docs/orders-phase3-final-production-status.md>)

## 14. Что нельзя делать без отдельного подтверждения

- destructive migrations;
- drop таблиц/колонок на production;
- изменение типов существующих production-колонок;
- массовый backfill как часть обычного deploy;
- `db:push --force` против production;
- отключение compatibility mode;
- любые DB-операции в автоматическом deploy.
