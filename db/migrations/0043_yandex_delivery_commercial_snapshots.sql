ALTER TABLE `orders`
  ADD COLUMN `delivery_provider_price` int NULL AFTER `delivery_price`,
  ADD COLUMN `delivery_pricing_policy_json` json NULL AFTER `delivery_provider_price`,
  ADD COLUMN `delivery_package_snapshot_json` json NULL AFTER `delivery_pricing_policy_json`,
  ADD COLUMN `delivery_eta_from` timestamp NULL AFTER `delivery_provider_raw_json`,
  ADD COLUMN `delivery_eta_to` timestamp NULL AFTER `delivery_eta_from`,
  ADD COLUMN `delivery_courier_json` json NULL AFTER `delivery_eta_to`;

ALTER TABLE `delivery_quotes`
  ADD COLUMN `provider_price` int NULL AFTER `price`,
  ADD COLUMN `pricing_policy_json` json NULL AFTER `provider_price`,
  ADD COLUMN `package_snapshot_json` json NULL AFTER `pricing_policy_json`;
