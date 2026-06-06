# SEO Storefront Crawl Policy

Актуально для `https://techaks.ru` и связанных sitemap/feeds.

## 1. Индексируемые URL

В индекс должны попадать только канонические витринные страницы:

- `/`
- `/catalog`
- `/catalog?cat={categorySlug}`
- `/catalog?view=brands`
- `/catalog?view=brands&brand={brandSlug}`
- `/product/{productSlug}`
- `/stores`
- `/contacts`
- `/about`
- `/promotions`
- `/promotions/{promotionSlug}`
- `/blog`
- `/blog/{postSlug}`
- `/offer`
- `/privacy-policy`
- `/payment-delivery`
- `/returns`

## 2. Неиндексируемые и служебные URL

В индекс не должны попадать:

- `/cart`
- `/checkout`
- `/account`
- `/login`
- `/search`
- любые админские URL

Также не индексируются параметрические дубли каталога:

- `sort`
- `layout`
- `show`
- `limit`
- `filter`
- `price`
- `color`

Для них применяется `noindex` на уровне SEO head и ограничения в `robots.txt`.

## 3. Canonical policy

### Каталог

Каноническими считаются только:

- `/catalog`
- `/catalog?cat={slug}`
- `/catalog?view=brands`
- `/catalog?view=brands&brand={slug}`

Если на странице есть дополнительные параметры (`sort`, `layout`, `show`, `limit`, `filter` и др.), canonical должен указывать на чистый базовый URL раздела без этих параметров.

### Карточка товара

Канонический URL товара:

- `/product/{productSlug}`

Не включаем в canonical:

- `variant`
- `tab`
- hash-якоря

### Поиск

`/search` всегда `noindex`.

## 4. Sitemap policy

Основной индекс:

- `/sitemap.xml`

Дочерние sitemap:

- `/sitemap-categories.xml`
- `/sitemap-products.xml`
- `/sitemap-images.xml`
- `/sitemap-brands.xml`
- `/sitemap-promotions.xml`
- `/sitemap-pages.xml`
- `/sitemap-blog.xml`

Требования:

- все sitemap должны отдавать `200`;
- `lastmod` должен обновляться при изменении сущности;
- в sitemap не должны попадать скрытые, неактивные и служебные страницы.

## 5. robots.txt policy

`/robots.txt` должен:

- разрешать обход канонических storefront-страниц;
- закрывать служебные разделы и дубли по параметрам;
- содержать ссылку на `/sitemap.xml`;
- использовать `Clean-param` для параметрических дублей, где это поддерживается.

## 6. AI / AEO policy

Для AI-навигации и машиночитаемого discovery используется:

- `/llms.txt`

В нем перечисляются:

- ключевые storefront-разделы;
- sitemap-файлы;
- фиды (`Yandex YML`, `VK XML`);
- региональный приоритет сайта.

## 7. Проверка после релиза

После каждого SEO-релиза проверяем:

1. `https://techaks.ru/robots.txt`
2. `https://techaks.ru/sitemap.xml`
3. все дочерние sitemap
4. `https://techaks.ru/llms.txt`
5. категорию без параметров
6. категорию с параметрами (`sort`, `filter`) на предмет `canonical` и `noindex`
7. карточку товара на предмет canonical без `variant/tab`

