# Orders Staging Rollout Result

## Staging rollout status

`Failed / Blocked`

## Что было применено

- Batch A: `no`
- Batch B: `no`
- Batch C: `no`
- Batch D: `no`

## Что не применялось

Подтверждаю:

- production не трогали;
- backfill не выполнялся;
- indexes не применялись;
- foreign keys не добавлялись;
- compatibility mode не отключался.

## Результаты smoke tests

| scenario | result | notes |
|---|---|---|
| Проверка staging-БД | blocked | staging-БД не обнаружена |
| Проверка staging app target | blocked | отдельный staging app target не обнаружен |
| Read-only audit staging | blocked | отсутствует staging-контур |
| Batch A rollout | not started | нет staging |
| Batch B rollout | not started | нет staging |
| Batch C rollout | not started | нет staging |
| Batch D evaluation | partial | только по данным production audit, без staging-run |

## Ошибки

### Infra / environment

- endpoint/page: `staging environment discovery`
- текст ошибки: отдельный staging-контур не обнаружен
- stack trace: отсутствует, это не runtime exception
- вероятная причина: staging не развернут отдельно от production
- нужен ли hotfix: `no`, нужен инфраструктурный следующий шаг

## Можно ли готовить production rollout

`Нет`

Причина:

- staging rollout не был выполнен;
- additive batches не были прогнаны на staging;
- smoke после A/B/C не выполнен;
- нет безопасного staging-подтверждения.

## Что нужно исправить перед production

Перед production rollout нужно:

1. получить отдельный staging-контур;
2. выполнить staging read-only audit;
3. применить Batch A/B/C на staging;
4. выполнить smoke;
5. отдельно оценить Batch D.

## Рекомендация по Batch D indexes

`Пока не применять`

Причина:

- нет staging-контекста для оценки;
- Batch D должен идти отдельно от A/B/C;
- сначала нужен staging rollout.

## Что требует моего подтверждения дальше

- создание / предоставление staging-контура;
- запуск staging Batch A;
- запуск staging Batch B;
- запуск staging Batch C;
- запуск staging Batch D;
- любой backfill;
- отключение compatibility mode.
