-- Migration 003 — Contractor Module: contract information (award date, tenure,
-- annual contract value). Unit linking and status/contract history reuse the
-- existing `units.contractor_id` FK and the centralized `audit_logs` table
-- respectively, so no new tables are needed for those.

START TRANSACTION;

ALTER TABLE `contractors`
  ADD COLUMN `award_date` DATE DEFAULT NULL AFTER `joined_date`,
  ADD COLUMN `tenure_months` INT(10) UNSIGNED DEFAULT NULL AFTER `award_date`,
  ADD COLUMN `annual_contract_value` DECIMAL(12,2) DEFAULT NULL AFTER `tenure_months`;

COMMIT;
