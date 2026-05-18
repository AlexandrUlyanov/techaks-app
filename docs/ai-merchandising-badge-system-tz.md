# ТЗ: AI Merchandising Badge System для ТЕХАКС

Дата: 2026-05-18  
Статус: draft / planned  
Область: merchandising, catalog UX, admin UX, AI-assisted operations

## 1. Контекст

В проекте уже существует базовый merchandising-слой:

- scoring товаров для промо;
- ручные merchandising-бейджи;
- авто-бейджи по остаткам и качеству карточки;
- ручное и массовое управление бейджами в админке;
- отображение merchandising-бейджей на витрине.

Текущая система полезна как operational-инструмент, но у неё есть ограничение:

- набор бейджей фиксированный и относительно общий;
- бейджи плохо выражают смысл конкретной категории;
- они не всегда помогают покупателю принять решение;
- нет отдельного управляемого каталога бейджей;
- нет AI-помощника, который может:
  - изучить категорию;
  - предложить релевантные бейджи;
  - связать их с товарами;
  - объяснить логику назначения.

Нужно спроектировать и внедрить следующий уровень merchandising-системы:

**AI-assisted category-aware badge system**, где ИИ не просто “вешает красивые слова”, а помогает строить управляемую, объяснимую и полезную для покупателя систему бейджей.

## 2. Продуктовая цель

Сделать так, чтобы для каждой товарной категории у ТЕХАКС были:

1. понятные и полезные для клиента бейджи;
2. единый управляемый каталог бейджей;
3. category-aware правила применения;
4. AI-агент, который:
   - предлагает новые бейджи;
   - предлагает назначения по товарам;
   - помогает поддерживать бейджи в актуальном состоянии.

При этом система должна оставаться:

- управляемой человеком;
- безопасной для production;
- объяснимой;
- пригодной для массового применения;
- не завязанной на “магическое” runtime-поведение без контроля.

## 3. Основная концепция

Система должна состоять из двух взаимосвязанных слоёв:

### 3.1 Слой каталога бейджей

Отвечает на вопрос:

> Какие бейджи вообще существуют и какие из них разрешены для конкретных категорий?

Этот слой хранит:

- каталог бейджей;
- тип бейджа;
- scope категорий;
- описание;
- статус;
- источник;
- UI-метаданные;
- ограничения на применение.

### 3.2 Слой назначения бейджей

Отвечает на вопрос:

> Какие именно бейджи должны быть у конкретного товара?

Этот слой должен поддерживать:

- ручное назначение;
- assignment по утверждённым правилам;
- AI-suggested assignment;
- confidence;
- explanation;
- превью до применения;
- массовое применение.

## 4. Главный принцип безопасности

ИИ **не должен** иметь права “самостоятельно менять витрину как хочет”.

Правильная модель:

1. ИИ анализирует категорию и товары.
2. ИИ предлагает:
   - новые бейджи;
   - правила;
   - назначения.
3. Администратор:
   - смотрит предложения;
   - утверждает / отклоняет / переименовывает.
4. Только после подтверждения данные применяются к каталогу.

То есть ИИ здесь:

- не окончательный источник истины;
- не runtime-движок показа на витрине;
- а **помощник по генерации и классификации**, работающий внутри жёсткого approval-flow.

## 5. Продуктовые требования

### 5.1 Типы бейджей

Система должна поддерживать минимум 4 типа бейджей:

1. **Manual**
   - вручную назначаемые;
   - могут назначаться админом товару напрямую.

2. **Rule-based**
   - ставятся по утверждённым правилам;
   - например по характеристикам, бренду, совместимости, типу товара.

3. **AI-suggested**
   - предложены ИИ;
   - не активны на витрине, пока не одобрены.

4. **System**
   - служебные бейджи операционного характера;
   - например по stock / visibility / urgent promo;
   - они не должны смешиваться с “смысловыми” consumer-facing badges.

### 5.2 Категорийная релевантность

Каждый consumer-facing badge должен иметь category scope:

- global;
- category-specific;
- category-tree-specific;
- manufacturer-specific (опционально);
- use-case cluster-specific (опционально в future phase).

Примеры хороших category-aware badges:

- для кабелей:
  - `Быстрая зарядка`
  - `Для iPhone`
  - `Type-C`
  - `Усиленный`
  - `Передача данных`

- для наушников:
  - `Шумоподавление`
  - `Для спорта`
  - `Игровые`
  - `С микрофоном`
  - `Долгая работа`

- для аксессуаров в авто:
  - `Магнитный`
  - `Быстрая зарядка`
  - `Компактный`
  - `Для дальних поездок`

### 5.3 Ограничение шумности

Нужно ограничить визуальный шум:

- не более 1-2 смысловых бейджей на товар по умолчанию;
- системные бейджи не должны забивать consumer-facing badges;
- не должно быть конфликтующих бейджей;
- ИИ не должен порождать десятки почти одинаковых формулировок.

### 5.4 Объяснимость

Для каждого AI-предложения должна существовать объяснимость:

- почему предложен этот бейдж;
- на основании каких характеристик;
- с какой уверенностью;
- сколько товаров в категории потенциально подпадают под него.

### 5.5 Управляемость

Админ должен иметь возможность:

- отключить конкретный бейдж;
- скрыть его с витрины;
- запретить использование для конкретной категории;
- массово убрать бейдж у товаров;
- утвердить / отклонить / переименовать AI-предложение;
- видеть историю изменений.

## 6. Архитектура решения

### 6.1 Core idea

Нужно строить не один “умный prompt”, а целую систему:

1. **Badge Catalog**
2. **Badge Suggestion Engine**
3. **Badge Assignment Engine**
4. **Review / Approval Workflow**
5. **Storefront Projection Layer**
6. **Quality / Analytics Layer**

### 6.2 Рекомендуемый runtime-подход

Рекомендуется hybrid architecture:

- AI используется для:
  - генерации каталога бейджей;
  - генерации suggested rules;
  - suggested product assignments;
  - cleanup / deduplication / quality feedback.

- deterministic rule engine используется для:
  - повторяемого массового применения;
  - быстрых пересчётов;
  - безопасной интеграции с sync;
  - predictable production behavior.

### 6.3 Чего не делать

Не нужно:

- вызывать LLM на каждый публичный товарный запрос;
- давать ИИ право сразу менять live-бейджи на витрине;
- смешивать “предложение” и “утверждённое правило” в одном поле;
- использовать только JSON в `product_merchandising` без нормализованного каталога.

## 7. Модель данных

Ниже — рекомендуемая модель. Названия можно адаптировать под стиль проекта.

### 7.1 `badge_catalog`

Поля:

- `id`
- `code`
- `label`
- `description`
- `badge_type` (`manual`, `rule`, `ai_suggested`, `system`)
- `audience` (`customer`, `internal`, `mixed`)
- `status` (`draft`, `active`, `disabled`, `archived`)
- `source` (`manual`, `ai`)
- `icon` nullable
- `color_token` nullable
- `sort_order`
- `max_products_per_item` default 1
- `notes`
- `created_at`
- `updated_at`

### 7.2 `badge_category_scope`

Поля:

- `id`
- `badge_id`
- `scope_type` (`global`, `category`, `category_tree`, `manufacturer`)
- `scope_id` nullable
- `is_enabled`
- `priority`
- `created_at`
- `updated_at`

### 7.3 `badge_assignment_rules`

Поля:

- `id`
- `badge_id`
- `category_id`
- `rule_type` (`spec_match`, `keyword_match`, `brand_match`, `price_band`, `ai_generated`)
- `rule_json`
- `confidence_threshold`
- `is_enabled`
- `source` (`manual`, `ai`)
- `created_at`
- `updated_at`

### 7.4 `product_badge_assignments`

Поля:

- `id`
- `product_id`
- `badge_id`
- `assignment_source` (`manual`, `rule`, `ai`, `system`)
- `confidence` nullable
- `explanation` text nullable
- `status` (`suggested`, `approved`, `applied`, `rejected`, `disabled`)
- `is_visible_on_site`
- `created_at`
- `updated_at`

### 7.5 `badge_ai_runs`

Поля:

- `id`
- `run_type` (`catalog_generation`, `assignment_generation`, `quality_audit`)
- `category_id` nullable
- `model`
- `prompt_version`
- `status`
- `input_snapshot`
- `result_json`
- `error_text`
- `started_at`
- `finished_at`

### 7.6 `badge_history`

Поля:

- `id`
- `entity_type` (`catalog`, `rule`, `assignment`)
- `entity_id`
- `action_type`
- `old_value`
- `new_value`
- `comment`
- `user_id`
- `created_at`

## 8. Backend requirements

### 8.1 Badge catalog API

Нужны backend-ручки для:

- list badges
- get badge
- create badge
- update badge
- archive / disable badge
- manage badge scopes

### 8.2 AI suggestion API

Нужны ручки для:

- `generateCategoryBadgeSuggestions(categoryId)`
- `generateBadgeAssignmentSuggestions(categoryId)`
- `auditCategoryBadgeQuality(categoryId)`

Все эти ручки должны:

- сохранять run в `badge_ai_runs`;
- сохранять результат как draft/suggested;
- не менять live badges напрямую.

### 8.3 Review / approval API

Нужны действия:

- approve suggested badge
- reject suggested badge
- rename suggested badge
- approve rule
- reject rule
- approve assignment batch
- reject assignment batch

### 8.4 Assignment / projection API

Нужны операции:

- preview badge assignments
- apply approved assignments
- clear assignments by badge
- re-run assignments after sync
- recalculate storefront badges

## 9. AI requirements

### 9.1 Задачи AI-агента

ИИ-агент должен уметь:

1. изучать категорию;
2. выявлять повторяющиеся полезные потребительские свойства;
3. предлагать короткие и понятные бейджи;
4. избегать дублей и банальностей;
5. предлагать назначения товаров;
6. возвращать confidence + explanation;
7. указывать слабые места категории:
   - мало данных в specs;
   - неоднородные описания;
   - высокая неоднозначность.

### 9.2 Входные данные для AI

Для category analysis ИИ должен видеть:

- category name;
- parent category trail;
- sample product names;
- sample descriptions;
- normalized specs;
- brands;
- price bands;
- current existing badges in this category;
- примеры уже успешных бейджей из соседних категорий, если это разрешено.

### 9.3 Ограничения на output

ИИ не должен:

- генерировать бессмысленные marketing clichés;
- дублировать существующие бейджи;
- выдавать длинные предложения вместо бейджей;
- предлагать бейджи, не подтверждённые данными товара;
- ставить больше допустимого количества бейджей на товар.

### 9.4 Формат предложений

Для каждого suggested badge AI должен вернуть:

- `label`
- `code`
- `description`
- `why_this_badge_exists`
- `suggested_category_scope`
- `example_product_ids`
- `estimated_coverage`
- `risk_notes`

Для assignment suggestions:

- `product_id`
- `badge_code`
- `confidence`
- `explanation`
- `evidence`

## 10. Admin UX requirements

## 10.1 Общая IA

В админке нужно сделать отдельный раздел, например:

- `Мерчендайзинг -> AI бейджи`

или

- `Мерчендайзинг -> Каталог бейджей`
- `Мерчендайзинг -> AI предложения`
- `Мерчендайзинг -> Назначения`

### 10.2 Экран 1: Каталог бейджей

Должен показывать:

- список всех бейджей;
- label;
- type;
- status;
- categories count;
- products count;
- source (`manual` / `ai`);
- enabled on site / hidden.

Действия:

- создать бейдж;
- редактировать;
- скрыть;
- архивировать;
- открыть scope;
- открыть assignments.

### 10.3 Экран 2: AI предложения по категории

Workflow:

1. выбрать категорию;
2. нажать `Сгенерировать предложения ИИ`;
3. увидеть draft-список бейджей;
4. по каждому бейджу:
   - preview label
   - explanation
   - suggested scope
   - estimated coverage
   - sample products
   - confidence
5. можно:
   - утвердить
   - отклонить
   - переименовать
   - объединить с существующим бейджем

### 10.4 Экран 3: Правила назначения

Должен показывать:

- badge
- category
- source
- rule type
- enabled/disabled
- expected coverage

Нужен preview:

- сколько товаров попадёт;
- какие 20 примеров;
- есть ли конфликт с другими бейджами.

### 10.5 Экран 4: Назначения по товарам

Должен показывать:

- suggested assignments;
- approved assignments;
- conflicts;
- rejected assignments;
- ручную корректировку.

Нужны bulk actions:

- применить все утверждённые;
- отклонить весь batch;
- снять бейдж массово;
- скрыть бейдж глобально.

### 10.6 Экран 5: Качество и аналитика

Показатели:

- сколько категорий покрыто бейджами;
- сколько consumer-facing badges active;
- сколько draft AI badges ждут review;
- среднее число бейджей на товар;
- категории с наибольшей неоднозначностью;
- категории с плохим coverage;
- конфликты / дубли.

## 11. UX требования по сценариям

### 11.1 Сценарий: создать новую бейдж-систему для категории

1. Открыть категорию.
2. Сгенерировать AI-предложения.
3. Отредактировать формулировки.
4. Утвердить бейджи.
5. Сгенерировать preview assignments.
6. Посмотреть конфликт/coverage.
7. Применить batch.

### 11.2 Сценарий: убрать неудачный бейдж

1. Открыть каталог бейджей.
2. Найти бейдж.
3. Посмотреть:
   - где используется;
   - из какой категории;
   - кто его создал;
   - AI это или ручной.
4. Скрыть / архивировать / снять с товаров массово.

### 11.3 Сценарий: обновить бейджи после изменения каталога

После крупной синхронизации:

1. выбрать категорию;
2. запустить AI quality audit;
3. увидеть:
   - какие бейджи устарели;
   - какие не покрывают новые товары;
   - какие новые бейджи стоит завести;
4. утвердить изменения.

## 12. Integration requirements

### 12.1 Интеграция с текущим merchandising

Новый AI badge system должен:

- не ломать текущий `product_merchandising`;
- уметь coexist с текущими manual/system badges;
- постепенно вытеснять старую плоскую модель, а не ломать её одномоментно.

### 12.2 Интеграция с витриной

Публичные карточки должны получать:

- только approved + enabled + visible badges;
- в нормализованном порядке;
- не более лимита, заданного UI-политикой.

### 12.3 Интеграция с sync

После sync должны быть доступны safe hooks:

- re-run badge coverage preview;
- re-run rule assignments;
- запуск AI quality audit вручную;
- не запускать полный AI analysis автоматически на каждый webhook.

## 13. Rollout phases

### Phase 1 — Foundation

- новая модель данных;
- badge catalog CRUD;
- базовый admin UI каталога;
- projection layer на витрину.

### Phase 2 — AI Category Suggestion

- AI category analysis;
- draft badge suggestion runs;
- review / approve / reject flow.

### Phase 3 — Assignment Engine

- rules and suggested assignments;
- preview and conflict detection;
- apply batch.

### Phase 4 — Quality + Sync Integration

- quality dashboards;
- stale badge audit;
- category maintenance flow;
- post-sync re-evaluation hooks.

### Phase 5 — Automation maturity

- scheduled category audits;
- operator notifications;
- confidence thresholds;
- smarter dedupe and merge suggestions.

## 14. Acceptance criteria

Задача считается реализованной по фазам, если:

1. В системе есть отдельный каталог бейджей.
2. Бейджи имеют scope и lifecycle.
3. AI умеет предлагать category-aware badges.
4. AI умеет объяснять, почему бейдж предложен.
5. Нельзя применить AI-предложение на витрину без review.
6. Есть preview перед массовым применением.
7. Есть conflict detection.
8. На товаре не появляется избыточное число бейджей.
9. Категорийные бейджи полезны для покупателя, а не являются общим маркетинговым шумом.
10. Система не ломает текущие merchandising-функции.

## 15. Что не входит в первую фазу

В первую фазу не обязательно включать:

- realtime AI inference на каждый товарный запрос;
- мультиязычные бейджи;
- автоматическое переименование existing badges;
- self-learning closed-loop без оператора;
- сложную рекомендательную модель по продажам и конверсии;
- A/B framework для бейджей.

## 16. Риски

### 16.1 Product risk

- ИИ будет предлагать слишком общие бейджи;
- менеджеры перегрузят витрину labels;
- появятся category-inconsistent labels.

### 16.2 Technical risk

- слишком сильная зависимость от LLM в runtime;
- отсутствие нормализованной модели приведёт к хаосу в JSON;
- массовые назначения без preview могут поломать витрину.

### 16.3 Operational risk

- без review workflow команда потеряет доверие к системе;
- без analytics будет непонятно, какие бейджи реально работают.

## 17. Рекомендация по старту

Начинать нужно не с “ИИ сразу расставляет бейджи всем товарам”, а с:

1. **каталога бейджей**;
2. **AI category suggestions**;
3. **review / approval flow**;
4. **preview assignments**.

Это даст контролируемую, сильную и действительно масштабируемую merchandising-систему.
