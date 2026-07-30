-- ============================================================================
-- SERVMS — Phase 1 database update for `basukala_servms`
-- Role hierarchy, RBAC permission matrix, User Management fields,
-- and Audit Log expansion.
--
-- Verified against the basukala_servms.sql dump (Jul 29, 2026 05:36 AM).
-- Back up the database before running. Safe to run once; the INSERT
-- statements are guarded with NOT EXISTS so a rerun is a no-op.
-- ============================================================================

START TRANSACTION;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. USERS — new User Management fields
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE `users`
  ADD COLUMN `hrms_id` VARCHAR(50) DEFAULT NULL AFTER `employee_id`,
  ADD COLUMN `zone_id` INT(10) UNSIGNED DEFAULT NULL AFTER `division_id`,
  -- JAG/SG apply to Admin-tier roles; Sr. Supervisor/JS/SS apply to Sub Admin-tier roles (per UAT doc).
  ADD COLUMN `designation_grade` ENUM('JAG','SG','SR_SUPERVISOR','JS','SS','OTHER') DEFAULT NULL AFTER `designation`,
  ADD COLUMN `card_signing_authority` TINYINT(1) NOT NULL DEFAULT 0 AFTER `designation_grade`,
  ADD COLUMN `signature_path` VARCHAR(255) DEFAULT NULL AFTER `profile_image`,
  ADD COLUMN `is_temp_password` TINYINT(1) NOT NULL DEFAULT 1 AFTER `password_hash`;

ALTER TABLE `users`
  ADD KEY `fk_user_zone` (`zone_id`),
  ADD CONSTRAINT `fk_user_zone` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`);

-- Adds a pending-approval state ahead of the Phase 3 Admin Module "User Approval" workflow
-- (Sub Admin creates a user, Admin approves it) — avoids a second migration just for this later.
ALTER TABLE `users`
  MODIFY COLUMN `users_status` ENUM('active','inactive','suspended','pending_approval') NOT NULL DEFAULT 'active';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. AUDIT LOGS — full audit trail columns (module/record/old/new/role/browser)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE `audit_logs`
  ADD COLUMN `record_id` VARCHAR(50) DEFAULT NULL AFTER `module_name`,
  ADD COLUMN `old_data` LONGTEXT DEFAULT NULL AFTER `record_id`,
  ADD COLUMN `new_data` LONGTEXT DEFAULT NULL AFTER `old_data`,
  ADD COLUMN `role_name` VARCHAR(50) DEFAULT NULL AFTER `user_id`,
  ADD COLUMN `user_agent` VARCHAR(500) DEFAULT NULL AFTER `ip_address`;

ALTER TABLE `audit_logs`
  ADD KEY `idx_audit_module_record` (`module_name`, `record_id`);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. ROLE_PERMISSIONS — expand module_name to cover every UAT module.
--    Step A widens the enum to the union of old+new labels so existing
--    rows stay valid while we remap them; the final ALTER narrows to the
--    final list.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE `role_permissions`
  MODIFY COLUMN `module_name` ENUM(
    'vendor_management','unit_masters','contractor_database','qr_issuance','complaints_grievances','penalties_fines',
    'user_management','role_management','id_card_management','contractor_management','unit_management',
    'location_management','penalty_management','complaint_management','inspection_management',
    'audit_logs','reports','dashboard','admin_module'
  ) NOT NULL;

UPDATE `role_permissions` SET `module_name` = 'unit_management' WHERE `module_name` = 'unit_masters';
UPDATE `role_permissions` SET `module_name` = 'contractor_management' WHERE `module_name` = 'contractor_database';
UPDATE `role_permissions` SET `module_name` = 'id_card_management' WHERE `module_name` = 'qr_issuance';
UPDATE `role_permissions` SET `module_name` = 'complaint_management' WHERE `module_name` = 'complaints_grievances';
UPDATE `role_permissions` SET `module_name` = 'penalty_management' WHERE `module_name` = 'penalties_fines';

ALTER TABLE `role_permissions`
  MODIFY COLUMN `module_name` ENUM(
    'user_management','role_management','vendor_management','contractor_management','unit_management',
    'location_management','id_card_management','penalty_management','complaint_management','inspection_management',
    'audit_logs','reports','dashboard','admin_module'
  ) NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. ROLES — remap to the 8-role hierarchy in place (preserves users.role_id
--    FKs). The ad-hoc test role "insecpotor" is already inactive on this
--    server (status = 0), so that step is a no-op here.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE `roles` SET `role_name` = 'super_admin_hq', `description` = 'Super Admin HQ — complete control over every zone and division' WHERE `role_name` = 'superadmin';
UPDATE `roles` SET `role_name` = 'divisional_admin', `description` = 'Divisional Admin — full access within a single division' WHERE `role_name` = 'admin';
-- Only overwrite the description if it's still the original seed text — preserves your
-- hand-edited "Commercial Inspector..." description already on this server.
UPDATE `roles` SET `description` = 'Inspector — creates inspections, limited dashboard access'
  WHERE `role_name` = 'inspector' AND `description` = 'Station/Health Inspector with limited dashboard access';
UPDATE `roles` SET `status` = 0 WHERE `role_name` = 'insecpotor';

INSERT INTO `roles` (`role_name`, `description`, `roles_status`)
SELECT * FROM (SELECT 'hq_admin' AS role_name, 'HQ Admin — full HQ-level access across all zones' AS description, 'active' AS roles_status) t
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `role_name` = 'hq_admin');

INSERT INTO `roles` (`role_name`, `description`, `roles_status`)
SELECT * FROM (SELECT 'hq_sub_admin', 'HQ Sub Admin — limited HQ-level access', 'active') t
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `role_name` = 'hq_sub_admin');

INSERT INTO `roles` (`role_name`, `description`, `roles_status`)
SELECT * FROM (SELECT 'divisional_sub_admin', 'Divisional Sub Admin — limited access within a division', 'active') t
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `role_name` = 'divisional_sub_admin');

INSERT INTO `roles` (`role_name`, `description`, `roles_status`)
SELECT * FROM (SELECT 'dealing_section', 'Dealing Section — ATR, recovery, and reports', 'active') t
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `role_name` = 'dealing_section');

INSERT INTO `roles` (`role_name`, `description`, `roles_status`)
SELECT * FROM (SELECT 'complaint_cell', 'Complaint Cell — complaint module only', 'active') t
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `role_name` = 'complaint_cell');

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Backfill role_permissions rows for every role x every module so the
--    RBAC middleware always finds a row (missing row = implicit deny).
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO `role_permissions` (`role_id`, `module_name`, `can_view`, `can_create`, `can_edit`, `can_delete`, `can_approve_reject`, `can_export`)
SELECT r.id, m.module_name,
  CASE WHEN r.role_name = 'super_admin_hq' THEN 1 ELSE 0 END,
  CASE WHEN r.role_name = 'super_admin_hq' THEN 1 ELSE 0 END,
  CASE WHEN r.role_name = 'super_admin_hq' THEN 1 ELSE 0 END,
  CASE WHEN r.role_name = 'super_admin_hq' THEN 1 ELSE 0 END,
  CASE WHEN r.role_name = 'super_admin_hq' THEN 1 ELSE 0 END,
  CASE WHEN r.role_name = 'super_admin_hq' THEN 1 ELSE 0 END
FROM `roles` r
CROSS JOIN (
  SELECT 'user_management' AS module_name UNION ALL SELECT 'role_management' UNION ALL SELECT 'vendor_management'
  UNION ALL SELECT 'contractor_management' UNION ALL SELECT 'unit_management' UNION ALL SELECT 'location_management'
  UNION ALL SELECT 'id_card_management' UNION ALL SELECT 'penalty_management' UNION ALL SELECT 'complaint_management'
  UNION ALL SELECT 'inspection_management' UNION ALL SELECT 'audit_logs' UNION ALL SELECT 'reports'
  UNION ALL SELECT 'dashboard' UNION ALL SELECT 'admin_module'
) m
WHERE r.status = 1
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.module_name = m.module_name
);

-- ─────────────────────────────────────────────────────────────────────────
-- 5b. UAT doc: "Divisional & HQ Admin shall have full powers in Role
--     Management Module" — override the zeroed defaults from step 5.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE role_permissions rp
JOIN roles r ON r.id = rp.role_id
SET rp.can_view = 1, rp.can_create = 1, rp.can_edit = 1, rp.can_delete = 1, rp.can_approve_reject = 1, rp.can_export = 1
WHERE rp.module_name = 'role_management' AND r.role_name IN ('hq_admin', 'divisional_admin');

-- UAT doc: "Divisional & HQ Sub-admin shall have full powers in terms of creation of
-- users in User Management Module" — create/edit, but approval stays with the Admin tier.
UPDATE role_permissions rp
JOIN roles r ON r.id = rp.role_id
SET rp.can_view = 1, rp.can_create = 1, rp.can_edit = 1
WHERE rp.module_name = 'user_management' AND r.role_name IN ('hq_sub_admin', 'divisional_sub_admin');

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Rename the seeded Super Admin HQ username per UAT requirement
-- ─────────────────────────────────────────────────────────────────────────
UPDATE `users` SET `username` = 'superadminhq' WHERE `username` = 'superadmin';

COMMIT;
