# Runbook: доставка в production
## Проверка после деплоя

1. Убедиться, что GitHub Actions deploy завершён успешно.
2. Проверить `/api/health` и загрузку `/checkout`.
3. В БД проверить наличие `delivery_quotes`, `delivery_jobs` и
   `orders.delivery_quote_id`.
4. В админке открыть тестовый заказ с доставкой и проверить блок фоновой задачи.
5. Рассчитать доставку, изменить адрес и убедиться, что quote ID обновился.

## Диагностические SQL

```sql
SELECT status, COUNT(*)
FROM delivery_jobs
GROUP BY status;

SELECT id, order_id, status, attempts, max_attempts, run_after, last_error, updated_at
FROM delivery_jobs
WHERE status IN ('failed', 'dead', 'blocked', 'processing')
ORDER BY updated_at ASC;

SELECT id, order_number, payment_status, paid_amount, total_price,
       delivery_provider_order_id, delivery_provider_error
FROM orders
WHERE delivery_type = 'delivery'
  AND status = 'handed_to_delivery'
  AND (delivery_provider_order_id IS NULL OR delivery_provider_order_id = '');
```

## Типовые инциденты

### `blocked`

Нормально для неоплаченного заказа. Проверить `payment_status`, `paid_amount` и
`total_price`. После полной оплаты задача будет поднята reconciliation автоматически.

### `failed`

Worker повторит задачу автоматически. Проверить `last_error`, настройки интеграции,
адрес, склад отправления и доступность API.

### `dead`

Проверить в кабинете перевозчика, не создана ли заявка фактически. Если заявки нет,
исправить причину и нажать «Повторить через очередь». Если заявка есть, сначала
синхронизировать/сохранить её ID, чтобы не создать дубль.

### Зависший `processing`

Worker сам освободит lock через 5 минут. Если этого не произошло, проверить PM2,
доступ к БД и наличие единственного активного процесса приложения.

## Откат

Код можно откатить на предыдущий commit без удаления новых таблиц: схема additive и
не мешает старой версии. Таблицы и колонку в аварийном откате не удалять, чтобы не
потерять диагностику и связи заказов. После восстановления повторно запустить schema
verifier и проверить очередь.
