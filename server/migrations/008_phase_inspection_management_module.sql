-- Migration 008 — Inspection Management Module rebuild per SRS:
-- Digital inspection filing (Draft/Submit) by Inspectors, Sub-admin review +
-- delegation to Dealing Section, Action Taken Report workflow (Draft/Submit ->
-- Sub-admin review -> Admin accept/reject/send-back), sequential inspection
-- numbering (INSP-YYYY-000001), admin-managed Category -> Type cascading
-- dropdowns, assignment history, document management, and full status history.
--
-- Design notes (judgment calls, mirroring server/migrations/007's precedent
-- for the Complaint Management Module — same consolidation choices apply here):
--   * Reuses the existing generic `audit_logs` table (module_name="inspection"/
--     "inspection_assignment"/"inspection_atr"/"inspection_type_master") instead
--     of a new dedicated inspection_audit_logs table.
--   * Reuses `dropdown_options` (already extended with parent_id in migration
--     007) for Inspection Category/Type instead of new
--     inspection_category_master/inspection_type_master tables.
--   * `inspection_assignments` doubles as current-assignment pointer (latest
--     row per inspection_id) and full history, same as complaint_assignments.
--   * The LEGACY `inspections` table (id, unit_id, inspector_id, inspection_date,
--     result, remarks, status) is EXTENDED in place, not replaced — its columns
--     are read by penalty.service.ts (inspection_id FK + inspection_date join),
--     unit.service.ts (inspector_name subquery + inspector_count/unassigned
--     metrics), master.controller.ts's getInspectionsLite picker, and
--     dashboard.service.ts's legacy result-based donut chart. All of those keep
--     working unchanged: `result` becomes nullable (new inspections don't set
--     it — the new workflow's outcome is `inspection_status`, not `result`) and
--     every other pre-existing column/FK is untouched.
--
-- Safe to run once against the existing `servms` database.

START TRANSACTION;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. LEGACY `inspections` TABLE — widen for the new module, keep old columns.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE `inspections`
  MODIFY COLUMN `result` ENUM('satisfactory','minor_issues','critical_failure') DEFAULT NULL;

ALTER TABLE `inspections`
  ADD COLUMN `inspection_no` VARCHAR(20) DEFAULT NULL AFTER `id`,
  ADD COLUMN `inspecting_official_name` VARCHAR(150) DEFAULT NULL AFTER `inspector_id`,
  ADD COLUMN `designation` VARCHAR(150) DEFAULT NULL AFTER `inspecting_official_name`,
  ADD COLUMN `division_id` INT(10) UNSIGNED DEFAULT NULL AFTER `designation`,
  ADD COLUMN `place_of_posting` VARCHAR(150) DEFAULT NULL AFTER `division_id`,
  ADD COLUMN `station_id` INT(10) UNSIGNED DEFAULT NULL AFTER `place_of_posting`,
  ADD COLUMN `train_id` INT(10) UNSIGNED DEFAULT NULL AFTER `station_id`,
  ADD COLUMN `inspection_category_id` INT(10) UNSIGNED DEFAULT NULL AFTER `train_id`,
  ADD COLUMN `inspection_type_id` INT(10) UNSIGNED DEFAULT NULL AFTER `inspection_category_id`,
  ADD COLUMN `observations` LONGTEXT DEFAULT NULL AFTER `inspection_type_id`,
  ADD COLUMN `deficiencies` LONGTEXT DEFAULT NULL AFTER `observations`,
  ADD COLUMN `recommendations` LONGTEXT DEFAULT NULL AFTER `deficiencies`,
  ADD COLUMN `priority` ENUM('low','medium','high') NOT NULL DEFAULT 'medium' AFTER `recommendations`,
  ADD COLUMN `inspection_status` ENUM('draft','submitted','returned','assigned','atr_submitted','under_review','approved','rejected','closed') NOT NULL DEFAULT 'draft' AFTER `priority`,
  ADD COLUMN `assigned_to_user_id` INT(10) UNSIGNED DEFAULT NULL AFTER `inspection_status`,
  ADD COLUMN `submitted_at` DATETIME DEFAULT NULL AFTER `assigned_to_user_id`,
  ADD COLUMN `closed_by` INT(10) UNSIGNED DEFAULT NULL AFTER `submitted_at`,
  ADD COLUMN `closed_at` DATETIME DEFAULT NULL AFTER `closed_by`,
  ADD COLUMN `updated_at` TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() AFTER `created_at`;

-- Backfill division_id for the 6 legacy seed rows from unit -> station -> division.
UPDATE `inspections` i
  LEFT JOIN `units` u ON u.id = i.unit_id
  LEFT JOIN `stations` st ON st.id = u.station_id
  SET i.division_id = st.division_id
  WHERE i.division_id IS NULL;

-- Legacy rows are historical, already-completed records — mark them closed so
-- they don't show up as "Pending"/"Assigned" in the new workflow's dashboard.
UPDATE `inspections` SET `inspection_status` = 'closed' WHERE `inspection_status` = 'draft';

ALTER TABLE `inspections`
  ADD UNIQUE KEY `uq_inspection_no` (`inspection_no`),
  ADD KEY `fk_inspection_division` (`division_id`),
  ADD KEY `fk_inspection_station` (`station_id`),
  ADD KEY `fk_inspection_train` (`train_id`),
  ADD KEY `fk_inspection_category` (`inspection_category_id`),
  ADD KEY `fk_inspection_type` (`inspection_type_id`),
  ADD KEY `fk_inspection_assigned_user` (`assigned_to_user_id`),
  ADD KEY `fk_inspection_closed_by` (`closed_by`),
  ADD CONSTRAINT `fk_inspection_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inspection_station` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inspection_train` FOREIGN KEY (`train_id`) REFERENCES `trains` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inspection_category` FOREIGN KEY (`inspection_category_id`) REFERENCES `dropdown_options` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inspection_type` FOREIGN KEY (`inspection_type_id`) REFERENCES `dropdown_options` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inspection_assigned_user` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inspection_closed_by` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. INSPECTION NUMBER COUNTER — atomic per-year sequence for INSP-YYYY-NNNNNN.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inspection_number_counters` (
  `year` INT(10) UNSIGNED NOT NULL,
  `last_number` INT(10) UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. INSPECTION ACTION TAKEN REPORTS — Dealing Section drafts/submits;
--    Sub-admin reviews/forwards/sends back; Admin accepts/rejects/sends back.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inspection_action_taken_reports` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `inspection_id` INT(10) UNSIGNED NOT NULL,
  `action_description` LONGTEXT NOT NULL,
  `action_date` DATE DEFAULT NULL,
  `completion_status` ENUM('in_progress','partially_completed','completed') NOT NULL DEFAULT 'in_progress',
  `remarks` TEXT DEFAULT NULL,
  `submitted_by` INT(10) UNSIGNED DEFAULT NULL,
  `submitted_at` DATETIME DEFAULT NULL,
  `review_status` ENUM('draft','pending_review','sub_admin_reviewed','accepted','rejected','sent_back') NOT NULL DEFAULT 'draft',
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
  KEY `fk_iatr_inspection` (`inspection_id`),
  KEY `fk_iatr_submitter` (`submitted_by`),
  KEY `fk_iatr_reviewer` (`reviewed_by`),
  KEY `fk_iatr_decider` (`decided_by`),
  CONSTRAINT `fk_iatr_inspection` FOREIGN KEY (`inspection_id`) REFERENCES `inspections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_iatr_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_iatr_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_iatr_decider` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. INSPECTION DOCUMENTS — unified store for inspection evidence + ATR uploads.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inspection_documents` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `inspection_id` INT(10) UNSIGNED NOT NULL,
  `atr_id` INT(10) UNSIGNED DEFAULT NULL,
  `document_type` ENUM('inspection','atr','other') NOT NULL DEFAULT 'inspection',
  `file_name` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `file_size` INT(10) UNSIGNED DEFAULT NULL,
  `file_type` VARCHAR(50) DEFAULT NULL,
  `uploaded_by` INT(10) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `status` TINYINT(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_idoc_inspection` (`inspection_id`),
  KEY `fk_idoc_atr` (`atr_id`),
  KEY `fk_idoc_uploader` (`uploaded_by`),
  CONSTRAINT `fk_idoc_inspection` FOREIGN KEY (`inspection_id`) REFERENCES `inspections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_idoc_atr` FOREIGN KEY (`atr_id`) REFERENCES `inspection_action_taken_reports` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_idoc_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. INSPECTION ASSIGNMENTS — assign / reassign / transfer + full history.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inspection_assignments` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `inspection_id` INT(10) UNSIGNED NOT NULL,
  `assignment_type` ENUM('initial','reassign','transfer') NOT NULL DEFAULT 'initial',
  `from_unit_id` INT(10) UNSIGNED DEFAULT NULL,
  `to_unit_id` INT(10) UNSIGNED DEFAULT NULL,
  `assigned_to_user_id` INT(10) UNSIGNED DEFAULT NULL,
  `assigned_by` INT(10) UNSIGNED DEFAULT NULL,
  `remarks` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_iassign_inspection` (`inspection_id`),
  KEY `fk_iassign_from_unit` (`from_unit_id`),
  KEY `fk_iassign_to_unit` (`to_unit_id`),
  KEY `fk_iassign_user` (`assigned_to_user_id`),
  KEY `fk_iassign_by` (`assigned_by`),
  CONSTRAINT `fk_iassign_inspection` FOREIGN KEY (`inspection_id`) REFERENCES `inspections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_iassign_from_unit` FOREIGN KEY (`from_unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_iassign_to_unit` FOREIGN KEY (`to_unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_iassign_user` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_iassign_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. INSPECTION STATUS HISTORY — full workflow timeline per inspection.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inspection_status_history` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `inspection_id` INT(10) UNSIGNED NOT NULL,
  `from_status` VARCHAR(30) DEFAULT NULL,
  `to_status` VARCHAR(30) NOT NULL,
  `changed_by` INT(10) UNSIGNED DEFAULT NULL,
  `remarks` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_ihist_inspection` (`inspection_id`),
  KEY `fk_ihist_user` (`changed_by`),
  CONSTRAINT `fk_ihist_inspection` FOREIGN KEY (`inspection_id`) REFERENCES `inspections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ihist_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. SEED — Inspection Category / Type dropdowns (reusing dropdown_options,
--    already extended with parent_id by migration 007). Divisional/HQ Admin &
--    Sub-admin can add more via the Inspection Category/Type master screen.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO `dropdown_options` (`category`, `parent_id`, `division_id`, `value`, `label`, `sort_order`) VALUES
('inspection_category', NULL, NULL, 'safety', 'Safety', 1),
('inspection_category', NULL, NULL, 'vigilance', 'Vigilance', 2),
('inspection_category', NULL, NULL, 'passenger_amenities', 'Passenger Amenities', 3),
('inspection_category', NULL, NULL, 'cleanliness', 'Cleanliness', 4),
('inspection_category', NULL, NULL, 'contract_compliance', 'Contract Compliance', 5),
('inspection_category', NULL, NULL, 'security', 'Security', 6);

INSERT INTO `dropdown_options` (`category`, `parent_id`, `division_id`, `value`, `label`, `sort_order`)
SELECT 'inspection_type', id, NULL, v.value, v.label, v.sort_order FROM `dropdown_options` t
JOIN (
  SELECT 'safety' AS cat_value, 'fire_safety' AS value, 'Fire Safety', 1 AS sort_order UNION ALL
  SELECT 'safety', 'electrical_safety', 'Electrical Safety', 2 UNION ALL
  SELECT 'safety', 'structural_safety', 'Structural Safety', 3 UNION ALL
  SELECT 'vigilance', 'surprise_check', 'Surprise Check', 1 UNION ALL
  SELECT 'vigilance', 'financial_irregularity', 'Financial Irregularity', 2 UNION ALL
  SELECT 'passenger_amenities', 'water_availability', 'Water Availability', 1 UNION ALL
  SELECT 'passenger_amenities', 'seating_shelter', 'Seating / Shelter', 2 UNION ALL
  SELECT 'cleanliness', 'unit_cleanliness', 'Unit Cleanliness', 1 UNION ALL
  SELECT 'cleanliness', 'surrounding_cleanliness', 'Surrounding Cleanliness', 2 UNION ALL
  SELECT 'contract_compliance', 'licence_validity', 'Licence Validity', 1 UNION ALL
  SELECT 'contract_compliance', 'unauthorized_activity', 'Unauthorized Activity', 2 UNION ALL
  SELECT 'security', 'unauthorized_vendor', 'Unauthorized Vendor', 1 UNION ALL
  SELECT 'security', 'id_card_check', 'ID Card Check', 2
) v(cat_value, value, label, sort_order) ON v.cat_value = t.value
WHERE t.category = 'inspection_category';

COMMIT;
