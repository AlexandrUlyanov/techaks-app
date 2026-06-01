ALTER TABLE `orders`
  ADD COLUMN `moysklad_payment_in_id` text NULL AFTER `moysklad_external_code`,
  ADD COLUMN `moysklad_payment_in_href` text NULL AFTER `moysklad_payment_in_id`,
  ADD COLUMN `moysklad_payment_external_code` text NULL AFTER `moysklad_payment_in_href`;
