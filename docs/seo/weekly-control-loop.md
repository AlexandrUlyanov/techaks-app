# Weekly SEO control loop для Techaks

Дата: 2026-06-14  
Контур: SEO2 — Яндекс + GEO/AEO rollout

## Зачем это нужно

SEO для Techaks больше не должен жить как разовый проект "починили и забыли".
Нужен повторяемый недельный ритм, в котором команда:

- видит технические регрессии раньше, чем они влияют на индекс;
- контролирует YML и коммерческие сигналы как часть операционной витрины;
- держит в фокусе контентный долг по товарам, категориям, брендам и блогу;
- регулярно сверяет storefront с Яндекс Вебмастером и Яндекс Товарами.

## Источники данных

### Внутри Techaks

- `/admin/seo`
  - storefront audit;
  - категории / товары / бренды / блог;
  - коммерческие сигналы;
  - weekly SEO control loop;
- `/admin/feeds`
  - Yandex YML preview;
  - число офферов;
  - предупреждения по данным;
- `/admin/categories`
  - meta title / description / description / image;
- `/admin/products`
  - контентный долг по товарам;
- `/admin/settings`
  - контакты, юрдокументы, seller profile.

### Внешние системы

- Яндекс Вебмастер
  - индекс и исключённые страницы;
  - soft 404;
  - canonical conflicts;
  - региональность;
  - sitemap processing;
- Яндекс Бизнес / Яндекс Товары
  - приём YML;
  - предупреждения и ошибки офферов;
  - консистентность цен и доступности.

## Основные weekly-метрики

### 1. Index & crawl

- число важных индексируемых страниц;
- excluded pages;
- soft 404;
- noindex drift;
- canonical conflicts;
- broken pages / 404 / 5xx на ключевых storefront URL.

### 2. Sitemap health

- `/sitemap.xml` доступен;
- дочерние sitemap доступны;
- sitemap не содержит пустые / скрытые / мусорные страницы;
- в Вебмастере sitemap принят без критичных ошибок.

### 3. Feed health

- число офферов в YML;
- предупреждения по фиду;
- пропуски из-за:
  - нулевой цены;
  - отсутствия картинки;
  - пустой категории;
  - пустого названия;
- vendor/vendorCode/description не расползаются относительно storefront.

### 4. Content debt

- товары без description;
- товары без image;
- товары без article / barcode / brand;
- категории без description / meta title / meta description;
- бренды без description / meta / logo;
- статьи без meta title / meta description / image.

### 5. Commercial / local signals

- контакты, адрес, часы и телефон заполнены;
- в контактах и магазинах явно присутствует Пенза;
- страницы `about`, `contacts`, `payment-delivery`, `returns`, `offer`, `privacy-policy` доступны и содержательны;
- storefront показывает самовывоз, доставку, оплату и гарантию без пустых блоков.

## Контрольные алерты

Нужно реагировать в ту же неделю, если срабатывает хотя бы один пункт:

1. storefront audit показывает новые ошибки по canonical / noindex / title / H1;
2. YML-фид перестал открываться, вернул 5xx или резко потерял офферы;
3. в YML появились новые предупреждения по картинкам / категориям / цене;
4. на ключевых страницах выросло число excluded pages или soft 404;
5. пропал регион / адрес / часы / телефоны на storefront;
6. появились новые скрытые или пустые leaf-категории, которые всё ещё доступны роботу;
7. после релиза changed pages перестали отдавать ожидаемый SSR head.

## Weekly review ritual

Рекомендуемый ритм: 1 раз в неделю, 20-30 минут.

### Шаг 1. Storefront audit

Открыть `/admin/seo` и проверить:

- storefront audit;
- YML warnings;
- content debt;
- commercial signals.

### Шаг 2. Яндекс Вебмастер

Проверить:

- excluded pages;
- soft 404;
- последние ошибки обхода;
- регион сайта;
- свежесть sitemap.

### Шаг 3. Фид

Открыть `/admin/feeds` и сверить:

- число офферов;
- предупреждения;
- доступность публичного YML URL;
- корректность нескольких случайных товаров.

### Шаг 4. Контентный долг

Собрать короткий список:

- какие категории и бренды надо дописать;
- какие товарные карточки критично пустые;
- какие страницы требуют коммерческого усиления.

### Шаг 5. Итог недели

Зафиксировать:

- что сломалось;
- что починили;
- что переносим на следующую неделю;
- кто owner по каждому блоку.

## Owner list

### Storefront / SEO engineer

Отвечает за:

- canonical / noindex / schema / sitemap;
- storefront audit;
- SSR/head regressions;
- robots / redirect / 404 hygiene.

### Контент / каталог

Отвечает за:

- descriptions и meta полей;
- brand/category copy;
- FAQ и контентное обогащение;
- качество публичных названий и иерархий.

### Операционный контур / performance / feeds

Отвечает за:

- YML feed health;
- consistency цены/наличия;
- weekly review;
- связь storefront ↔ Вебмастер ↔ Яндекс Товары.

## Definition of Done для weekly-contour

Контрольный контур можно считать внедрённым, если:

- в `/admin/seo` есть weekly SEO control loop;
- в `/admin/seo` видны storefront audit, контентный долг, YML warnings и коммерческие сигналы;
- есть повторяемый шаблон weekly review;
- команда понимает, какие сигналы требуют немедленной реакции;
- owner list зафиксирован и не зависит от памяти одного человека.
