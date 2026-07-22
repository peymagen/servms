

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
  `resolution_date` date DEFAULT NULL,
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
