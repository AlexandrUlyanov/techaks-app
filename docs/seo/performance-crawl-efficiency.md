# Performance и crawl-efficiency для storefront Techaks

Дата: 2026-06-14  
Контур: SEO-214

## Цель

Снизить технические барьеры для mobile-first индексации и ранжирования:

- быстрее отдавать HTML для главной, категории и карточки товара;
- не тянуть below-the-fold секции раньше времени;
- держать изображения адаптивными и предсказуемыми по layout;
- вшить performance-контроль прямо в SEO pipeline, а не держать его отдельным чек-листом.

## Приоритетные URL

1. Главная `/`
2. Категория `/catalog?cat=...`
3. Карточка товара `/product/...`

Именно эти страницы чаще всего участвуют и в поисковом входе, и в первом впечатлении для пользователя.

## Что внедрено

### 1. Storefront performance audit в `/admin/seo`

В SEO dashboard добавлен отдельный блок:

- HTML response time по ключевым storefront URL;
- HTML size по ключевым storefront URL;
- число performance issues;
- live-список high-impact bottlenecks и next actions.

### 2. Deferred-load для secondary sections на главной

Below-the-fold секции главной больше не раскрываются просто по idle-таймеру.
Теперь они открываются:

- при приближении к viewport через `IntersectionObserver`;
- либо по fallback timeout, если пользователь не скроллит.

Это уменьшает раннюю нагрузку на initial render главной.

### 3. Стабильность image layout

Для product card и product gallery теперь используются:

- `width` / `height` из image variants;
- `fetchPriority="high"` для ключевого изображения карточки товара;
- eager/high-priority логика только для действительно критичных media.

Это помогает держать CLS под контролем и не раздувать eager-загрузку.

## High-impact bottlenecks

1. Home secondary bundle нельзя раздувать декоративными секциями без отложенной загрузки.
2. Категории не должны отдавать тяжёлый HTML из-за лишнего текста и расширенных блоков выше фолда.
3. Новые storefront-изображения нельзя бездумно делать eager.
4. Любая hero/витринная зона должна проверяться на mobile-first response и image strategy.

## Правила на будущее

- Всё, что ниже первого экрана, по возможности должно быть deferred.
- Для above-the-fold изображений разрешён eager/high priority только при реальном влиянии на LCP.
- Любое расширение витрины должно проверяться в `/admin/seo` по storefront performance audit.
- Performance regressions считаются SEO-регрессиями, а не только frontend-задачами.

## Definition of Done

Контур SEO-214 считается внедрённым, если:

- в `/admin/seo` есть performance/crawl-efficiency блок;
- главная не тянет secondary sections слишком рано;
- ключевые storefront изображения отдают стабильный layout;
- performance improvements привязаны к SEO-операционке и weekly review.
