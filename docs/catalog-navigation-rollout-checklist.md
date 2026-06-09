# CAT1 Rollout Checklist: каталог как навигационная система

Дата: 2026-06-09

Связанные материалы:
- `docs/catalog-navigation-ux-tz.md`
- `docs/catalog-navigation-execution-pipeline.md`

## Что входит в rollout

- корневая навигация каталога `/catalog?cat=all`
- промежуточные category-landing страницы
- переход к обычной товарной выдаче для leaf-категорий
- secondary shelf ниже навигационного сценария
- SEO / accessibility / analytics для navigation-mode

## QA matrix

### Проверенные маршруты

- root: `/catalog?cat=all`
- parent: `/catalog?cat=krasota-i-zdorove`
- intermediate: `/catalog?cat=uhod-za-polostyu-rta`
- leaf / PLP: `/catalog?cat=yandeks-stantsii`

### Проверенные viewport'ы

| Width | Height | Route | Theme | Статус | Комментарий |
| --- | ---: | --- | --- | --- | --- |
| 1440 | 1200 | `/catalog?cat=all` | light | OK | Дерево слева, карточки справа, без дублей и больших пустот |
| 1440 | 1200 | `/catalog?cat=krasota-i-zdorove` | light | OK | Parent category работает как navigation page |
| 1440 | 1200 | `/catalog?cat=uhod-za-polostyu-rta` | light | OK | Compact layout для малого числа подкатегорий |
| 1024 | 1200 | `/catalog?cat=all` | light | OK | Root navigation сохраняет читаемую сетку |
| 768 | 1024 | `/catalog?cat=all` | light | OK | Планшетная версия без разлома layout |
| 390 | 844 | `/catalog?cat=krasota-i-zdorove` | light | OK | Mobile accordion / stacked navigation |
| 360 | 800 | `/catalog?cat=uhod-za-polostyu-rta` | dark | OK | Dark theme читаемая, карточки и CTA контрастны |

Артефакты QA:
- `output/playwright/catalog-root-1440.png`
- `output/playwright/catalog-parent-1440.png`
- `output/playwright/catalog-intermediate-1440.png`
- `output/playwright/catalog-root-1024.png`
- `output/playwright/catalog-root-768.png`
- `output/playwright/catalog-parent-390-light.png`
- `output/playwright/catalog-intermediate-360-dark-after-consent.png`

## Сценарии, которые проверены

### Навигация

- root catalog показывает дерево и карточки верхнего уровня
- выбор ветки на root переводит в branch-aware navigation flow
- parent category не сваливается сразу в PLP, если есть дочерние категории
- intermediate category в compact mode показывает все дочерние категории без лишнего сайдбара
- leaf category открывает обычную товарную выдачу

### Темы

- light theme: тексты, CTA и карточки читаемы
- dark theme: контраст заголовков, secondary text и category cards сохранён

### SEO / accessibility / analytics

- canonical и meta для navigation pages присутствуют
- structured data: `BreadcrumbList` + `CollectionPage`
- category links crawlable через `Link`, а не только JS-кнопки
- nav / sidebar / accordion получили aria-подписи
- метрика кликов по категориям и CTA заведена через Yandex goals

### Empty / loading / error states

Проверены по коду и runtime-веткам:

- loading skeleton для category landing
- empty state для пустой navigation category
- empty state для PLP без товаров
- graceful fallback при отсутствии preview image

## Checklist перед выкладкой

- [x] `npm run build` проходит локально
- [x] navigation-mode и PLP-mode разделены контрактом `resolveCatalogRenderMode`
- [x] root / parent / intermediate / leaf сценарии не смешиваются
- [x] secondary shelf рендерится только ниже основного navigation блока
- [x] CTA `Показать все товары в разделе` остаётся secondary
- [x] dark theme не ломает читаемость ключевых экранов
- [x] ссылки категорий индексируемы
- [x] milestone CAT1 функционально закрыт

## Post-release monitoring

В первые 24 часа после выката проверить:

1. Метрика:
   - цели `catalog_category_click`
   - `catalog_subcategory_click`
   - `catalog_show_all_products`

2. Ошибки:
   - фронтовые console/runtime ошибки на `/catalog`
   - 404 по категориям и hash-навигации

3. Поведение пользователей:
   - нет роста отказов на `/catalog`
   - нет падения переходов в leaf-категории
   - нет аномального роста прямых кликов в `show=products`

4. SEO:
   - корректные title/description/canonical на root, parent и leaf
   - хлебные крошки и internal links читаются без JS

## Известные замечания

- На mobile cookie banner может перекрывать первый экран до принятия consent. Это не блокер для CAT1, но влияет на “чистоту” первого impression и может быть вынесено в отдельную UX-задачу.
