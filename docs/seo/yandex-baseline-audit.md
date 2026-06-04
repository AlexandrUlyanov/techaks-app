# Baseline Audit для Яндекс SEO

Дата: 2026-06-04  
Проект: Techaks  
Статус: актуализировано после внедрения SEO foundation

## 1. Что уже внедрено

- серверная подстановка `title`, `description`, `canonical`, `robots`, `JSON-LD` для:
  - главной,
  - категорий,
  - брендов,
  - карточек товара,
  - магазинов,
  - контактов,
  - акций,
  - блога,
  - юридических страниц;
- canonical/noindex policy для каталога и служебных страниц;
- `robots.txt` с `Clean-param`;
- `sitemap.xml` + дочерние sitemap:
  - categories,
  - brands,
  - products,
  - promotions,
  - blog,
  - pages,
  - images;
- Yandex verification;
- Yandex Metrika через consent banner;
- ecommerce-события:
  - `view_item`,
  - `add_to_cart`,
  - `begin_checkout`,
  - `reserve_item`,
  - `purchase`;
- SEO health dashboard в админке `/admin/seo`.

## 2. Индексируемые страницы

### Индексируем

- `/`
- `/catalog`
- `/catalog?cat={slug}`
- `/catalog?view=brands`
- `/catalog?view=brands&brand={slug}`
- `/product/{slug}`
- `/stores`
- `/contacts`
- `/promotions`
- `/promotions/{slug}`
- `/blog`
- `/blog/{slug}`
- `/offer`
- `/privacy-policy`
- `/payment-delivery`
- `/returns`

### Не индексируем

- `/checkout`
- `/payment/result`
- `/account`
- `/login`
- `/search`
- `/admin/*`
- фильтрованные/служебные варианты каталога:
  - `sort`
  - `layout`
  - `show`
  - `filter`
  - `limit`

## 3. Основные риски, которые остаются

### P0

- проверить Яндекс Вебмастер после переобхода:
  - нет ли конфликтов canonical;
  - нет ли excluded-страниц среди категорий/товаров/брендов;
- убедиться, что продовая база категорий содержит SEO-поля и они реально редактируются из админки.

### P1

- наполнить SEO title / description для ключевых категорий вручную;
- проверить, какие категории ещё живут только на шаблонной генерации;
- проверить качество сниппетов у акций и брендов.

### P2

- при необходимости перейти от server-head injection к более жёсткому prerender/SSR для SEO-критичных страниц;
- расширить SEO health dashboard отдельной секцией по canonical conflicts и orphan pages.

## 4. Что проверить руками в Яндексе

1. Добавить и перепроверить sitemap в Яндекс Вебмастере.
2. Подтвердить регион `Пенза`.
3. Проверить:
   - главную,
   - 3-5 категорий,
   - 3-5 товаров,
   - 2 бренда,
   - 1 страницу акций,
   - 1 статью блога
   в инструменте “Проверить URL”.
4. Проверить, как Яндекс видит:
   - `canonical`,
   - `robots`,
   - микроразметку,
   - сниппет title/description.

## 5. Метрики baseline/follow-up

Снимать и сравнивать:

- индексируемые страницы;
- исключённые страницы;
- клики из Яндекса;
- CTR категорий;
- CTR товаров;
- доля категорий без SEO title / description;
- доля товаров без бренда / изображения / описания / артикула / штрихкода.
