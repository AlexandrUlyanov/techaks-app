# Rollout checklist для Яндекс SEO

Дата: 2026-06-04  
Проект: Techaks

## Перед выкладкой

- [x] Проверить сборку `npm run build`
- [x] Проверить canonical/noindex policy в коде
- [x] Проверить `robots.txt`
- [x] Проверить `sitemap.xml`
- [x] Проверить дочерние sitemap:
  - [x] categories
  - [x] brands
  - [x] products
  - [x] promotions
  - [x] blog
  - [x] pages
  - [x] images
- [x] Проверить server-side SEO head для:
  - [x] home
  - [x] category
  - [x] brand
  - [x] product
  - [x] stores
  - [x] contacts
  - [x] promotions
  - [x] blog
  - [x] legal
- [x] Проверить server-friendly HTML fallback для основного контента:
  - [x] H1 и хлебные крошки
  - [x] краткий контент категории / бренда / товара
  - [x] листинги магазинов, акций и статей
- [x] Проверить JSON-LD:
  - [x] Product
  - [x] BreadcrumbList
  - [x] Organization / Store
  - [x] Article
  - [x] CollectionPage
- [x] Проверить Yandex Metrika consent flow
- [x] Проверить ecommerce-события

## После выкладки

- [ ] Перепроверить HTML head на проде для нескольких типов страниц
- [ ] Пробежать руками:
  - [ ] `/`
  - [ ] `/catalog`
  - [ ] `/catalog?cat=...`
  - [ ] `/catalog?view=brands&brand=...`
  - [ ] `/product/...`
  - [ ] `/promotions`
  - [ ] `/promotions/...`
  - [ ] `/blog`
  - [ ] `/blog/...`
  - [ ] `/stores`
  - [ ] `/contacts`
- [ ] Проверить, что служебные страницы `noindex`
- [ ] Проверить, что фильтрованный каталог canonical-ится в базовую категорию
- [ ] Проверить, что Yandex Webmaster видит новую карту сайта
- [ ] Проверить регион `Пенза`

## Мониторинг после релиза

### День 1

- [ ] проверить ошибки обхода в Вебмастере
- [ ] проверить excluded pages
- [ ] проверить, нет ли soft 404
- [ ] проверить `/admin/seo`

### Неделя 1

- [ ] сравнить количество индексируемых категорий
- [ ] сравнить количество индексируемых товаров
- [ ] проверить CTR категорий и товаров в Яндекс Вебмастере
- [ ] проверить качество сниппетов

## Критерии успешного rollout

- категории больше не схлопываются canonical-ом в общий `/catalog`;
- бренды индексируются как отдельные страницы;
- товары получают корректный canonical и Product schema;
- акции индексируются как отдельный тип посадочных;
- служебные URL не раздувают индекс;
- Яндекс Метрика и ecommerce-события собираются после consent;
- SEO dashboard показывает понятные контентные долги.
