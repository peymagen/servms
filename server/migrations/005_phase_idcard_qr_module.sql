-- Migration 005 — ID Card & QR Module: two card templates, the
-- issue-request → Sub Admin approval → auto digital-signature → QR → PDF
-- workflow, the medical-vs-PVR expiry driver choice, and generated-PDF storage.
-- Also grants Sub Admin roles the approve_reject permission on id_card_management
-- specifically (per UAT: "Sub Admin Approval" issues the card; eligibility is
-- further narrowed at the application layer to users.card_signing_authority=1).

START TRANSACTION;

ALTER TABLE `vendor_id_cards`
  MODIFY COLUMN `qr_code_data` TEXT DEFAULT NULL;

ALTER TABLE `vendor_id_cards`
  ADD COLUMN `template` ENUM('template_a','template_b') NOT NULL DEFAULT 'template_a' AFTER `vendor_id`,
  ADD COLUMN `approval_status` ENUM('draft','pending_approval','approved','rejected') NOT NULL DEFAULT 'draft' AFTER `cards_status`,
  ADD COLUMN `requested_by` INT(10) UNSIGNED DEFAULT NULL AFTER `approval_status`,
  ADD COLUMN `requested_at` DATETIME DEFAULT NULL AFTER `requested_by`,
  ADD COLUMN `approved_by` INT(10) UNSIGNED DEFAULT NULL AFTER `requested_at`,
  ADD COLUMN `approved_at` DATETIME DEFAULT NULL AFTER `approved_by`,
  ADD COLUMN `rejection_reason` TEXT DEFAULT NULL AFTER `approved_at`,
  ADD COLUMN `expiry_source` ENUM('medical','police_verification') DEFAULT NULL AFTER `rejection_reason`,
  ADD COLUMN `expiry_date` DATE DEFAULT NULL AFTER `expiry_source`,
  ADD COLUMN `signature_applied` TINYINT(1) NOT NULL DEFAULT 0 AFTER `expiry_date`,
  ADD COLUMN `pdf_path` VARCHAR(255) DEFAULT NULL AFTER `signature_applied`;

ALTER TABLE `vendor_id_cards`
  ADD KEY `fk_idcard_requested_by` (`requested_by`),
  ADD KEY `fk_idcard_approved_by` (`approved_by`),
  ADD KEY `idx_idcard_approval_status` (`approval_status`),
  ADD CONSTRAINT `fk_idcard_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_idcard_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

-- Existing cards were issued instantly under the old flow — mark them
-- pre-approved so they don't suddenly disappear from "active" views.
UPDATE `vendor_id_cards` SET `approval_status` = 'approved' WHERE `cards_status` = 'active';

-- UAT: ID cards are approved by Sub Admin (narrowed to card_signing_authority=1
-- users at the application layer) — grant the permission-matrix row so the
-- generic requirePermission gate doesn't block them before that check runs.
UPDATE role_permissions rp
JOIN roles r ON r.id = rp.role_id
SET rp.can_approve_reject = 1
WHERE rp.module_name = 'id_card_management' AND r.role_name IN ('hq_sub_admin', 'divisional_sub_admin');

COMMIT;
