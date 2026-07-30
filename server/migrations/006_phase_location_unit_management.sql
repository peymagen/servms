-- Migration 006 — Location & Unit Management rebuild per UAT doc:
-- Trains + Clusters as real entities, polymorphic Unit location (Station/Train/
-- Cluster), Contract Type (Earning/Expenditure) split from the old duration-based
-- field (renamed to duration_type, now understood to be closer to "Contract
-- Category"), a managed dropdown_options table for Contract Category, and
-- Station "No. of Platforms".
--
-- Safe to run once against the existing `servms` database.

START TRANSACTION;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. STATIONS — add "No. of Platforms" (required individual-entry field per UAT)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE `stations`
  ADD COLUMN `platform_count` INT(10) UNSIGNED DEFAULT NULL AFTER `station_name`;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. TRAINS — new entity, per UAT "Owning Division, Train Number, Train Name,
--    Source, Destination, Opposite Direction Train Number/Name/Source/Destination"
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `trains` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `division_id` INT(10) UNSIGNED NOT NULL,
  `train_number` VARCHAR(20) NOT NULL,
  `train_name` VARCHAR(150) NOT NULL,
  `source` VARCHAR(100) NOT NULL,
  `destination` VARCHAR(100) NOT NULL,
  `opposite_train_number` VARCHAR(20) DEFAULT NULL,
  `opposite_train_name` VARCHAR(150) DEFAULT NULL,
  `opposite_source` VARCHAR(100) DEFAULT NULL,
  `opposite_destination` VARCHAR(100) DEFAULT NULL,
  `created_by` INT(10) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` TINYINT(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `train_number` (`train_number`),
  KEY `fk_train_division` (`division_id`),
  KEY `fk_train_creator` (`created_by`),
  CONSTRAINT `fk_train_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`),
  CONSTRAINT `fk_train_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. LOCATION CLUSTERS — scoped to exactly one Division AND one type
--    (station-cluster or train-cluster); members must match that type+division.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `location_clusters` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `division_id` INT(10) UNSIGNED NOT NULL,
  `cluster_name` VARCHAR(150) NOT NULL,
  `cluster_type` ENUM('station','train') NOT NULL,
  `created_by` INT(10) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` TINYINT(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_cluster_division` (`division_id`),
  KEY `fk_cluster_creator` (`created_by`),
  CONSTRAINT `fk_cluster_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`),
  CONSTRAINT `fk_cluster_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `cluster_members` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `cluster_id` INT(10) UNSIGNED NOT NULL,
  `station_id` INT(10) UNSIGNED DEFAULT NULL,
  `train_id` INT(10) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_cluster_station` (`cluster_id`, `station_id`),
  UNIQUE KEY `uniq_cluster_train` (`cluster_id`, `train_id`),
  KEY `fk_member_station` (`station_id`),
  KEY `fk_member_train` (`train_id`),
  CONSTRAINT `fk_member_cluster` FOREIGN KEY (`cluster_id`) REFERENCES `location_clusters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_member_station` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_member_train` FOREIGN KEY (`train_id`) REFERENCES `trains` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. DROPDOWN OPTIONS — generic admin-managed dropdown table. First consumer
--    is Unit Management's "Contract Category" (UAT: "Divisional & HQ Admin &
--    Sub-admin shall have the access to edit and update the contents of the
--    dropdown in the Admin Module"), reusable for future doc-driven dropdowns.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `dropdown_options` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `category` VARCHAR(100) NOT NULL,
  `division_id` INT(10) UNSIGNED DEFAULT NULL COMMENT 'NULL = global option, applies to all divisions',
  `value` VARCHAR(100) NOT NULL,
  `label` VARCHAR(150) NOT NULL,
  `sort_order` INT(10) NOT NULL DEFAULT 0,
  `created_by` INT(10) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `updated_at` TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` TINYINT(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_dropdown_category` (`category`),
  KEY `fk_dropdown_division` (`division_id`),
  KEY `fk_dropdown_creator` (`created_by`),
  CONSTRAINT `fk_dropdown_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dropdown_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `dropdown_options` (`category`, `division_id`, `value`, `label`, `sort_order`) VALUES
('contract_category', NULL, 'catering', 'Catering', 1),
('contract_category', NULL, 'retail_stall', 'Retail Stall', 2),
('contract_category', NULL, 'parking', 'Parking', 3),
('contract_category', NULL, 'advertisement', 'Advertisement', 4),
('contract_category', NULL, 'cleaning', 'Cleaning', 5),
('contract_category', NULL, 'security', 'Security', 6),
('contract_category', NULL, 'maintenance', 'Maintenance', 7),
('contract_category', NULL, 'other', 'Other', 99);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. UNITS — polymorphic location (Station/Train/Cluster), Contract Type
--    (Earning/Expenditure) split from the old duration-based field, and a
--    managed Contract Category FK.
-- ─────────────────────────────────────────────────────────────────────────

-- The existing `contract_type` (long_term/short_term/temporary) is a *duration*
-- concept, not HQ's Earning/Expenditure axis — rename it so the new field can
-- own the `contract_type` name without losing this data.
ALTER TABLE `units`
  CHANGE COLUMN `contract_type` `duration_type` ENUM('long_term','short_term','temporary') DEFAULT 'long_term';

ALTER TABLE `units`
  MODIFY COLUMN `station_id` INT(10) UNSIGNED DEFAULT NULL,
  ADD COLUMN `location_type` ENUM('station','train','cluster') NOT NULL DEFAULT 'station' AFTER `unit_name`,
  ADD COLUMN `train_id` INT(10) UNSIGNED DEFAULT NULL AFTER `station_id`,
  ADD COLUMN `cluster_id` INT(10) UNSIGNED DEFAULT NULL AFTER `train_id`,
  ADD COLUMN `contract_type` ENUM('earning','expenditure') DEFAULT NULL AFTER `duration_type`,
  ADD COLUMN `contract_category_id` INT(10) UNSIGNED DEFAULT NULL AFTER `contract_category`;

ALTER TABLE `units`
  ADD KEY `fk_unit_train` (`train_id`),
  ADD KEY `fk_unit_cluster` (`cluster_id`),
  ADD KEY `fk_unit_contract_category` (`contract_category_id`),
  ADD CONSTRAINT `fk_unit_train` FOREIGN KEY (`train_id`) REFERENCES `trains` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_unit_cluster` FOREIGN KEY (`cluster_id`) REFERENCES `location_clusters` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_unit_contract_category` FOREIGN KEY (`contract_category_id`) REFERENCES `dropdown_options` (`id`) ON DELETE SET NULL;

-- All existing units are station-linked (location_type default already covers this).

COMMIT;
