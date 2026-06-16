# Product Visibility Backfill Plan

Дата: 2026-05-16  
Проект: TechAks

## Статус документа

Этот документ больше не является планом следующего шага.

Backfill, описанный здесь, уже был выполнен на production controlled-способом.  
Теперь документ сохраняется как execution reference и trace того, как был подготовлен rollout.

Актуальный current-status документ:

- [product-visibility-final-production-status.md](</E:/work/ru/tehax/s/app/docs/product-visibility-final-production-status.md>)

## Зачем этот документ всё ещё нужен

Он полезен как reference:

- по исходной логике backfill;
- по границам допустимых изменений;
- по read-only audit и apply SQL артефактам;
- по принципу “не трогать `is_active` и не смешивать backfill с deploy”.

## Что описывал этот backfill

### Цель

Синхронизировать исторические строки `products` с новой моделью visibility:

1. поставить `is_auto_blocked = 1` и `auto_block_reason = 'zero_price'` для товаров с невалидной ценой;
2. снять именно эту автоблокировку, если цена снова стала валидной;
3. не трогать `is_active`.

### Что backfill не должен был делать

- менять `is_active`;
- включать вручную отключённые товары;
- трогать другие причины блокировки;
- менять slug/category/specs/descriptions;
- запускаться как часть обычного deploy;
- совмещаться с индексами или другими миграциями.

## Артефакты

Read-only audit:

- [docs/sql/product-visibility-backfill-audit.sql](</E:/work/ru/tehax/s/app/docs/sql/product-visibility-backfill-audit.sql>)

Controlled apply:

- [docs/sql/product-visibility-backfill-apply.sql](</E:/work/ru/tehax/s/app/docs/sql/product-visibility-backfill-apply.sql>)

## Важно

Этот документ теперь нужно читать как historical execution plan, а не как pending task.
