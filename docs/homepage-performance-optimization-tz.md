# Homepage Performance Optimization TZ

Дата: 2026-05-20  
Проект: TechAks  
Статус: draft

## 1. Контекст

Главная страница интернет-магазина TechAks стала ощутимо тяжелее на первом заходе.

По текущей реализации:

- клиентский JS bundle для public storefront остаётся большим;
- HomePage собирает данные из большого набора public query;
- глобальный `CatalogProvider` тянет дополнительные данные каталога даже до открытия каталожного меню;
- на первый экран загружается больше данных, чем реально нужно для initial render;
- на сервере нет отдельного агрегированного endpoint и нет server-side cache готового payload главной страницы.

Из-за этого пользователь видит более медленный cold load, чем ожидается для витрины магазина.

## 2. Цель

Сделать так, чтобы главная страница:

1. быстрее открывалась на первом заходе;
2. быстрее показывала первый полезный экран;
3. не загружала тяжёлые каталожные и витринные данные раньше времени;
4. использовала server-side aggregation и cache там, где это уместно;
5. не ломала текущую storefront-логику, SEO, рекомендации и каталог.

## 3. Что считаем проблемой

### 3.1. Тяжёлый initial client payload

Сейчас на первый заход влияют:

- большой JS bundle storefront;
- CSS bundle;
- batched tRPC payload для главной;
- дополнительные запросы на бренды/каталог из `CatalogProvider`;
- внешние шрифты.

### 3.2. Главная собирается из слишком большого числа источников

На HomePage участвуют:

- public site profile;
- maintenance status;
- categories;
- stores;
- banners;
- latest blog posts;
- manufacturers;
- products of the week;
- popular products.

Часть этих данных действительно нужна для главной, но они не агрегированы в один оптимизированный server-side source.

### 3.3. Есть скрытая eager-загрузка из CatalogProvider

`CatalogProvider` поднимается глобально и уже на главной странице запрашивает дополнительные данные для mega-menu каталога, хотя пользователь ещё не открыл каталог.

Это создаёт лишнюю нагрузку:

- на сеть;
- на backend;
- на first render.

### 3.4. Нет server-side cache готового homepage payload

Даже если данные меняются не каждую секунду, главная страница собирается заново, вместо того чтобы отдаваться из краткоживущего cache.

## 4. Наблюдения по текущему состоянию

На момент подготовки ТЗ:

- HomePage использует batched tRPC request для набора homepage query;
- ранее тяжёлая загрузка всего каталога на главной уже была частично убрана;
- в `CatalogProvider` всё ещё есть eager-flow для производителей/брендов по категориям;
- bundle storefront остаётся большим;
- главная не использует отдельный `home.getPageData`.

## 5. Целевая архитектура

Главная страница должна перейти на модель:

1. минимальный client boot payload;
2. lazy catalog side-data;
3. один агрегированный homepage endpoint;
4. server-side TTL cache homepage payload;
5. приоритизация above-the-fold секций;
6. defer/lazy-load secondary sections;
7. последовательная работа над размером public JS bundle.

## 6. Подробный план реализации

### Этап 0. Baseline и замеры

Перед функциональными изменениями нужно зафиксировать baseline.

Что измеряем:

- TTFB главной;
- время до первого полезного экрана;
- время до полной интерактивности;
- размер главного JS bundle;
- размер batched homepage payload;
- количество запросов на cold load;
- наличие скрытых запросов от `CatalogProvider`.

Что фиксируем:

- таблицу “до изменений”;
- сетевой waterfall;
- текущий размер `dist/public/assets/index-*.js`.

### Этап 1. Разгрузка CatalogProvider

#### Цель

Убрать лишние загрузки данных каталога с главной страницы.

#### Что менять

Файл:

- [src/providers/CatalogProvider.tsx](/E:/work/ru/tehax/s/app/src/providers/CatalogProvider.tsx)

#### Что нужно сделать

1. Перестать eagerly загружать тяжёлые данные брендов по категориям на старте приложения.
2. Запрашивать `manufacturer.getByCategories` только когда:
   - пользователь открыл каталог;
   - или реально нужен mega-menu brand content.
3. Проверить, нужен ли `manufacturer.getAll` до открытия каталога.
4. При необходимости разделить данные провайдера на:
   - base category layer;
   - deferred brand layer.

#### Ожидаемый результат

- на главной без открытия каталога больше нет лишнего brand-by-category запроса;
- уменьшается общий initial payload;
- каталог продолжает работать корректно.

### Этап 2. Новый агрегированный homepage endpoint

#### Цель

Собрать данные главной в один оптимизированный backend endpoint.

#### Что добавить

Новый роут:

- `home.getPageData`

Новый backend service:

- `api/lib/homepage-data.ts` или аналогичный файл-сервис

#### Что должен возвращать endpoint

Компактный payload главной:

- `siteProfile`
- `maintenanceStatus`
- `categoriesPreview`
- `weekProducts`
- `popularProducts`
- `stores`
- `banners`
- `latestPosts`
- `featuredManufacturers`

#### Правила

1. Endpoint должен быть view-oriented, а не “универсальным API на всё”.
2. Он должен возвращать только то, что реально используется на главной.
3. Нельзя тянуть полный каталог, полный блог или полный список брендов.
4. Каждая секция должна иметь собственный ограниченный size:
   - категории preview;
   - limited banners;
   - limited posts;
   - limited manufacturers;
   - limited recommended products.

#### Ожидаемый результат

- HomePage перестаёт собирать витрину из большого набора отдельных query;
- появляется единая server-side точка оптимизации и кэширования.

### Этап 3. TTL cache для homepage payload

#### Цель

Снизить latency на повторных запросах и bursts без усложнения инфраструктуры.

#### Что сделать

Для `home.getPageData` добавить краткоживущий server-side cache.

#### Первая безопасная реализация

- in-memory cache в Node-процессе;
- TTL: `120 секунд` как стартовое значение.

#### Поведение

1. Первый запрос собирает payload и кладёт в cache.
2. Повторные запросы в пределах TTL получают cache-hit.
3. По истечении TTL payload пересобирается.

#### Что дополнительно сохранить

- `generatedAt`
- `expiresAt`
- debug flag cache hit/miss для внутренней диагностики

#### Важный компромисс

Данные на главной могут устаревать на 1–2 минуты. Для storefront это допустимо.

### Этап 4. Приоритизация above-the-fold

#### Цель

Сделать так, чтобы пользователь быстрее видел полезный верх экрана.

#### Что считать критическим

Критичные секции:

- hero;
- категории;
- товары недели;
- при необходимости 1–2 промо-блока.

Некритичные секции:

- магазины;
- отзывы;
- блог;
- популярные товары;
- блок брендов.

#### Что сделать

1. Отрисовывать критический слой первым.
2. Secondary sections не должны задерживать первый полезный экран.
3. При необходимости использовать:
   - deferred rendering;
   - lazy hydration;
   - intersection-driven loading;
   - отдельные skeleton states.

### Этап 5. Разделение homepage data на critical и secondary

Если одного агрегированного endpoint окажется недостаточно по perceived performance, добавить второй уровень.

Варианты:

- `home.getCriticalData`
- `home.getSecondaryData`

Или:

- один endpoint с двумя логическими блоками, где secondary секции рендерятся после first paint.

Решение принимать после замеров этапов 1–4.

### Этап 6. Bundle optimization

#### Цель

Уменьшить вес JS, который нужен главной странице на первом заходе.

#### Что смотреть

1. Что попадает в основной storefront chunk.
2. Какие компоненты и зависимости можно вынести в lazy imports.
3. Не тянется ли на public storefront тяжёлый код, который нужен только:
   - в админке;
   - в редких секциях;
   - в страницах ниже fold.

#### Кандидаты на lazy split

- blog preview section;
- reviews block;
- manufacturer showcase;
- тяжёлые carousel-related sections;
- отдельные второстепенные presentational blocks.

#### Ограничение

Не делать агрессивный split без контроля UX. Нам нужен выигрыш в скорости, а не мерцание интерфейса.

### Этап 7. Query tuning и refetch policy

#### Цель

Уменьшить лишние повторные загрузки данных.

#### Что проверить

- `staleTime`
- `gcTime`
- `refetchOnWindowFocus`
- `refetchOnMount`
- `retry`
- placeholder/skeleton strategy

#### Принцип

Это secondary optimization. Главный выигрыш всё равно даст архитектурное упрощение data flow.

### Этап 8. Static assets и delivery

#### Цель

Убедиться, что статика главной отдается стабильно и предсказуемо.

#### Что проверить

- cache headers для hashed assets;
- отсутствие битых asset rollout;
- отсутствие дублирующих asset-деревьев;
- стабильная отдача CSS/JS после deploy;
- отсутствие лишних large assets на главной.

### Этап 9. Инфраструктурные guardrails

Главная страница особенно чувствительна к проблемам production rollout.

Нужно дополнительно учесть:

1. На сервере должен оставаться безопасный запас диска.
2. Обычный deploy не должен оставлять битые asset references.
3. Если используется server-side cache, он не должен ломать healthcheck и запуск приложения.

## 7. Что не делать в первой фазе

В первой фазе не нужно:

- переписывать весь storefront на SSR;
- переводить весь сайт на новый router/runtime;
- строить сложный distributed cache;
- добавлять Redis только ради главной;
- тащить агрессивный edge-caching без проверки текущей архитектуры;
- одновременно менять весь дизайн главной.

## 8. Файлы и зоны, которые с высокой вероятностью будут затронуты

Frontend:

- [src/pages/HomePage.tsx](/E:/work/ru/tehax/s/app/src/pages/HomePage.tsx)
- [src/providers/CatalogProvider.tsx](/E:/work/ru/tehax/s/app/src/providers/CatalogProvider.tsx)
- [src/providers/trpc.tsx](/E:/work/ru/tehax/s/app/src/providers/trpc.tsx)

Backend:

- [api/router.ts](/E:/work/ru/tehax/s/app/api/router.ts)
- [api/routers/product.ts](/E:/work/ru/tehax/s/app/api/routers/product.ts)
- [api/routers/store.ts](/E:/work/ru/tehax/s/app/api/routers/store.ts)
- [api/routers/banner.ts](/E:/work/ru/tehax/s/app/api/routers/banner.ts)
- [api/routers/blog.ts](/E:/work/ru/tehax/s/app/api/routers/blog.ts)
- [api/routers/manufacturer.ts](/E:/work/ru/tehax/s/app/api/routers/manufacturer.ts)
- новый `api/routers/home.ts`
- новый `api/lib/homepage-data.ts`
- новый `api/lib/homepage-cache.ts` или аналогичный helper

## 9. Поэтапная декомпозиция

### Фаза A. First-load разгрузка

1. Замерить baseline.
2. Убрать eager brand/category side-load из `CatalogProvider`.
3. Снова замерить first load.

### Фаза B. Server aggregation

4. Добавить `home.getPageData`.
5. Перевести `HomePage` на агрегированный payload.
6. Свести homepage-first-load к минимальному количеству query.

### Фаза C. Server cache

7. Добавить TTL cache homepage payload.
8. Зафиксировать cache hit/miss поведение.
9. Снова замерить latency.

### Фаза D. Rendering priority

10. Отделить critical и secondary sections.
11. Внедрить defer/lazy render для below-the-fold.
12. Снова замерить perceived performance.

### Фаза E. Bundle reduction

13. Проанализировать вес chunk-ов.
14. Вынести тяжёлые необязательные блоки в lazy imports.
15. Снова замерить bundle size и cold load.

### Фаза F. QA и rollout

16. Проверить визуально главную страницу desktop/mobile.
17. Проверить каталог после lazy brand loading.
18. Проверить отсутствие regressions по магазинам, товарам недели, баннерам, блогу.
19. Проверить, что deploy и cache не ломают production startup.

## 10. Acceptance criteria

Фаза считается успешной, если:

1. На cold load главной количество и вес обязательных запросов уменьшились.
2. `CatalogProvider` не тянет тяжёлые brand-by-category данные до открытия каталога.
3. Главная может работать через единый `home.getPageData`.
4. Для homepage payload есть server-side TTL cache.
5. Первый полезный экран появляется быстрее, чем до оптимизации.
6. Не сломаны:
   - hero;
   - категории;
   - товары недели;
   - магазины;
   - баннеры;
   - блог;
   - каталог-меню.
7. Production deploy после изменений не создаёт битую статику и не ломает старт приложения.
8. Проект проходит:
   - `npm run check`
   - `npm run build`
   - `npm test`

## 11. Отдельные риски

### Риск 1. Каталог откроется чуть медленнее при первом открытии

Это допустимый tradeoff, если главная перестанет тянуть каталог заранее.

### Риск 2. Homepage cache даёт слегка устаревшие данные

Решается коротким TTL и дальнейшей selective invalidation, если понадобится.

### Риск 3. Один homepage endpoint станет слишком большим

Нужно с самого начала строить его как composition-layer из маленьких helper-функций.

### Риск 4. Слишком агрессивный lazy loading испортит perceived UX

Нужно отложить только truly secondary sections.

## 12. Рекомендуемый порядок выполнения

Если идти прагматично, порядок должен быть таким:

1. разгрузить `CatalogProvider`;
2. собрать `home.getPageData`;
3. добавить TTL cache;
4. разделить critical и secondary rendering;
5. затем уже заниматься bundle reduction.

Это даёт лучший эффект при минимальном риске для storefront.
