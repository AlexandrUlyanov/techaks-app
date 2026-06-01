ALTER TABLE `orders`
  ADD COLUMN `payment_provider_status` varchar(40) NULL AFTER `payment_id`,
  ADD COLUMN `payment_test` boolean NULL AFTER `payment_provider_status`,
  ADD COLUMN `payment_cancellation_party` varchar(80) NULL AFTER `payment_test`,
  ADD COLUMN `payment_cancellation_reason` varchar(120) NULL AFTER `payment_cancellation_party`,
  ADD COLUMN `payment_raw_response_json` json NULL AFTER `payment_cancellation_reason`;
