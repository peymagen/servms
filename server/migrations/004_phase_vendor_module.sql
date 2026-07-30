-- Migration 004 — Vendor Management Module: vendor_type remapped to the UAT
-- categories (Train TSV / Station PF / Station Stall / Station Others),
-- a dedicated signature field (distinct from the profile photo), and support
-- for the unit/contractor transfer + expiring-soon dashboard. Transfer history
-- reuses the centralized `audit_logs` table (TRANSFER action) — no new table.

START TRANSACTION;

-- Widen first so both the old and new labels are valid, remap existing rows,
-- then narrow to the final UAT category list.
ALTER TABLE `vendors`
  MODIFY COLUMN `vendor_type` ENUM('stationary','statutory','train_tsv','station_pf','station_stall','station_others') DEFAULT 'station_others';

UPDATE `vendors` SET `vendor_type` = 'train_tsv' WHERE `vendor_type` = 'statutory';
UPDATE `vendors` SET `vendor_type` = 'station_others' WHERE `vendor_type` = 'stationary';

ALTER TABLE `vendors`
  MODIFY COLUMN `vendor_type` ENUM('train_tsv','station_pf','station_stall','station_others') NOT NULL DEFAULT 'station_others';

ALTER TABLE `vendors`
  ADD COLUMN `signature_path` VARCHAR(255) DEFAULT NULL AFTER `profile_image`;

COMMIT;
