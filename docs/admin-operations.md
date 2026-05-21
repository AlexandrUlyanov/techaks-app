# Admin Operations (Current)

Дата обновления: 2026-05-21  
Проект: TechAks

## Инфраструктурные ограничения production

- `2 vCPU`
- `2 GB RAM`
- `38 GB disk`

Это влияет на все operational действия:

- не смешивать тяжёлые шаги;
- не запускать параллельно лишние maintenance-задачи;
- отдельно планировать DB rollout и build;
- следить за диском перед backup / reinstall / rebuild.

Актуальный production snapshot на 2026-05-21:

- Ubuntu 26.04 LTS
- KVM / OpenStack Nova
- `nginx` как reverse proxy
- `pm2` process: `techaks`
- root filesystem `/dev/sda4`: `38G`, свободно около `30G`

## Stores

Page:

- `/admin/stores`

Что есть:

- CRUD карточек магазинов;
- ручная привязка магазина к складу МойСклад;
- сохранение связи в `stores.ms_id`;
- визуальный статус привязки.

## Sync (MoySklad)

Page:

- `/admin/sync`

Что есть:

- token/login-based authorization;
- пошаговый full sync flow;
- несколько sync profiles;
- active profile;
- snapshot в `sync_runs`;
- lock full sync через `app_settings`;
- reconcile stocks;
- webhook queue;
- admin monitoring на sync-странице.

### Sync runbook summary

Типовые кейсы:

1. вебхуки не приходят;
2. очередь растёт;
3. full sync не стартует;
4. ночной sync упал.

Подробный operational контекст по sync остаётся в этом документе и в:

- [sync-epic-plan.md](</E:/work/ru/tehax/s/app/docs/sync-epic-plan.md>)

## Orders

### Админская работа с заказами

Page:

- `/admin/leads`

Что сейчас поддерживается:

- список заказов;
- фильтры и поиск;
- карточка заказа;
- история заказа;
- комментарии;
- переписка с клиентом;
- customer comments в `order_comments`;
- admin reply в том же conversation flow.

### Визуальные сигналы

В админке заказов есть:

- отдельный блок переписки в карточке заказа;
- заметный индикатор в списке заказов, если клиент написал;
- статусы conversation flow.

### Удаление заказов

Только `super_admin` может:

- удалять заказ из списка;
- удалять заказ из карточки.

Это именно administrative destructive action и его нельзя открывать обычным ролям.

## Users

### Удаление пользователей

Только `super_admin` может удалять пользователей.

Защитные ограничения:

- нельзя удалить самого себя;
- нельзя удалить последнего `super_admin`.

### Production cleanup note

Тестовые `customer` пользователи и тестовые заказы уже были очищены из production.

Это значит:

- старые counts в historical order-docs могут быть выше текущих;
- historical rollout docs надо читать как snapshot на момент фиксации, а не как live inventory данных.

## Account / storefront communication

В личном кабинете клиента:

- есть история заказов;
- заказ можно раскрыть;
- клиент может написать сообщение по заказу;
- менеджерский ответ виден в клиентской переписке;
- есть индикаторы новых ответов.

## Products

### Product visibility

В админке товары не скрываются даже если:

- цена `0`;
- цена некорректна;
- товар автоматически заблокирован системой.

Админ видит publication status:

- отображается на сайте;
- отключён вручную;
- не отображается, потому что цена не указана или равна `0`.

### Важно

Ручная активность товара (`isActive`) и системная автоблокировка (`isAutoBlocked`) — это разные вещи.

Синхронизация и system auto-block не должны автоматически включать вручную отключённый товар обратно.

## Merchandising

Page:

- `/admin/merchandising`

Что есть:

- product scoring;
- badge assignment;
- manual priority;
- recommendation pools для storefront blocks.

## Product spec standardization

Page:

- `/admin/products`

Что есть:

- standardization ключей;
- standardization значений;
- visibility/filterability control для category filters;
- rebuild filter index / spec structure.

## AI settings

AI-related settings находятся в admin settings area и используются для AI-assisted standardization и внешнего model routing.

## Safety reminders

Без отдельного решения нельзя:

- делать destructive production cleanup наобум;
- смешивать DB maintenance с обычным deploy;
- использовать `db:push` как shortcut против production;
- удалять `super_admin`, не убедившись, что остаётся рабочий доступ в админку.
