-- Migration 009 — Reports Module per HQ requirements:
-- Reports Dashboard, a whitelisted dynamic Report Builder (module/field/filter/
-- sort/group selection, saved templates, sharing), Excel/CSV export with an
-- audit-friendly export history, and a generic Excel import framework for
-- master data (Stations registered as the reference implementation).
--
-- Design notes (judgment calls, following the same consolidation approach as
-- migrations 007/008):
--   * The SRS lists 7 tables (reports, report_templates, report_fields,
--     report_filters, report_exports, report_import_logs, report_audit_logs).
--     `report_fields`/`report_filters` are collapsed into JSON columns on
--     `report_templates` (`fields`/`filters`/`sort`/`group_by`) — a saved
--     report's field/filter selection is always read/written as a whole unit,
--     never queried piecemeal ("find templates using field X"), so a normalized
--     child table would be pure overhead. `reports` and `report_templates` are
--     the same entity (a saved report *is* a template) and are merged into one
--     table. `report_audit_logs` reuses the existing generic `audit_logs` table
--     (module_name = "report_template"/"report_export"/"report_import"), same
--     as every other module built this session.
--   * The Report Builder's "select module/table as data source, select fields
--     dynamically" is NOT raw dynamic SQL over arbitrary table/column names —
--     that would be a SQL-injection / data-exposure hole (e.g. selecting
--     users.password_hash). It is implemented in `report.registry.ts` as a
--     server-side whitelist: each reportable module exposes a fixed, curated
--     set of fields/filters: the client only ever sends *field keys*, which
--     are looked up against the registry to get the actual safe SQL column
--     expression. See report.registry.ts for the module list.
--
-- Safe to run once against the existing `servms` database.

START TRANSACTION;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. REPORT TEMPLATES — a saved report IS a template; fields/filters/sort/
--    group-by are stored as JSON since they are always read/written whole.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `report_templates` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `module_key` VARCHAR(50) NOT NULL,
  `fields` LONGTEXT NOT NULL COMMENT 'JSON array of registry field keys',
  `filters` LONGTEXT DEFAULT NULL COMMENT 'JSON array of {field, operator, value}',
  `sort` LONGTEXT DEFAULT NULL COMMENT 'JSON {field, direction}',
  `group_by` LONGTEXT DEFAULT NULL COMMENT 'JSON array of registry field keys',
  `is_shared` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 = private to creator, 1 = visible to any user with reports:view',
  `usage_count` INT(10) UNSIGNED NOT NULL DEFAULT 0,
  `last_used_at` DATETIME DEFAULT NULL,
  `created_by` INT(10) UNSIGNED DEFAULT NULL,
  `updated_by` INT(10) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` TINYINT(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_report_template_module` (`module_key`),
  KEY `fk_report_template_creator` (`created_by`),
  KEY `fk_report_template_updater` (`updated_by`),
  CONSTRAINT `fk_report_template_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_report_template_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. REPORT EXPORTS — history for the "Recent Exports" / "Most Used Reports"
--    dashboard cards, and an audit trail of what data left the system.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `report_exports` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `report_template_id` INT(10) UNSIGNED DEFAULT NULL COMMENT 'NULL = ad-hoc export, not tied to a saved template',
  `module_key` VARCHAR(50) NOT NULL,
  `export_format` ENUM('xlsx','csv') NOT NULL DEFAULT 'xlsx',
  `filters_snapshot` LONGTEXT DEFAULT NULL,
  `row_count` INT(10) UNSIGNED NOT NULL DEFAULT 0,
  `file_name` VARCHAR(255) DEFAULT NULL,
  `exported_by` INT(10) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_report_export_template` (`report_template_id`),
  KEY `fk_report_export_user` (`exported_by`),
  KEY `idx_report_export_module` (`module_key`),
  CONSTRAINT `fk_report_export_template` FOREIGN KEY (`report_template_id`) REFERENCES `report_templates` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_report_export_user` FOREIGN KEY (`exported_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. REPORT IMPORT LOGS — generic Excel-import history, reused across every
--    registered master (mirrors complaint_import_history's shape, but keyed
--    by master_key instead of being complaint-specific).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `report_import_logs` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `master_key` VARCHAR(50) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `imported_by` INT(10) UNSIGNED DEFAULT NULL,
  `total_records` INT(10) UNSIGNED NOT NULL DEFAULT 0,
  `imported_count` INT(10) UNSIGNED NOT NULL DEFAULT 0,
  `duplicate_count` INT(10) UNSIGNED NOT NULL DEFAULT 0,
  `failed_count` INT(10) UNSIGNED NOT NULL DEFAULT 0,
  `error_report` LONGTEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_report_import_master` (`master_key`),
  KEY `fk_report_import_user` (`imported_by`),
  CONSTRAINT `fk_report_import_user` FOREIGN KEY (`imported_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. PERMISSION FIX — SRS: "HQ Admin: Full access to create, modify, delete,
--    export and manage reports." The existing seed only granted hq_admin
--    view/create/edit/approve_reject/export on the `reports` module, not
--    delete. Widen it to match — HQ Admin only, not divisional_admin (which
--    happens to share the same row today but isn't named in this SRS).
-- ─────────────────────────────────────────────────────────────────────────
UPDATE `role_permissions`
  SET `can_delete` = 1
  WHERE `module_name` = 'reports'
    AND `role_id` = (SELECT id FROM `roles` WHERE role_name = 'hq_admin' LIMIT 1);

COMMIT;
