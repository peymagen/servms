-- Migration 002 — Penalty Management Module: complaint/inspection linkage, approval
-- workflow (impose → approve/reject/revoke, Divisional/HQ Admin only), the
-- Pending → Partially Recovered → Recovered → Closed recovery workflow, MR/Order
-- paperwork fields, due-date tracking, and supporting documents.
--
-- Safe to run once against the existing `servms` database.

START TRANSACTION;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. PENALTIES — reference linkage (complaint/inspection origin per UAT)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE `penalties`
  ADD COLUMN `reference_type` ENUM('complaint','inspection') DEFAULT NULL AFTER `penalty_code`,
  ADD COLUMN `complaint_id` INT(10) UNSIGNED DEFAULT NULL AFTER `reference_type`,
  ADD COLUMN `inspection_id` INT(10) UNSIGNED DEFAULT NULL AFTER `complaint_id`;

ALTER TABLE `penalties`
  ADD KEY `fk_penalty_complaint` (`complaint_id`),
  ADD KEY `fk_penalty_inspection` (`inspection_id`),
  ADD CONSTRAINT `fk_penalty_complaint` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_penalty_inspection` FOREIGN KEY (`inspection_id`) REFERENCES `inspections` (`id`) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. PENALTIES — approval workflow. Imposing a penalty creates it in
--    'pending_approval'; only Divisional/HQ Admin (gated via requirePermission
--    penalty_management/approve_reject) can move it to approved/rejected, and
--    only they can later revoke an approved one.
--    Default 'approved' backfills existing rows so they stay visible/effective
--    without requiring a retroactive approval step; the app layer always sets
--    'pending_approval' explicitly on new inserts.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE `penalties`
  ADD COLUMN `approval_status` ENUM('pending_approval','approved','rejected','revoked') NOT NULL DEFAULT 'approved' AFTER `penalties_status`,
  ADD COLUMN `approved_by` INT(10) UNSIGNED DEFAULT NULL AFTER `approval_status`,
  ADD COLUMN `approved_at` DATETIME DEFAULT NULL AFTER `approved_by`,
  ADD COLUMN `revoked_by` INT(10) UNSIGNED DEFAULT NULL AFTER `approved_at`,
  ADD COLUMN `revoked_at` DATETIME DEFAULT NULL AFTER `revoked_by`,
  ADD COLUMN `revoke_reason` TEXT DEFAULT NULL AFTER `revoked_at`;

ALTER TABLE `penalties`
  ADD KEY `fk_penalty_approved_by` (`approved_by`),
  ADD KEY `fk_penalty_revoked_by` (`revoked_by`),
  ADD CONSTRAINT `fk_penalty_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_penalty_revoked_by` FOREIGN KEY (`revoked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. PENALTIES — recovery workflow: Pending → Partially Recovered → Recovered
--    → Closed, plus MR/Order paperwork and due-date tracking for the
--    dashboard aging buckets (7/14/30/30+ days) and notifications.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE `penalties`
  ADD COLUMN `recovery_status` ENUM('pending','partially_recovered','recovered','closed') NOT NULL DEFAULT 'pending' AFTER `revoke_reason`,
  ADD COLUMN `recovery_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `recovery_status`,
  ADD COLUMN `due_date` DATE DEFAULT NULL AFTER `recovery_amount`,
  ADD COLUMN `recovery_date` DATE DEFAULT NULL AFTER `due_date`,
  ADD COLUMN `mr_number` VARCHAR(50) DEFAULT NULL AFTER `recovery_date`,
  ADD COLUMN `mr_date` DATE DEFAULT NULL AFTER `mr_number`,
  ADD COLUMN `order_number` VARCHAR(50) DEFAULT NULL AFTER `mr_date`,
  ADD COLUMN `order_date` DATE DEFAULT NULL AFTER `order_number`,
  ADD COLUMN `remarks` TEXT DEFAULT NULL AFTER `order_date`;

-- Backfill recovery_status from the legacy 3-state penalties_status so existing
-- rows land in a sensible place on the new 4-state workflow. penalties_status
-- itself is kept (and kept in sync going forward) for any external consumer.
UPDATE `penalties` SET
  `recovery_status` = 'recovered',
  `recovery_amount` = `amount`,
  `recovery_date` = COALESCE(`resolution_date`, `issued_date`)
WHERE `penalties_status` = 'recovered';

UPDATE `penalties` SET
  `recovery_status` = 'closed'
WHERE `penalties_status` = 'waived';

ALTER TABLE `penalties`
  ADD KEY `idx_penalty_recovery_status` (`recovery_status`),
  ADD KEY `idx_penalty_approval_status` (`approval_status`),
  ADD KEY `idx_penalty_due_date` (`due_date`);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. PENALTY DOCUMENTS — supporting documents (evidence, orders, MR copies)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `penalty_documents` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `penalty_id` INT(10) UNSIGNED NOT NULL,
  `document_path` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(255) DEFAULT NULL,
  `uploaded_by` INT(10) UNSIGNED DEFAULT NULL,
  `uploaded_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `status` TINYINT(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_penaltydoc_penalty` (`penalty_id`),
  KEY `fk_penaltydoc_uploader` (`uploaded_by`),
  CONSTRAINT `fk_penaltydoc_penalty` FOREIGN KEY (`penalty_id`) REFERENCES `penalties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_penaltydoc_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;
