# Deploy Pipeline Final Safety Status

Дата фиксации: 2026-05-15  
Окружение: production  
Проект: TechAks

## Итог

Обычный deploy pipeline приведён в безопасное состояние:

- push в `master` больше не должен автоматически менять production-БД;
- deploy выполняет только кодовый rollout и перезапуск приложения;
- database operations вынесены из обычного deploy flow;
- production schema не должна мутировать при стандартном GitHub Actions deploy.

## Что делает обычный deploy

Обычный workflow deploy выполняет только:

- checkout / получение кода;
- установку зависимостей;
- build проекта;
- выкладку кода на сервер;
- перезапуск PM2 process `techaks`;
- healthcheck приложения.

## Что обычный deploy больше НЕ делает

Из обычного deploy flow убрано:

- `npm run db:push`
- `drizzle-kit push`
- любые автоматические migrations
- inline SQL (`ALTER`, `UPDATE`, `INSERT`, `DELETE`)
- автоматический backfill
- автоматический schema sync

## Что подтверждено после push

После реального push/deploy подтверждено:

- GitHub Actions deploy прошёл успешно;
- production pages отвечают `200 OK`;
- PM2 process `techaks` был перезапущен;
- healthcheck прошёл;
- повторные автоматические DB mutations не выполнялись.

## Manual DB workflow

Для операций с production-БД подготовлен отдельный manual workflow.

Принцип:

- он не должен запускаться автоматически;
- он требует явного ручного подтверждения;
- обычный push в `master` не должен активировать DB-операции.

## Важные правила эксплуатации

Для production действуют следующие правила:

- deploy приложения и изменение БД — это разные процессы;
- любые DB operations должны запускаться отдельно;
- перед любой production DB operation нужен backup;
- `db:push --force` нельзя использовать как часть обычного deploy;
- inline SQL в deploy workflow запрещён;
- additive schema rollout должен выполняться только как отдельная контролируемая процедура.

## Связь с Orders Phase 3

Это особенно важно после ручного additive rollout для раздела `Заказы`:

- Phase 3 / 3.1 schema changes уже были применены вручную и контролируемо;
- повторный автоматический `db:push` поверх production нежелателен;
- compatibility mode должен оставаться включённым до отдельной следующей фазы;
- дальнейшие DB-изменения должны проходить только через manual controlled rollout.

## Что НЕ делалось

Подтверждено:

- production-БД не менялась автоматически во время обычного deploy;
- `db:push` после push в `master` не запускался;
- migrations автоматически не запускались;
- backfill автоматически не запускался;
- destructive DB changes не выполнялись.

## Вывод

Текущее состояние deploy pipeline можно считать безопасным для обычной синхронизации кода с production.

Это не отменяет необходимости осторожности при DB rollout, но снимает главный риск:

> обычный push/deploy больше не должен самовольно менять production-БД.
