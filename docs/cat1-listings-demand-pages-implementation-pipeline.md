# CAT1 — Листинги спроса и посадочные страницы каталога

Дата: 2026-06-23  
Milestone: `#44` — `CAT1 - Листинги спроса и посадочные страницы каталога`

## Зачем нужен этот контур

В Techaks ключевой коммерческой страницей становится не абстрактная SEO-страница, а реальный листинг товаров:

- category page;
- brand page;
- promotion listing;
- управляемая `category + 1 filter` page.

Задача CAT1 — перевести эти страницы из набора URL и частных frontend-решений в управляемую систему, где:

- есть единый contract индексируемости;
- бизнес может управлять посадочными страницами через админку;
- спрос и семантика живут в данных, а не в документах;
- storefront остаётся коммерческим и конверсионным;
- weekly control loop можно выполнять регулярно, а не вручную по памяти.

## Базовые GitHub-сущности milestone

У milestone уже есть базовые issues:

- `#171` — эпик по контуру управления листингами спроса;
- `#177` — кластеры спроса и импорт сигналов из поиска;
- `#178` — диагностика дублей и content/demand scoring.

Для полноценной реализации программа milestone была расширена новыми delivery-issues:

- `#212` — `CAT1-401` Контракт индексируемых listing URLs
- `#213` — `CAT1-402` DB foundation для listing pages
- `#214` — `CAT1-403` CRUD API для посадочных страниц
- `#215` — `CAT1-404` Admin UI: Посадочные страницы
- `#216` — `CAT1-405` Storefront integration для content blocks листинга
- `#217` — `CAT1-406` Stabilize price filter and active filters UX
- `#218` — `CAT1-407` Unified product card contract across listings
- `#219` — `CAT1-408` Multi-image hover preview on listing cards
- `#220` — `CAT1-409` Semantic cluster storage and workflow
- `#221` — `CAT1-410` Import search demand signals
- `#222` — `CAT1-411` Catalog-generated cluster suggestions
- `#223` — `CAT1-412` Listing quality dashboard
- `#224` — `CAT1-413` Server-friendly SEO head for listing pages
- `#225` — `CAT1-414` Listing analytics and weekly control loop wiring
- `#226` — `CAT1-415` QA matrix and rollout checklist

## Целевая архитектура

### 1. Типы управляемых листингов

В storefront и backend contract закрепляются 5 типа страниц:

- `category`
- `category_filter`
- `brand`
- `brand_category`
- `promotion_listing`

Бизнес-правила:

- `category` индексируется, если категория публичная и не пустая;
- `category_filter` индексируется только при одном активном фильтре, наличии опубликованной landing-page и достаточном ассортименте;
- `brand` индексируется только при наличии ассортимента и разрешённой брендовой страницы;
- `brand_category` не генерируется автоматически для индексации;
- `promotion_listing` ведётся как отдельный коммерческий тип страницы.

Все остальные URL должны вести себя строго:

- `2+ фильтра` → `noindex`, canonical на базовую категорию;
- `sort`, `view`, `page`, `show_products`, hash и служебные параметры не создают отдельную индексируемую сущность;
- `/search` всегда `noindex`.

### 2. Data layer

Нужны 3 ключевые сущности:

#### `listing_pages`

Хранит управляемые посадочные страницы листингов:

- тип;
- статус;
- canonical/index-mode;
- category/brand/filter binding;
- H1/meta/intro/FAQ/related links;
- priority;
- content score / demand score;
- review timestamps.

#### `semantic_clusters`

Хранит спрос и target-логику:

- query / normalized query;
- intent;
- source;
- target type / target url;
- category / brand / filter mapping;
- demand score;
- decision (`accept/reject/needs_review`);
- priority;
- notes.

#### `listing_page_audit_events`

Хранит все изменения:

- кто изменил;
- что сделал;
- какой payload был сохранён;
- когда произошло действие.

### 3. Unified runtime resolver

Нужен единый backend helper, который по URL листинга возвращает:

- тип страницы;
- можно ли её индексировать;
- canonical;
- `noindex/index`;
- доступные content-blocks;
- structured data;
- связанные категории / бренды / фильтры;
- коммерческие сигналы.

Этот resolver должен использоваться:

- в server-friendly SEO head;
- в storefront listing pages;
- в админском preview.

### 4. Storefront contract

На страницах списков товаров верх страницы остаётся коммерческим:

- breadcrumbs;
- H1;
- count;
- active filters;
- sort;
- view toggle.

Контентные блоки:

- intro показывается только если он короткий и действительно полезный;
- FAQ, related links, related brands и аналогичные блоки выводятся только ниже product grid;
- исключается пустая и дублирующая текстовая “вода”.

Карточки товара должны работать единообразно:

- без движения контента;
- без масштабирования картинки;
- hover только через ring / inner stroke;
- multi-image preview — только на оптимизированных миниатюрах.

Фильтр цены и active filters должны одинаково вести себя в:

- category listings;
- promotions;
- search results.

### 5. Admin layer

Добавляется новый operational contour:

`Админка → SEO и рост`

Подразделы:

1. `Посадочные страницы`
2. `Семантика`
3. `Качество листингов`

#### Посадочные страницы

Должны уметь:

- list / filter / create draft / edit / publish / archive;
- preview `head/canonical/noindex`;
- редактировать H1 / title / description / intro / FAQ / related links;
- показывать quality warnings.

#### Семантика

Должна уметь:

- импортировать CSV/XLSX;
- группировать и нормализовать кластеры;
- привязывать спрос к category / brand / filter;
- принимать решения `accept / reject / needs_review`;
- создавать draft-page прямо из кластера.

#### Качество листингов

Должно показывать:

- категории без meta;
- пустые и тонкие листинги;
- дубли canonical;
- отсутствие картинок;
- конфликтующие target URLs;
- низкий content score;
- недоведённые high-priority pages.

## Delivery pipeline

### Phase A — Foundation Rules

Issues:

- `#171`
- `#212` (`CAT1-401`)
- `#178`

Результат:

- зафиксирован contract индексируемости;
- понятна модель дублей и scoring;
- дальнейшая разработка не расходится между backend, storefront и SEO head.

### Phase B — Data and API

Issues:

- `#213` (`CAT1-402`)
- `#214` (`CAT1-403`)

Результат:

- появляется data-layer для управляемых листингов;
- backend становится основой для админки и storefront.

### Phase C — Admin Management

Issues:

- `#215` (`CAT1-404`)
- `#223` (`CAT1-412`)

Результат:

- бизнес может управлять посадочными страницами сам;
- виден реальный quality debt по листингам.

### Phase D — Storefront Listing Upgrade

Issues:

- `#216` (`CAT1-405`)
- `#217` (`CAT1-406`)
- `#218` (`CAT1-407`)
- `#219` (`CAT1-408`)

Результат:

- листинги становятся визуально стабильными;
- фильтры и карточки не ломают конверсию;
- category/search/promotions ведут себя одинаково.

### Phase E — Semantic Layer

Issues:

- `#177`
- `#220` (`CAT1-409`)
- `#221` (`CAT1-410`)
- `#222` (`CAT1-411`)

Результат:

- появляется управляемый слой спроса;
- команда умеет создавать сильные landing-pages из реальных сигналов поиска.

### Phase F — SEO Runtime and Monitoring

Issues:

- `#224` (`CAT1-413`)
- `#225` (`CAT1-414`)
- `#226` (`CAT1-415`)

Результат:

- листинги получают server-friendly SEO head;
- есть analytics wiring;
- rollout и QA проходят по дисциплинированному чеклисту.

## Definition of Done для milestone `#44`

Milestone считается завершённым, если:

- category pages, brand pages и approved `category+1-filter` pages управляются через админку;
- multi-filter URLs не индексируются;
- листинги storefront визуально стабильны;
- фильтр цены и active filters не ломаются;
- semantic clusters импортируются и ведутся в админке;
- quality dashboard показывает реальные долги;
- server-friendly SEO head работает для key listing pages;
- есть smoke / rollout matrix;
- weekly control loop можно выполнять из админки и Яндекс-инструментов.

## Validation stack

Обязательные проверки:

- `npm run check`
- `npm run build`
- `npm test`

Smoke / manual:

- `/catalog?cat=<leaf>`
- `/catalog?cat=<leaf>&<single-filter>`
- `/catalog?cat=<leaf>&<two-filters>`
- `/catalog?view=brands&brand=<slug>`
- `/promotions`
- `/search?q=<query>`
- переход из листинга в товар;
- переключение модификации после перехода из листинга;
- dark theme на category / brand / promotions / search;
- mobile filters и mobile promotions category filter.

SEO validation:

- `curl` HTML category page;
- `curl` HTML approved filter page;
- `curl` HTML non-approved filter page;
- `/robots.txt`;
- `/sitemap.xml`;
- `/sitemap-categories.xml`;
- `/sitemap-products.xml`.

## Почему этот документ важен

Этот документ фиксирует milestone `#44` как реальную delivery-программу.

Его задача — не заменить GitHub issues, а дать команде один понятный execution-map:

- что именно строим;
- в каком порядке;
- где границы фаз;
- по каким критериям считаем работу законченной.
