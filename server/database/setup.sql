-- ============================================================
-- SERVMS (South Eastern Railway Vendor Management System)
-- Full database setup: schema + seed data
--
-- Usage:
--   mysql -u root < setup.sql
-- or import this file via phpMyAdmin / MySQL Workbench.
--
-- Safe to re-run: drops and recreates the database each time.
-- ============================================================

DROP DATABASE IF EXISTS railway_new;
CREATE DATABASE railway_new CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE railway_new;

-- ------------------------------------------------------------
-- SCHEMA
-- ------------------------------------------------------------
SET FOREIGN_KEY_CHECKS=0;



-- -----------------------------------------------------
-- Table structure for table `audit_logs`
-- -----------------------------------------------------
CREATE TABLE `audit_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `module_name` varchar(100) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_audit_user` (`user_id`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `complaint_evidence`
-- -----------------------------------------------------
CREATE TABLE `complaint_evidence` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `complaint_id` int(10) unsigned NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `file_type` varchar(50) DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_evidence_complaint` (`complaint_id`),
  CONSTRAINT `fk_evidence_complaint` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `complaints`
-- -----------------------------------------------------
CREATE TABLE `complaints` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `complaint_code` varchar(50) NOT NULL,
  `unit_id` int(10) unsigned DEFAULT NULL,
  `location_text` varchar(255) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `occurrence_date` date DEFAULT NULL,
  `occurrence_time` time DEFAULT NULL,
  `priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `complaints_status` enum('open','investigating','resolved','rejected') NOT NULL DEFAULT 'open',
  `registered_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `complaint_code` (`complaint_code`),
  KEY `fk_complaint_unit` (`unit_id`),
  KEY `fk_complaint_user` (`registered_by`),
  CONSTRAINT `fk_complaint_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_complaint_user` FOREIGN KEY (`registered_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `contractor_documents`
-- -----------------------------------------------------
CREATE TABLE `contractor_documents` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `contractor_id` int(10) unsigned NOT NULL,
  `document_type` varchar(100) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_cdoc_contractor` (`contractor_id`),
  CONSTRAINT `fk_cdoc_contractor` FOREIGN KEY (`contractor_id`) REFERENCES `contractors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `contractors`
-- -----------------------------------------------------
CREATE TABLE `contractors` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `contractor_code` varchar(50) NOT NULL,
  `company_name` varchar(200) NOT NULL,
  `primary_contact_name` varchar(150) DEFAULT NULL,
  `primary_contact_mobile` varchar(15) DEFAULT NULL,
  `official_email` varchar(150) DEFAULT NULL,
  `registered_address` text DEFAULT NULL,
  `pan_number` varchar(10) DEFAULT NULL,
  `gstin` varchar(15) DEFAULT NULL,
  `epf_registration` varchar(50) DEFAULT NULL,
  `license_number` varchar(50) DEFAULT NULL,
  `license_validity_date` date DEFAULT NULL,
  `annual_registration_fee` decimal(10,2) DEFAULT 0.00,
  `irctc_licensed` tinyint(1) DEFAULT 0,
  `logo_image` varchar(255) DEFAULT NULL,
  `compliance_rate` decimal(5,2) DEFAULT 0.00,
  `penalty_index` decimal(5,2) DEFAULT 0.00,
  `contractors_status` enum('active','pending_approval','suspended','expired') NOT NULL DEFAULT 'pending_approval',
  `fee_status` enum('paid','overdue') NOT NULL DEFAULT 'paid',
  `division_id` int(10) unsigned DEFAULT NULL,
  `joined_date` date DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `contractor_code` (`contractor_code`),
  KEY `fk_contractor_division` (`division_id`),
  KEY `fk_contractor_creator` (`created_by`),
  CONSTRAINT `fk_contractor_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_contractor_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `divisions`
-- -----------------------------------------------------
CREATE TABLE `divisions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `zone_id` int(10) unsigned NOT NULL,
  `division_code` varchar(10) NOT NULL,
  `division_name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `division_code` (`division_code`),
  KEY `fk_div_zone` (`zone_id`),
  CONSTRAINT `fk_div_zone` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `inspections`
-- -----------------------------------------------------
CREATE TABLE `inspections` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `unit_id` int(10) unsigned NOT NULL,
  `inspector_id` int(10) unsigned DEFAULT NULL,
  `inspection_date` date NOT NULL,
  `result` enum('satisfactory','minor_issues','critical_failure') NOT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_inspection_unit` (`unit_id`),
  KEY `fk_inspection_inspector` (`inspector_id`),
  CONSTRAINT `fk_inspection_inspector` FOREIGN KEY (`inspector_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inspection_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `penalties`
-- -----------------------------------------------------
CREATE TABLE `penalties` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `penalty_code` varchar(50) NOT NULL,
  `contractor_id` int(10) unsigned DEFAULT NULL,
  `vendor_id` int(10) unsigned DEFAULT NULL,
  `unit_id` int(10) unsigned DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `reason` text DEFAULT NULL,
  `penalties_status` enum('pending','recovered','waived') NOT NULL DEFAULT 'pending',
  `issued_by` int(10) unsigned DEFAULT NULL,
  `issued_date` date DEFAULT NULL,
  `resolution_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `penalty_code` (`penalty_code`),
  KEY `fk_penalty_contractor` (`contractor_id`),
  KEY `fk_penalty_vendor` (`vendor_id`),
  KEY `fk_penalty_unit` (`unit_id`),
  KEY `fk_penalty_user` (`issued_by`),
  CONSTRAINT `fk_penalty_contractor` FOREIGN KEY (`contractor_id`) REFERENCES `contractors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_penalty_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_penalty_user` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_penalty_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `role_permissions`
-- -----------------------------------------------------
CREATE TABLE `role_permissions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `role_id` int(10) unsigned NOT NULL,
  `module_name` enum('vendor_management','unit_masters','contractor_database','qr_issuance','complaints_grievances','penalties_fines') NOT NULL,
  `can_view` tinyint(1) NOT NULL DEFAULT 0,
  `can_create` tinyint(1) NOT NULL DEFAULT 0,
  `can_edit` tinyint(1) NOT NULL DEFAULT 0,
  `can_delete` tinyint(1) NOT NULL DEFAULT 0,
  `can_approve_reject` tinyint(1) NOT NULL DEFAULT 0,
  `can_export` tinyint(1) NOT NULL DEFAULT 0,
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_role_module` (`role_id`,`module_name`),
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `roles`
-- -----------------------------------------------------
CREATE TABLE `roles` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `roles_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `stations`
-- -----------------------------------------------------
CREATE TABLE `stations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `division_id` int(10) unsigned NOT NULL,
  `station_code` varchar(10) NOT NULL,
  `station_name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `station_code` (`station_code`),
  KEY `fk_station_division` (`division_id`),
  CONSTRAINT `fk_station_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `units`
-- -----------------------------------------------------
CREATE TABLE `units` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `unit_code` varchar(50) NOT NULL,
  `unit_name` varchar(150) NOT NULL,
  `station_id` int(10) unsigned NOT NULL,
  `platform_location` varchar(100) DEFAULT NULL,
  `cluster_name` varchar(100) DEFAULT NULL,
  `contract_type` enum('long_term','short_term','temporary') DEFAULT 'long_term',
  `contract_category` varchar(100) DEFAULT NULL,
  `area_description` text DEFAULT NULL,
  `sketch_map_file` varchar(255) DEFAULT NULL,
  `contractor_id` int(10) unsigned DEFAULT NULL,
  `monthly_fee` decimal(10,2) DEFAULT 0.00,
  `license_period_start` date DEFAULT NULL,
  `license_period_end` date DEFAULT NULL,
  `units_status` enum('active','expiring','inactive','inspection_pending') NOT NULL DEFAULT 'active',
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unit_code` (`unit_code`),
  KEY `fk_unit_station` (`station_id`),
  KEY `fk_unit_contractor` (`contractor_id`),
  KEY `fk_unit_creator` (`created_by`),
  CONSTRAINT `fk_unit_contractor` FOREIGN KEY (`contractor_id`) REFERENCES `contractors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_unit_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_unit_station` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `users`
-- -----------------------------------------------------
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `username` varchar(50) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `designation` varchar(150) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `mobile` varchar(15) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role_id` int(10) unsigned NOT NULL,
  `division_id` int(10) unsigned DEFAULT NULL,
  `station_id` int(10) unsigned DEFAULT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `users_status` enum('active','inactive','suspended') NOT NULL DEFAULT 'active',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`),
  UNIQUE KEY `username` (`username`),
  KEY `fk_user_role` (`role_id`),
  KEY `fk_user_division` (`division_id`),
  KEY `fk_user_station` (`station_id`),
  CONSTRAINT `fk_user_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `fk_user_station` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `vendor_id_cards`
-- -----------------------------------------------------
CREATE TABLE `vendor_id_cards` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int(10) unsigned NOT NULL,
  `id_number` varchar(50) NOT NULL,
  `qr_code_data` varchar(255) DEFAULT NULL,
  `issued_date` date DEFAULT NULL,
  `cards_status` enum('active','pending','expired') NOT NULL DEFAULT 'pending',
  `last_checked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_number` (`id_number`),
  KEY `fk_idcard_vendor` (`vendor_id`),
  CONSTRAINT `fk_idcard_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `vendor_renewals`
-- -----------------------------------------------------
CREATE TABLE `vendor_renewals` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` int(10) unsigned NOT NULL,
  `renewal_period` varchar(50) DEFAULT NULL,
  `previous_expiry` date DEFAULT NULL,
  `new_expiry` date DEFAULT NULL,
  `medical_fitness_doc` varchar(255) DEFAULT NULL,
  `pvr_number` varchar(50) DEFAULT NULL,
  `pvr_issue_date` date DEFAULT NULL,
  `renewals_status` enum('draft','pending_approval','approved','rejected') NOT NULL DEFAULT 'draft',
  `submitted_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_renewal_vendor` (`vendor_id`),
  KEY `fk_renewal_user` (`submitted_by`),
  CONSTRAINT `fk_renewal_user` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_renewal_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `vendors`
-- -----------------------------------------------------
CREATE TABLE `vendors` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vendor_code` varchar(50) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `father_name` varchar(150) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `aadhaar_number` varchar(20) DEFAULT NULL,
  `mobile_number` varchar(15) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `blood_group` varchar(5) DEFAULT NULL,
  `emergency_contact` varchar(15) DEFAULT NULL,
  `vendor_type` enum('stationary','statutory') DEFAULT 'stationary',
  `contractor_id` int(10) unsigned DEFAULT NULL,
  `unit_id` int(10) unsigned DEFAULT NULL,
  `station_id` int(10) unsigned DEFAULT NULL,
  `division_id` int(10) unsigned DEFAULT NULL,
  `vendor_status` enum('active','pending','expired') NOT NULL DEFAULT 'pending',
  `validity_start` date DEFAULT NULL,
  `validity_end` date DEFAULT NULL,
  `police_verification_status` enum('pending','completed') DEFAULT 'pending',
  `police_verification_number` varchar(50) DEFAULT NULL,
  `police_verification_date` date DEFAULT NULL,
  `medical_fitness_status` enum('pending','completed') DEFAULT 'pending',
  `medical_fitness_doc` varchar(255) DEFAULT NULL,
  `aadhar_linked` tinyint(1) DEFAULT 0,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vendor_code` (`vendor_code`),
  KEY `fk_vendor_contractor` (`contractor_id`),
  KEY `fk_vendor_unit` (`unit_id`),
  KEY `fk_vendor_station` (`station_id`),
  KEY `fk_vendor_division` (`division_id`),
  KEY `fk_vendor_creator` (`created_by`),
  CONSTRAINT `fk_vendor_contractor` FOREIGN KEY (`contractor_id`) REFERENCES `contractors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vendor_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vendor_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vendor_station` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vendor_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -----------------------------------------------------
-- Table structure for table `zones`
-- -----------------------------------------------------
CREATE TABLE `zones` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `zone_name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `zone_name` (`zone_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS=1;

-- ------------------------------------------------------------
-- SEED DATA
-- ------------------------------------------------------------
DELETE FROM `audit_logs`;

DELETE FROM `complaint_evidence`;

DELETE FROM `complaints`;

DELETE FROM `penalties`;

DELETE FROM `vendor_id_cards`;

DELETE FROM `vendor_renewals`;

DELETE FROM `vendors`;

DELETE FROM `units`;

DELETE FROM `contractors`;

DELETE FROM `users`;

DELETE FROM `role_permissions`;

DELETE FROM `roles`;

DELETE FROM `stations`;

DELETE FROM `divisions`;

DELETE FROM `zones`;

INSERT INTO zones (zone_name) VALUES ('South Eastern Railway');

INSERT INTO divisions (zone_id, division_code, division_name) VALUES (1, 'KGP', 'Kharagpur Division');

INSERT INTO divisions (zone_id, division_code, division_name) VALUES (1, 'ADRA', 'Adra Division');

INSERT INTO divisions (zone_id, division_code, division_name) VALUES (1, 'CKP', 'Chakradharpur Division');

INSERT INTO divisions (zone_id, division_code, division_name) VALUES (1, 'RNC', 'Ranchi Division');

INSERT INTO divisions (zone_id, division_code, division_name) VALUES (1, 'TATA', 'Tatanagar Division');

INSERT INTO divisions (zone_id, division_code, division_name) VALUES (1, 'HLD', 'Haldia Division');

INSERT INTO stations (division_id, station_code, station_name) VALUES (1, 'KGP', 'Kharagpur Junction');

INSERT INTO stations (division_id, station_code, station_name) VALUES (1, 'SRC', 'Santragachi');

INSERT INTO stations (division_id, station_code, station_name) VALUES (2, 'BKSC', 'Bokaro Steel City');

INSERT INTO stations (division_id, station_code, station_name) VALUES (5, 'TATA', 'Tatanagar');

INSERT INTO stations (division_id, station_code, station_name) VALUES (4, 'RNC', 'Ranchi');

INSERT INTO stations (division_id, station_code, station_name) VALUES (1, 'HWH', 'Howrah Station');

INSERT INTO stations (division_id, station_code, station_name) VALUES (6, 'HLD', 'Haldia Station');

INSERT INTO roles (role_name, description) VALUES ('superadmin', 'HQ/System Administrator with full access across all divisions');

INSERT INTO roles (role_name, description) VALUES ('admin', 'Divisional Administrator with access restricted to a single division');

INSERT INTO roles (role_name, description) VALUES ('inspector', 'Station/Health Inspector with limited dashboard access');

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (1, 'vendor_management', 1, 1, 1, 1, 1, 1);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (2, 'vendor_management', 1, 1, 1, 0, 1, 1);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (3, 'vendor_management', 1, 1, 0, 0, 0, 0);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (1, 'unit_masters', 1, 1, 1, 1, 1, 1);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (2, 'unit_masters', 1, 1, 1, 0, 1, 1);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (3, 'unit_masters', 1, 1, 0, 0, 0, 0);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (1, 'contractor_database', 1, 1, 1, 1, 1, 1);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (2, 'contractor_database', 1, 1, 1, 0, 1, 1);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (3, 'contractor_database', 1, 1, 0, 0, 0, 0);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (1, 'qr_issuance', 1, 1, 1, 1, 1, 1);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (2, 'qr_issuance', 1, 1, 1, 0, 1, 1);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (3, 'qr_issuance', 1, 1, 0, 0, 0, 0);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (1, 'complaints_grievances', 1, 1, 1, 1, 1, 1);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (2, 'complaints_grievances', 1, 1, 1, 0, 1, 1);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (3, 'complaints_grievances', 1, 1, 0, 0, 0, 0);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (1, 'penalties_fines', 1, 1, 1, 1, 1, 1);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (2, 'penalties_fines', 1, 1, 1, 0, 1, 1);

INSERT INTO role_permissions 
        (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export) 
        VALUES (3, 'penalties_fines', 1, 1, 0, 0, 0, 0);

INSERT INTO users 
      (employee_id, username, full_name, email, mobile, password_hash, role_id, division_id, station_id, designation) 
      VALUES ('EMP-001', 'superadmin', 'HQ Superadmin User', 'superadmin@cris.org.in', '9999999999', '$2b$12$Ko8ua7pkwnAlwaDFd8Y8JOd8KfM/y62.PbtYzkV6u1JllZy3edUSS', 1, NULL, NULL, 'Sr. Administrator');

INSERT INTO users 
        (employee_id, username, full_name, email, mobile, password_hash, role_id, division_id, station_id, designation, users_status) 
        VALUES ('SER-ADM-4421', 'arun_sharma', 'Arun Sharma', 'arun.sharma@ser.railnet.gov.in', '9830011111', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 1, NULL, NULL, 'Assistant Comm. Manager', 'active');

INSERT INTO users 
        (employee_id, username, full_name, email, mobile, password_hash, role_id, division_id, station_id, designation, users_status) 
        VALUES ('SER-INS-2908', 'kiran_maurya', 'Kiran Maurya', 'kiran.m@ser.railnet.gov.in', '9830022222', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 3, 1, 1, 'Station Inspector', 'active');

INSERT INTO users 
        (employee_id, username, full_name, email, mobile, password_hash, role_id, division_id, station_id, designation, users_status) 
        VALUES ('SER-DIV-8832', 'pratik_patel', 'Pratik Patel', 'pratik.p@ser.railnet.gov.in', '9830033333', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 2, 3, 4, 'Section Officer', 'inactive');

INSERT INTO users 
        (employee_id, username, full_name, email, mobile, password_hash, role_id, division_id, station_id, designation, users_status) 
        VALUES ('SER-ADM-5521', 'sanjay_jha', 'Sanjay Jha', 'sanjay.jha@ser.railnet.gov.in', '9830044444', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 1, NULL, NULL, 'Senior Clerk', 'active');

INSERT INTO users 
        (employee_id, username, full_name, email, mobile, password_hash, role_id, division_id, station_id, designation, users_status) 
        VALUES ('SER-INS-1120', 'rina_tiwari', 'Rina Tiwari', 'rina.tiwari@ser.railnet.gov.in', '9830055555', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 3, 1, 2, 'Health Inspector', 'active');

INSERT INTO users 
        (employee_id, username, full_name, email, mobile, password_hash, role_id, division_id, station_id, designation) 
        VALUES ('EMP-ADMIN_KGP', 'admin_kgp', 'R. Prasad', 'kgp_admin@cris.org.in', '9876543210', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 2, 1, 1, 'Divisional Administrator');

INSERT INTO users 
        (employee_id, username, full_name, email, mobile, password_hash, role_id, division_id, station_id, designation) 
        VALUES ('EMP-ADMIN_ADRA', 'admin_adra', 'B. K. Sharma', 'adra_admin@cris.org.in', '9876543210', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 2, 2, 3, 'Divisional Administrator');

INSERT INTO users 
        (employee_id, username, full_name, email, mobile, password_hash, role_id, division_id, station_id, designation) 
        VALUES ('EMP-ADMIN_CKP', 'admin_ckp', 'S. K. Roy', 'ckp_admin@cris.org.in', '9876543210', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 2, 3, 4, 'Divisional Administrator');

INSERT INTO users 
        (employee_id, username, full_name, email, mobile, password_hash, role_id, division_id, station_id, designation) 
        VALUES ('EMP-ADMIN_RNC', 'admin_rnc', 'A. K. Mehta', 'rnc_admin@cris.org.in', '9876543210', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 2, 4, 5, 'Divisional Administrator');

INSERT INTO contractors 
        (contractor_code, company_name, primary_contact_name, primary_contact_mobile, official_email, division_id, contractors_status, compliance_rate) 
        VALUES ('CON-001', 'Eastern Catering Pvt. Ltd.', 'Amit Dutta', '9112233445', 'con-001@railnet.gov.in', 1, 'active', 95.5);

INSERT INTO contractors 
        (contractor_code, company_name, primary_contact_name, primary_contact_mobile, official_email, division_id, contractors_status, compliance_rate) 
        VALUES ('CON-002', 'Railway Pantry Services', 'Vikas Sinha', '9112233445', 'con-002@railnet.gov.in', 2, 'active', 90);

INSERT INTO contractors 
        (contractor_code, company_name, primary_contact_name, primary_contact_mobile, official_email, division_id, contractors_status, compliance_rate) 
        VALUES ('CON-003', 'Jha & Sons Logistics', 'Rajesh Jha', '9112233445', 'con-003@railnet.gov.in', 3, 'active', 88.2);

INSERT INTO contractors 
        (contractor_code, company_name, primary_contact_name, primary_contact_mobile, official_email, division_id, contractors_status, compliance_rate) 
        VALUES ('CON-004', 'Sai Kripa Caterers', 'K. R. Rao', '9112233445', 'con-004@railnet.gov.in', 1, 'active', 98.2);

INSERT INTO contractors 
        (contractor_code, company_name, primary_contact_name, primary_contact_mobile, official_email, division_id, contractors_status, compliance_rate) 
        VALUES ('CON-005', 'Rail Bhojan Services', 'P. K. Mishra', '9112233445', 'con-005@railnet.gov.in', 3, 'active', 92);

INSERT INTO contractors 
        (contractor_code, company_name, primary_contact_name, primary_contact_mobile, official_email, division_id, contractors_status, compliance_rate) 
        VALUES ('CON-006', 'Metro Snacks Ltd', 'Sanjiv Goenka', '9112233445', 'con-006@railnet.gov.in', 1, 'active', 75);

INSERT INTO contractors 
        (contractor_code, company_name, primary_contact_name, primary_contact_mobile, official_email, division_id, contractors_status, compliance_rate) 
        VALUES ('CON-007', 'Grand Trunk Refreshments', 'T. S. Ahluwalia', '9112233445', 'con-007@railnet.gov.in', 1, 'active', 94);

INSERT INTO contractors 
        (contractor_code, company_name, primary_contact_name, primary_contact_mobile, official_email, division_id, contractors_status, compliance_rate) 
        VALUES ('CON-008', 'Jagannath Catering', 'L. N. Patnaik', '9112233445', 'con-008@railnet.gov.in', 2, 'active', 85);

INSERT INTO units 
        (unit_code, unit_name, station_id, platform_location, contractor_id, monthly_fee, units_status) 
        VALUES ('UNT-KGP-01', 'Platform 1 Food Stall Cluster A', 1, 'Platform 1/2', 1, 15000, 'active');

INSERT INTO units 
        (unit_code, unit_name, station_id, platform_location, contractor_id, monthly_fee, units_status) 
        VALUES ('UNT-KGP-02', 'Platform 3 Tea Stall', 1, 'Platform 1/2', 4, 15000, 'active');

INSERT INTO units 
        (unit_code, unit_name, station_id, platform_location, contractor_id, monthly_fee, units_status) 
        VALUES ('UNT-SRC-01', 'Santragachi Platform 2 Snack Corner', 2, 'Platform 1/2', 7, 15000, 'active');

INSERT INTO units 
        (unit_code, unit_name, station_id, platform_location, contractor_id, monthly_fee, units_status) 
        VALUES ('UNT-BKSC-01', 'Bokaro Platform 1 Refreshment Room', 3, 'Platform 1/2', 2, 15000, 'active');

INSERT INTO units 
        (unit_code, unit_name, station_id, platform_location, contractor_id, monthly_fee, units_status) 
        VALUES ('UNT-BKSC-02', 'Bokaro Platform 2 Fruit Stall', 3, 'Platform 1/2', 8, 15000, 'active');

INSERT INTO units 
        (unit_code, unit_name, station_id, platform_location, contractor_id, monthly_fee, units_status) 
        VALUES ('UNT-TATA-01', 'Tatanagar Platform 1 Main Pantry', 4, 'Platform 1/2', 3, 15000, 'active');

INSERT INTO units 
        (unit_code, unit_name, station_id, platform_location, contractor_id, monthly_fee, units_status) 
        VALUES ('UNT-TATA-02', 'Tatanagar Platform 3 Food Plaza', 4, 'Platform 1/2', 5, 15000, 'active');

INSERT INTO units 
        (unit_code, unit_name, station_id, platform_location, contractor_id, monthly_fee, units_status) 
        VALUES ('UNT-RNC-01', 'Ranchi Platform 1 General Stall', 5, 'Platform 1/2', 3, 15000, 'active');

INSERT INTO units 
        (unit_code, unit_name, station_id, platform_location, contractor_id, monthly_fee, units_status) 
        VALUES ('UNT-HWH-01', 'Howrah Platform 17 Fast Food Corner', 6, 'Platform 1/2', 6, 15000, 'active');

INSERT INTO vendors 
        (vendor_code, full_name, father_name, date_of_birth, aadhaar_number, mobile_number, email, 
         contractor_id, unit_id, station_id, division_id, vendor_status, validity_start, validity_end, 
         police_verification_status, medical_fitness_status, aadhar_linked, created_by) 
        VALUES ('V-2024-0891', 'Subhash Mahato', 'Raman Mahato', '1990-05-15', '345678901234', '9830012345', 'subhash@gmail.com', 1, 1, 1, 1, 'active', '2024-01-01', '2025-12-12', 'completed', 'completed', 1, 1);

INSERT INTO vendor_id_cards (vendor_id, id_number, qr_code_data, issued_date, cards_status) 
         VALUES (1, 'CRIS-ID-2024-0891', 'VMS-VERIFY-CODE-V-2024-0891', '2024-01-01', 'active');

INSERT INTO vendors 
        (vendor_code, full_name, father_name, date_of_birth, aadhaar_number, mobile_number, email, 
         contractor_id, unit_id, station_id, division_id, vendor_status, validity_start, validity_end, 
         police_verification_status, medical_fitness_status, aadhar_linked, created_by) 
        VALUES ('V-2024-1102', 'Aruna Kumari', 'Shyamlal Singh', '1994-08-20', '234567890123', '9876540123', 'aruna@gmail.com', 2, 4, 3, 2, 'expired', '2022-10-01', '2023-10-15', 'completed', 'pending', 1, 1);

INSERT INTO vendor_id_cards (vendor_id, id_number, qr_code_data, issued_date, cards_status) 
         VALUES (2, 'CRIS-ID-2024-1102', 'VMS-VERIFY-CODE-V-2024-1102', '2022-10-01', 'expired');

INSERT INTO vendors 
        (vendor_code, full_name, father_name, date_of_birth, aadhaar_number, mobile_number, email, 
         contractor_id, unit_id, station_id, division_id, vendor_status, validity_start, validity_end, 
         police_verification_status, medical_fitness_status, aadhar_linked, created_by) 
        VALUES ('V-2024-0943', 'Rajesh Jha', 'Devendra Jha', '1988-12-10', '123456789012', '9431109876', 'rajesh.jha@gmail.com', 3, 6, 4, 3, 'active', '2023-06-25', '2024-06-24', 'pending', 'completed', 0, 1);

INSERT INTO vendor_id_cards (vendor_id, id_number, qr_code_data, issued_date, cards_status) 
         VALUES (3, 'CRIS-ID-2024-0943', 'VMS-VERIFY-CODE-V-2024-0943', '2023-06-25', 'active');

INSERT INTO vendors 
        (vendor_code, full_name, father_name, date_of_birth, aadhaar_number, mobile_number, email, 
         contractor_id, unit_id, station_id, division_id, vendor_status, validity_start, validity_end, 
         police_verification_status, medical_fitness_status, aadhar_linked, created_by) 
        VALUES ('V-2024-1288', 'Bikash Khan', 'Jalil Khan', '1992-02-14', '456789012345', '9007123456', 'bikash@gmail.com', 1, 1, 1, 1, 'active', '2024-02-03', '2026-02-02', 'completed', 'completed', 1, 1);

INSERT INTO vendor_id_cards (vendor_id, id_number, qr_code_data, issued_date, cards_status) 
         VALUES (4, 'CRIS-ID-2024-1288', 'VMS-VERIFY-CODE-V-2024-1288', '2024-02-03', 'active');

INSERT INTO complaints 
        (complaint_code, unit_id, location_text, category, description, occurrence_date, occurrence_time, priority, complaints_status, registered_by) 
        VALUES ('CMP-88219', 1, 'Platform Area', 'Food Quality & Hygiene', 'Found stale food and dirty trays served in platform 1 food stall.', '2023-10-24', '12:30:00', 'high', 'open', 7);

INSERT INTO complaints 
        (complaint_code, unit_id, location_text, category, description, occurrence_date, occurrence_time, priority, complaints_status, registered_by) 
        VALUES ('CMP-88214', 6, 'Platform Area', 'Overcharging', 'Charging ₹30 for a bottle of water which has MRP ₹15.', '2023-10-23', '16:45:00', 'medium', 'investigating', 7);

INSERT INTO complaints 
        (complaint_code, unit_id, location_text, category, description, occurrence_date, occurrence_time, priority, complaints_status, registered_by) 
        VALUES ('CMP-88198', 8, 'Platform Area', 'Vendor Misbehavior', 'Vendor staff was rude and argumentative when asked for bills.', '2023-10-22', '09:15:00', 'low', 'resolved', 7);

INSERT INTO complaints 
        (complaint_code, unit_id, location_text, category, description, occurrence_date, occurrence_time, priority, complaints_status, registered_by) 
        VALUES ('CMP-88152', 4, 'Platform Area', 'Unauthorized Vendor', 'An unauthorized vendor selling food on platform without proper ID card.', '2023-10-21', '18:20:00', 'high', 'investigating', 7);

INSERT INTO penalties 
        (penalty_code, contractor_id, vendor_id, unit_id, amount, reason, penalties_status, issued_by, issued_date) 
        VALUES ('PNL-2024-0012', 4, 1, 2, 25000, 'HYGIENE LAPSE: Insects found in food preparation area on inspect.', 'recovered', 7, '2024-01-10');

INSERT INTO penalties 
        (penalty_code, contractor_id, vendor_id, unit_id, amount, reason, penalties_status, issued_by, issued_date) 
        VALUES ('PNL-2024-0015', 5, NULL, 7, 12500, 'OVERCHARGING: Charging extra for tea and biscuits.', 'pending', 9, '2024-02-12');

INSERT INTO penalties 
        (penalty_code, contractor_id, vendor_id, unit_id, amount, reason, penalties_status, issued_by, issued_date) 
        VALUES ('PNL-2024-0792', 6, NULL, 9, 50000, 'ILLEGAL VENDING: Selling items outside designated platform area.', 'pending', 7, '2024-03-05');

INSERT INTO penalties 
        (penalty_code, contractor_id, vendor_id, unit_id, amount, reason, penalties_status, issued_by, issued_date) 
        VALUES ('PNL-2024-0820', 7, NULL, 3, 5000, 'UNIFORM DEFAULT: Vendor staff not wearing standard uniform/apron.', 'recovered', 7, '2024-03-15');

INSERT INTO penalties 
        (penalty_code, contractor_id, vendor_id, unit_id, amount, reason, penalties_status, issued_by, issued_date) 
        VALUES ('PNL-2024-0822', 8, NULL, 5, 15000, 'EXPIRED ITEMS: Expired dairy products found in display case.', 'pending', 8, '2024-04-02');

INSERT INTO inspections (unit_id, inspector_id, inspection_date, result, remarks) 
         VALUES (1, 3, '2024-05-10', 'satisfactory', 'Hygiene is good.');

INSERT INTO inspections (unit_id, inspector_id, inspection_date, result, remarks) 
         VALUES (2, 3, '2024-05-12', 'minor_issues', 'Slight dust on counters.');

INSERT INTO inspections (unit_id, inspector_id, inspection_date, result, remarks) 
         VALUES (3, 6, '2024-05-15', 'satisfactory', 'All vendors have valid cards.');

INSERT INTO inspections (unit_id, inspector_id, inspection_date, result, remarks) 
         VALUES (4, 3, '2024-05-18', 'critical_failure', 'Unauthorized vendors found.');

INSERT INTO inspections (unit_id, inspector_id, inspection_date, result, remarks) 
         VALUES (6, 3, '2024-05-20', 'satisfactory', 'Excellent compliance.');

INSERT INTO inspections (unit_id, inspector_id, inspection_date, result, remarks) 
         VALUES (7, 3, '2024-05-22', 'minor_issues', 'Prices not displayed clearly.');
