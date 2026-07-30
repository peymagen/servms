-- Migration 007 — Complaint Management Module rebuild per SRS:
-- RailMadad Excel import + CPGRAMS/Manual entry, admin-managed Complaint
-- Type -> Sub-type cascading dropdowns, Assignment (assign/reassign/transfer)
-- with history, Action Taken Report workflow (Dealing Section -> Sub-admin
-- review -> Admin accept/reject/send-back) with document uploads, import
-- history/audit trail, and a full status-history timeline.
--
-- Design notes (documented here since these are judgment calls, not spelled
-- out verbatim in the SRS):
--   * Reuses the existing generic `audit_logs` table (module_name="complaint"/
--     "complaint_assignment"/"complaint_atr"/"complaint_import"/"complaint_type_master")
--     instead of a new dedicated complaint_audit_logs table — it already
--     captures user/role/date/ip/old/new values for every module.
--   * Reuses the existing `dropdown_options` table (extended with a new
--     self-referencing `parent_id`) for Complaint Type/Sub-type instead of two
--     new complaint_type_master/complaint_subtype_master tables — this gets
--     the cascading dropdown for free from the existing dropdown CRUD.
--   * `complaint_assignments` doubles as both "current assignment" (latest row
--     per complaint_id) and full history — no separate history table needed.
--   * `complaints.unit_id` remains the live "Concerned Unit" pointer (updated
--     on each assign/reassign/transfer) for fast joins/division-scoping,
--     exactly as it works today; complaint_assignments is the audit trail.
--
-- Safe to run once against the existing `servms` database.

START TRANSACTION;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. DROPDOWN OPTIONS — add self-referencing parent_id so a dropdown category
--    can model a dependent Type -> Sub-type relationship (Complaint Type is
--    the first consumer; parent_id is NULL for top-level options).
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE `dropdown_options`
  ADD COLUMN `parent_id` INT(10) UNSIGNED DEFAULT NULL AFTER `category`;

ALTER TABLE `dropdown_options`
  ADD KEY `fk_dropdown_parent` (`parent_id`),
  ADD CONSTRAINT `fk_dropdown_parent` FOREIGN KEY (`parent_id`) REFERENCES `dropdown_options` (`id`) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. COMPLAINTS — extend with source tracking, reference numbers, first-class
--    Division/Train/Station, Type/Sub-type FKs, complainant details, current
--    assignment/closure pointers, and RailMadad import linkage.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE `complaints`
  ADD COLUMN `complaint_source` ENUM('railmadad','cpgrams','manual') NOT NULL DEFAULT 'manual' AFTER `complaint_code`,
  ADD COLUMN `complaint_ref_no` VARCHAR(50) DEFAULT NULL AFTER `complaint_source`,
  ADD COLUMN `portal_registration_number` VARCHAR(50) DEFAULT NULL AFTER `complaint_ref_no`,
  ADD COLUMN `manual_dak_reference_number` VARCHAR(50) DEFAULT NULL AFTER `portal_registration_number`,
  ADD COLUMN `eoffice_computer_number` VARCHAR(50) DEFAULT NULL AFTER `manual_dak_reference_number`,
  ADD COLUMN `division_id` INT(10) UNSIGNED DEFAULT NULL AFTER `unit_id`,
  ADD COLUMN `train_id` INT(10) UNSIGNED DEFAULT NULL AFTER `division_id`,
  ADD COLUMN `station_id` INT(10) UNSIGNED DEFAULT NULL AFTER `train_id`,
  ADD COLUMN `assigned_to_user_id` INT(10) UNSIGNED DEFAULT NULL AFTER `station_id`,
  ADD COLUMN `complaint_type_id` INT(10) UNSIGNED DEFAULT NULL AFTER `category`,
  ADD COLUMN `complaint_subtype_id` INT(10) UNSIGNED DEFAULT NULL AFTER `complaint_type_id`,
  ADD COLUMN `complainant_name` VARCHAR(150) DEFAULT NULL AFTER `description`,
  ADD COLUMN `complainant_mobile` VARCHAR(15) DEFAULT NULL AFTER `complainant_name`,
  ADD COLUMN `complainant_email` VARCHAR(150) DEFAULT NULL AFTER `complainant_mobile`,
  ADD COLUMN `complaint_date` DATETIME DEFAULT NULL AFTER `occurrence_time`,
  ADD COLUMN `resolution_date` DATETIME DEFAULT NULL AFTER `complaint_date`,
  ADD COLUMN `closed_by` INT(10) UNSIGNED DEFAULT NULL AFTER `resolution_date`,
  ADD COLUMN `closed_at` DATETIME DEFAULT NULL AFTER `closed_by`,
  ADD COLUMN `import_batch_id` INT(10) UNSIGNED DEFAULT NULL AFTER `closed_at`,
  ADD COLUMN `railmadad_extra` LONGTEXT DEFAULT NULL AFTER `import_batch_id`;

-- Backfill division_id for existing rows from unit -> station -> division.
UPDATE `complaints` c
  LEFT JOIN `units` u ON u.id = c.unit_id
  LEFT JOIN `stations` st ON st.id = u.station_id
  SET c.division_id = st.division_id
  WHERE c.division_id IS NULL;

-- Backfill complaint_date from the existing occurrence_date/time for existing rows.
UPDATE `complaints`
  SET `complaint_date` = TIMESTAMP(COALESCE(`occurrence_date`, CURDATE()), COALESCE(`occurrence_time`, '00:00:00'))
  WHERE `complaint_date` IS NULL;

-- Widen the workflow status enum in two steps so existing rows never hold a
-- value outside the column's declared set mid-migration:
-- old: open, investigating, resolved, rejected
-- new: pending, assigned, under_review, action_taken, approved, rejected, closed
ALTER TABLE `complaints`
  MODIFY COLUMN `complaints_status`
  ENUM('open','investigating','resolved','rejected','pending','assigned','under_review','action_taken','approved','closed')
  NOT NULL DEFAULT 'open';

UPDATE `complaints` SET `complaints_status` = 'pending' WHERE `complaints_status` = 'open';
UPDATE `complaints` SET `complaints_status` = 'under_review' WHERE `complaints_status` = 'investigating';
UPDATE `complaints` SET `complaints_status` = 'closed' WHERE `complaints_status` = 'resolved';

ALTER TABLE `complaints`
  MODIFY COLUMN `complaints_status`
  ENUM('pending','assigned','under_review','action_taken','approved','rejected','closed')
  NOT NULL DEFAULT 'pending';

-- Duplicate-reference guard, scoped by source (RailMadad ref numbers, CPGRAMS
-- portal numbers, etc. are only meaningful for de-dup within their own source;
-- MySQL never treats two NULLs as duplicates, so manual complaints without a
-- reference number are unaffected).
ALTER TABLE `complaints`
  ADD UNIQUE KEY `uq_complaint_source_ref` (`complaint_source`, `complaint_ref_no`),
  ADD KEY `fk_complaint_division` (`division_id`),
  ADD KEY `fk_complaint_train` (`train_id`),
  ADD KEY `fk_complaint_station` (`station_id`),
  ADD KEY `fk_complaint_assigned_user` (`assigned_to_user_id`),
  ADD KEY `fk_complaint_type` (`complaint_type_id`),
  ADD KEY `fk_complaint_subtype` (`complaint_subtype_id`),
  ADD KEY `fk_complaint_closed_by` (`closed_by`),
  ADD CONSTRAINT `fk_complaint_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_complaint_train` FOREIGN KEY (`train_id`) REFERENCES `trains` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_complaint_station` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_complaint_assigned_user` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_complaint_type` FOREIGN KEY (`complaint_type_id`) REFERENCES `dropdown_options` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_complaint_subtype` FOREIGN KEY (`complaint_subtype_id`) REFERENCES `dropdown_options` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_complaint_closed_by` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. COMPLAINT ACTION TAKEN REPORTS — Dealing Section adds/edits; Sub-admin
--    reviews; Admin accepts/rejects/sends back.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `complaint_action_taken_reports` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `complaint_id` INT(10) UNSIGNED NOT NULL,
  `remarks` TEXT NOT NULL,
  `submitted_by` INT(10) UNSIGNED DEFAULT NULL,
  `submitted_at` DATETIME DEFAULT NULL,
  `review_status` ENUM('pending_review','sub_admin_reviewed','accepted','rejected','sent_back') NOT NULL DEFAULT 'pending_review',
  `reviewed_by` INT(10) UNSIGNED DEFAULT NULL,
  `reviewed_at` DATETIME DEFAULT NULL,
  `review_remarks` TEXT DEFAULT NULL,
  `decided_by` INT(10) UNSIGNED DEFAULT NULL,
  `decided_at` DATETIME DEFAULT NULL,
  `decision_remarks` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` TINYINT(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_atr_complaint` (`complaint_id`),
  KEY `fk_atr_submitter` (`submitted_by`),
  KEY `fk_atr_reviewer` (`reviewed_by`),
  KEY `fk_atr_decider` (`decided_by`),
  CONSTRAINT `fk_atr_complaint` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_atr_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_atr_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_atr_decider` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. COMPLAINT DOCUMENTS — unified document store for both initial evidence
--    and ATR uploads (the legacy `complaint_evidence` table is left in place,
--    untouched, for backward compatibility; its rows are copied forward below
--    and all new code reads/writes complaint_documents only).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `complaint_documents` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `complaint_id` INT(10) UNSIGNED NOT NULL,
  `atr_id` INT(10) UNSIGNED DEFAULT NULL,
  `document_type` ENUM('evidence','atr','other') NOT NULL DEFAULT 'evidence',
  `file_name` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `file_type` VARCHAR(50) DEFAULT NULL,
  `uploaded_by` INT(10) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `status` TINYINT(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_doc_complaint` (`complaint_id`),
  KEY `fk_doc_atr` (`atr_id`),
  KEY `fk_doc_uploader` (`uploaded_by`),
  CONSTRAINT `fk_doc_complaint` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_doc_atr` FOREIGN KEY (`atr_id`) REFERENCES `complaint_action_taken_reports` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_doc_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `complaint_documents` (`complaint_id`, `document_type`, `file_name`, `original_name`, `file_path`, `file_type`, `created_at`, `status`)
SELECT `complaint_id`, 'evidence', SUBSTRING_INDEX(`file_path`, '/', -1), SUBSTRING_INDEX(`file_path`, '/', -1), `file_path`, `file_type`, `uploaded_at`, `status`
FROM `complaint_evidence`;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. COMPLAINT ASSIGNMENTS — assign / reassign / transfer, latest row per
--    complaint_id is the current assignment; all rows together are the history.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `complaint_assignments` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `complaint_id` INT(10) UNSIGNED NOT NULL,
  `assignment_type` ENUM('initial','reassign','transfer') NOT NULL DEFAULT 'initial',
  `from_unit_id` INT(10) UNSIGNED DEFAULT NULL,
  `to_unit_id` INT(10) UNSIGNED DEFAULT NULL,
  `assigned_to_user_id` INT(10) UNSIGNED DEFAULT NULL,
  `assigned_by` INT(10) UNSIGNED DEFAULT NULL,
  `remarks` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_assign_complaint` (`complaint_id`),
  KEY `fk_assign_from_unit` (`from_unit_id`),
  KEY `fk_assign_to_unit` (`to_unit_id`),
  KEY `fk_assign_user` (`assigned_to_user_id`),
  KEY `fk_assign_by` (`assigned_by`),
  CONSTRAINT `fk_assign_complaint` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assign_from_unit` FOREIGN KEY (`from_unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_assign_to_unit` FOREIGN KEY (`to_unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_assign_user` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_assign_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. COMPLAINT STATUS HISTORY — full workflow timeline per complaint.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `complaint_status_history` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `complaint_id` INT(10) UNSIGNED NOT NULL,
  `from_status` VARCHAR(30) DEFAULT NULL,
  `to_status` VARCHAR(30) NOT NULL,
  `changed_by` INT(10) UNSIGNED DEFAULT NULL,
  `remarks` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_hist_complaint` (`complaint_id`),
  KEY `fk_hist_user` (`changed_by`),
  CONSTRAINT `fk_hist_complaint` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_hist_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. COMPLAINT IMPORT HISTORY — RailMadad Excel import batches.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `complaint_import_history` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `file_name` VARCHAR(255) NOT NULL,
  `imported_by` INT(10) UNSIGNED DEFAULT NULL,
  `total_records` INT(10) UNSIGNED NOT NULL DEFAULT 0,
  `imported_count` INT(10) UNSIGNED NOT NULL DEFAULT 0,
  `duplicate_count` INT(10) UNSIGNED NOT NULL DEFAULT 0,
  `failed_count` INT(10) UNSIGNED NOT NULL DEFAULT 0,
  `error_report` LONGTEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_import_user` (`imported_by`),
  CONSTRAINT `fk_import_user` FOREIGN KEY (`imported_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `complaints`
  ADD KEY `fk_complaint_import` (`import_batch_id`),
  ADD CONSTRAINT `fk_complaint_import` FOREIGN KEY (`import_batch_id`) REFERENCES `complaint_import_history` (`id`) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. SEED — Complaint Type / Sub-type dropdowns, populated from the actual
--    RailMadad export's distinct Type/Sub-type combinations so the cascading
--    dropdown is immediately usable (Divisional/HQ Admin & Sub-admin can add
--    more or edit these afterwards via the dropdown API).
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO `dropdown_options` (`category`, `parent_id`, `division_id`, `value`, `label`, `sort_order`) VALUES
('complaint_type', NULL, NULL, 'water_availability', 'Water Availability', 1),
('complaint_type', NULL, NULL, 'security', 'Security', 2),
('complaint_type', NULL, NULL, 'miscellaneous', 'Miscellaneous', 3),
('complaint_type', NULL, NULL, 'cleanliness', 'Cleanliness', 4),
('complaint_type', NULL, NULL, 'staff_behaviour', 'Staff Behaviour', 5),
('complaint_type', NULL, NULL, 'luggage_parcels', 'Luggage / Parcels', 6),
('complaint_type', NULL, NULL, 'unreserved_ticketing', 'Unreserved Ticketing', 7),
('complaint_type', NULL, NULL, 'reserved_ticketing', 'Reserved Ticketing', 8),
('complaint_type', NULL, NULL, 'catering_vending', 'Catering & Vending Services', 9),
('complaint_type', NULL, NULL, 'coach_maintenance', 'Coach - Maintenance', 10),
('complaint_type', NULL, NULL, 'women_special_needs', 'Facilities for Women with Special needs', 11),
('complaint_type', NULL, NULL, 'passenger_amenities', 'Passenger Amenities', 12),
('complaint_type', NULL, NULL, 'divyangjan_facilities', 'Divyangjan Facilities', 13),
('complaint_type', NULL, NULL, 'punctuality', 'Punctuality', 14),
('complaint_type', NULL, NULL, 'bed_roll', 'Bed Roll', 15),
('complaint_type', NULL, NULL, 'corruption_bribery', 'Corruption / Bribery', 16),
('complaint_type', NULL, NULL, 'electrical_equipment', 'Electrical Equipment', 17),
('complaint_type', NULL, NULL, 'coach_cleanliness', 'Coach - Cleanliness', 18);

INSERT INTO `dropdown_options` (`category`, `parent_id`, `division_id`, `value`, `label`, `sort_order`)
SELECT 'complaint_subtype', id, NULL, v.value, v.label, v.sort_order FROM `dropdown_options` t
JOIN (
  SELECT 'water_availability' AS type_value, 'packaged_drinking_water' AS value, 'Packaged Drinking Water / Rail Neer' AS label, 1 AS sort_order UNION ALL
  SELECT 'water_availability', 'others', 'Others', 2 UNION ALL
  SELECT 'security', 'unauthorized_person_ladies_coach', 'Unauthorized person in Ladies/Disabled Coach/SLR/Reserve Coach', 1 UNION ALL
  SELECT 'security', 'theft_of_belongings', 'Theft of Passengers Belongings/Snatching', 2 UNION ALL
  SELECT 'security', 'others', 'Others', 3 UNION ALL
  SELECT 'miscellaneous', 'miscellaneous', 'Miscellaneous', 1 UNION ALL
  SELECT 'cleanliness', 'waiting_retiring_room', 'Waiting Room / Retiring Room', 1 UNION ALL
  SELECT 'cleanliness', 'platform', 'Platform', 2 UNION ALL
  SELECT 'staff_behaviour', 'staff_behaviour', 'Staff Behaviour', 1 UNION ALL
  SELECT 'luggage_parcels', 'delivery', 'Delivery', 1 UNION ALL
  SELECT 'luggage_parcels', 'overcharging', 'Overcharging', 2 UNION ALL
  SELECT 'luggage_parcels', 'others', 'Others', 3 UNION ALL
  SELECT 'unreserved_ticketing', 'atvm', 'ATVM', 1 UNION ALL
  SELECT 'unreserved_ticketing', 'uts_app_handset_change', 'UTS App Mobile Handset Change', 2 UNION ALL
  SELECT 'unreserved_ticketing', 'inadequate_counters', 'Inadequate Counters', 3 UNION ALL
  SELECT 'unreserved_ticketing', 'overcharging', 'Overcharging', 4 UNION ALL
  SELECT 'unreserved_ticketing', 'others', 'Others', 5 UNION ALL
  SELECT 'reserved_ticketing', 'others', 'Others', 1 UNION ALL
  SELECT 'catering_vending', 'food_water_not_available', 'Food & Water Not Available', 1 UNION ALL
  SELECT 'catering_vending', 'overcharging', 'Overcharging', 2 UNION ALL
  SELECT 'coach_maintenance', 'others', 'Others', 1 UNION ALL
  SELECT 'women_special_needs', 'baby_food', 'Baby Food', 1 UNION ALL
  SELECT 'women_special_needs', 'others', 'Others', 2 UNION ALL
  SELECT 'passenger_amenities', 'parking', 'Parking', 1 UNION ALL
  SELECT 'passenger_amenities', 'pa_system', 'PA (Public Announcement) System', 2 UNION ALL
  SELECT 'passenger_amenities', 'benches_sheds', 'Benches/Sheds', 3 UNION ALL
  SELECT 'passenger_amenities', 'others', 'Others', 4 UNION ALL
  SELECT 'divyangjan_facilities', 'coach_unavailability', 'Divyangjan coach unavailability', 1 UNION ALL
  SELECT 'divyangjan_facilities', 'others', 'Others', 2 UNION ALL
  SELECT 'punctuality', 'ntes_app', 'NTES APP', 1 UNION ALL
  SELECT 'punctuality', 'others', 'Others', 2 UNION ALL
  SELECT 'bed_roll', 'others', 'Others', 1 UNION ALL
  SELECT 'corruption_bribery', 'corruption_bribery', 'Corruption / Bribery', 1 UNION ALL
  SELECT 'electrical_equipment', 'air_conditioner', 'Air Conditioner', 1 UNION ALL
  SELECT 'coach_cleanliness', 'coach_interior', 'Coach Interior', 1
) v ON v.type_value = t.value
WHERE t.category = 'complaint_type';

COMMIT;
