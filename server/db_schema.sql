-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 14, 2026 at 07:08 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `servms`
--

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `role_name` varchar(50) DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `module_name` varchar(100) DEFAULT NULL,
  `record_id` varchar(50) DEFAULT NULL,
  `old_data` longtext DEFAULT NULL,
  `new_data` longtext DEFAULT NULL,
  `details` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `complaints`
--

CREATE TABLE `complaints` (
  `id` int(10) UNSIGNED NOT NULL,
  `complaint_code` varchar(50) NOT NULL,
  `unit_id` int(10) UNSIGNED DEFAULT NULL,
  `location_text` varchar(255) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `occurrence_date` date DEFAULT NULL,
  `occurrence_time` time DEFAULT NULL,
  `priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `complaints_status` enum('open','investigating','resolved','rejected') NOT NULL DEFAULT 'open',
  `registered_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `complaints`
--

INSERT INTO `complaints` (`id`, `complaint_code`, `unit_id`, `location_text`, `category`, `description`, `occurrence_date`, `occurrence_time`, `priority`, `complaints_status`, `registered_by`, `created_at`, `updated_at`, `status`) VALUES
(1, 'CMP-88219', 1, 'Platform Area', 'Food Quality & Hygiene', 'Found stale food and dirty trays served in platform 1 food stall.', '2023-10-24', '12:30:00', 'high', 'open', 7, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(2, 'CMP-88214', 6, 'Platform Area', 'Overcharging', 'Charging ₹30 for a bottle of water which has MRP ₹15.', '2023-10-23', '16:45:00', 'medium', 'investigating', 7, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(3, 'CMP-88198', 8, 'Platform Area', 'Vendor Misbehavior', 'Vendor staff was rude and argumentative when asked for bills.', '2023-10-22', '09:15:00', 'low', 'resolved', 7, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(4, 'CMP-88152', 4, 'Platform Area', 'Unauthorized Vendor', 'An unauthorized vendor selling food on platform without proper ID card.', '2023-10-21', '18:20:00', 'high', 'investigating', 7, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(5, 'CMP-43044', 2, 'Platform Area', 'Food Quality & Hygiene', 'efeogog verrh', '2026-07-08', '05:25:00', 'medium', 'open', 1, '2026-07-11 13:21:44', '2026-07-11 13:21:44', 1);

-- --------------------------------------------------------

--
-- Table structure for table `complaint_evidence`
--

CREATE TABLE `complaint_evidence` (
  `id` int(10) UNSIGNED NOT NULL,
  `complaint_id` int(10) UNSIGNED NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `file_type` varchar(50) DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `complaint_evidence`
--

INSERT INTO `complaint_evidence` (`id`, `complaint_id`, `file_path`, `file_type`, `uploaded_at`, `status`) VALUES
(1, 5, '/uploads/evidence-1783776104202.png', 'image/png', '2026-07-11 13:21:44', 1);

-- --------------------------------------------------------

--
-- Table structure for table `contractors`
--

CREATE TABLE `contractors` (
  `id` int(10) UNSIGNED NOT NULL,
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
  `division_id` int(10) UNSIGNED DEFAULT NULL,
  `joined_date` date DEFAULT NULL,
  `award_date` date DEFAULT NULL,
  `tenure_months` int(10) UNSIGNED DEFAULT NULL,
  `annual_contract_value` decimal(12,2) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `contractors`
--

INSERT INTO `contractors` (`id`, `contractor_code`, `company_name`, `primary_contact_name`, `primary_contact_mobile`, `official_email`, `registered_address`, `pan_number`, `gstin`, `epf_registration`, `license_number`, `license_validity_date`, `annual_registration_fee`, `irctc_licensed`, `logo_image`, `compliance_rate`, `penalty_index`, `contractors_status`, `fee_status`, `division_id`, `joined_date`, `created_by`, `created_at`, `updated_at`, `status`) VALUES
(1, 'CON-001', 'Eastern Catering Pvt. Ltd.', 'Amit Dutta', '9112233445', 'con-001@railnet.gov.in', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 0, NULL, 95.50, 0.00, 'active', 'paid', 1, NULL, NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(2, 'CON-002', 'Railway Pantry Services', 'Vikas Sinha', '9112233445', 'con-002@railnet.gov.in', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 0, NULL, 90.00, 0.00, 'active', 'paid', 2, NULL, NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(3, 'CON-003', 'Jha & Sons Logistics', 'Rajesh Jha', '9112233445', 'con-003@railnet.gov.in', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 0, NULL, 88.20, 0.00, 'active', 'paid', 3, NULL, NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(4, 'CON-004', 'Sai Kripa Caterers', 'K. R. Rao', '9112233445', 'con-004@railnet.gov.in', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 0, NULL, 98.20, 0.00, 'active', 'paid', 1, NULL, NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(5, 'CON-005', 'Rail Bhojan Services', 'P. K. Mishra', '9112233445', 'con-005@railnet.gov.in', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 0, NULL, 92.00, 0.00, 'active', 'paid', 3, NULL, NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(6, 'CON-006', 'Metro Snacks Ltd', 'Sanjiv Goenka', '9112233445', 'con-006@railnet.gov.in', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 0, NULL, 75.00, 0.00, 'active', 'paid', 1, NULL, NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(7, 'CON-007', 'Grand Trunk Refreshments', 'T. S. Ahluwalia', '9112233445', 'con-007@railnet.gov.in', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 0, NULL, 94.00, 0.00, 'active', 'paid', 1, NULL, NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(8, 'CON-008', 'Jagannath Catering', 'L. N. Patnaik', '9112233445', 'con-008@railnet.gov.in', NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 0, NULL, 85.00, 0.00, 'active', 'paid', 2, NULL, NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(9, 'CON-009', 'peymagen', 'om', '+916207438729', 'om7185376@gmail.com', 'JHORAPOKHAR THANA JEALGORA NO 7 NEAR DURGA MANDIR', 'HCOWHC5566', NULL, NULL, NULL, '2026-05-24', 5220.00, 0, NULL, 0.00, 0.00, 'pending_approval', 'paid', 2, '2026-07-11', 1, '2026-07-11 13:50:56', '2026-07-11 13:50:56', 1);

-- --------------------------------------------------------

--
-- Table structure for table `contractor_documents`
--

CREATE TABLE `contractor_documents` (
  `id` int(10) UNSIGNED NOT NULL,
  `contractor_id` int(10) UNSIGNED NOT NULL,
  `document_type` varchar(100) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `divisions`
--

CREATE TABLE `divisions` (
  `id` int(10) UNSIGNED NOT NULL,
  `zone_id` int(10) UNSIGNED NOT NULL,
  `division_code` varchar(10) NOT NULL,
  `division_name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `divisions`
--

INSERT INTO `divisions` (`id`, `zone_id`, `division_code`, `division_name`, `created_at`, `updated_at`, `status`) VALUES
(1, 1, 'KGP', 'Kharagpur Division', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(2, 1, 'ADRA', 'Adra Division', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(3, 1, 'CKP', 'Chakradharpur Division', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(4, 1, 'RNC', 'Ranchi Division', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(5, 1, 'TATA', 'Tatanagar Division', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(6, 1, 'HLD', 'Haldia Division', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1);

-- --------------------------------------------------------

--
-- Table structure for table `inspections`
--

CREATE TABLE `inspections` (
  `id` int(10) UNSIGNED NOT NULL,
  `unit_id` int(10) UNSIGNED NOT NULL,
  `inspector_id` int(10) UNSIGNED DEFAULT NULL,
  `inspection_date` date NOT NULL,
  `result` enum('satisfactory','minor_issues','critical_failure') NOT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `inspections`
--

INSERT INTO `inspections` (`id`, `unit_id`, `inspector_id`, `inspection_date`, `result`, `remarks`, `created_at`, `status`) VALUES
(1, 1, 3, '2024-05-10', 'satisfactory', 'Hygiene is good.', '2026-07-11 13:05:26', 1),
(2, 2, 3, '2024-05-12', 'minor_issues', 'Slight dust on counters.', '2026-07-11 13:05:26', 1),
(3, 3, 6, '2024-05-15', 'satisfactory', 'All vendors have valid cards.', '2026-07-11 13:05:26', 1),
(4, 4, 3, '2024-05-18', 'critical_failure', 'Unauthorized vendors found.', '2026-07-11 13:05:26', 1),
(5, 6, 3, '2024-05-20', 'satisfactory', 'Excellent compliance.', '2026-07-11 13:05:26', 1),
(6, 7, 3, '2024-05-22', 'minor_issues', 'Prices not displayed clearly.', '2026-07-11 13:05:26', 1);

-- --------------------------------------------------------

--
-- Table structure for table `penalties`
--

CREATE TABLE `penalties` (
  `id` int(10) UNSIGNED NOT NULL,
  `penalty_code` varchar(50) NOT NULL,
  `reference_type` enum('complaint','inspection') DEFAULT NULL,
  `complaint_id` int(10) UNSIGNED DEFAULT NULL,
  `inspection_id` int(10) UNSIGNED DEFAULT NULL,
  `contractor_id` int(10) UNSIGNED DEFAULT NULL,
  `vendor_id` int(10) UNSIGNED DEFAULT NULL,
  `unit_id` int(10) UNSIGNED DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `reason` text DEFAULT NULL,
  `penalties_status` enum('pending','recovered','waived') NOT NULL DEFAULT 'pending',
  `approval_status` enum('pending_approval','approved','rejected','revoked') NOT NULL DEFAULT 'approved',
  `approved_by` int(10) UNSIGNED DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `revoked_by` int(10) UNSIGNED DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `revoke_reason` text DEFAULT NULL,
  `recovery_status` enum('pending','partially_recovered','recovered','closed') NOT NULL DEFAULT 'pending',
  `recovery_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `due_date` date DEFAULT NULL,
  `recovery_date` date DEFAULT NULL,
  `mr_number` varchar(50) DEFAULT NULL,
  `mr_date` date DEFAULT NULL,
  `order_number` varchar(50) DEFAULT NULL,
  `order_date` date DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `issued_by` int(10) UNSIGNED DEFAULT NULL,
  `issued_date` date DEFAULT NULL,
  `resolution_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `penalties`
--

INSERT INTO `penalties` (`id`, `penalty_code`, `contractor_id`, `vendor_id`, `unit_id`, `amount`, `reason`, `penalties_status`, `issued_by`, `issued_date`, `resolution_date`, `created_at`, `updated_at`, `status`) VALUES
(1, 'PNL-2024-0012', 4, 1, 2, 25000.00, 'HYGIENE LAPSE: Insects found in food preparation area on inspect.', 'recovered', 7, '2024-01-10', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(2, 'PNL-2024-0015', 5, NULL, 7, 12500.00, 'OVERCHARGING: Charging extra for tea and biscuits.', 'pending', 9, '2024-02-12', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(3, 'PNL-2024-0792', 6, NULL, 9, 50000.00, 'ILLEGAL VENDING: Selling items outside designated platform area.', 'pending', 7, '2024-03-05', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(4, 'PNL-2024-0820', 7, NULL, 3, 5000.00, 'UNIFORM DEFAULT: Vendor staff not wearing standard uniform/apron.', 'recovered', 7, '2024-03-15', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(5, 'PNL-2024-0822', 8, NULL, 5, 15000.00, 'EXPIRED ITEMS: Expired dairy products found in display case.', 'pending', 8, '2024-04-02', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(8, 'PNL-2026-1987', 1, NULL, 4, 4.00, 'egrhtj6jykyjfht', 'pending', 1, '2026-07-11', NULL, '2026-07-11 13:31:36', '2026-07-11 13:31:36', 1),
(10, 'PNL-2026-2430', 7, NULL, 5, 65666.00, 'om', 'pending', 1, '2026-07-11', NULL, '2026-07-11 13:42:56', '2026-07-11 13:42:56', 1),
(13, 'PNL-2026-7529', 8, NULL, 3, 50.00, 'bcisid', 'pending', 1, '2026-07-11', NULL, '2026-07-11 13:45:36', '2026-07-11 13:45:36', 1);

-- Backfill the new approval/recovery workflow columns from the legacy 3-state
-- penalties_status for the seeded rows above (mirrors migrations/002).
UPDATE `penalties` SET `recovery_status` = 'recovered', `recovery_amount` = `amount`,
  `recovery_date` = COALESCE(`resolution_date`, `issued_date`) WHERE `penalties_status` = 'recovered';
UPDATE `penalties` SET `recovery_status` = 'closed' WHERE `penalties_status` = 'waived';

-- --------------------------------------------------------

--
-- Table structure for table `penalty_documents`
--

CREATE TABLE `penalty_documents` (
  `id` int(10) UNSIGNED NOT NULL,
  `penalty_id` int(10) UNSIGNED NOT NULL,
  `document_path` varchar(255) NOT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `uploaded_by` int(10) UNSIGNED DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` int(10) UNSIGNED NOT NULL,
  `role_name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `roles_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `role_name`, `description`, `roles_status`, `created_at`, `updated_at`, `status`) VALUES
(1, 'super_admin_hq', 'Super Admin HQ — complete control over every zone and division', 'active', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(2, 'divisional_admin', 'Divisional Admin — full access within a single division', 'active', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(3, 'inspector', 'Inspector — creates inspections, limited dashboard access', 'active', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(4, 'insecpotor', 'wflheghoeg', 'active', '2026-07-11 13:25:43', '2026-07-11 13:25:43', 0),
(5, 'hq_admin', 'HQ Admin — full HQ-level access across all zones', 'active', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(6, 'hq_sub_admin', 'HQ Sub Admin — limited HQ-level access', 'active', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(7, 'divisional_sub_admin', 'Divisional Sub Admin — limited access within a division', 'active', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(8, 'dealing_section', 'Dealing Section — ATR, recovery, and reports', 'active', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(9, 'complaint_cell', 'Complaint Cell — complaint module only', 'active', '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1);

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `id` int(10) UNSIGNED NOT NULL,
  `role_id` int(10) UNSIGNED NOT NULL,
  `module_name` enum(
    'user_management','role_management','vendor_management','contractor_management','unit_management',
    'location_management','id_card_management','penalty_management','complaint_management','inspection_management',
    'audit_logs','reports','dashboard','admin_module'
  ) NOT NULL,
  `can_view` tinyint(1) NOT NULL DEFAULT 0,
  `can_create` tinyint(1) NOT NULL DEFAULT 0,
  `can_edit` tinyint(1) NOT NULL DEFAULT 0,
  `can_delete` tinyint(1) NOT NULL DEFAULT 0,
  `can_approve_reject` tinyint(1) NOT NULL DEFAULT 0,
  `can_export` tinyint(1) NOT NULL DEFAULT 0,
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `role_permissions`
-- Role IDs: 1=super_admin_hq, 2=divisional_admin, 3=inspector, 5=hq_admin,
--           6=hq_sub_admin, 7=divisional_sub_admin, 8=dealing_section, 9=complaint_cell
--

INSERT INTO `role_permissions` (`id`, `role_id`, `module_name`, `can_view`, `can_create`, `can_edit`, `can_delete`, `can_approve_reject`, `can_export`, `status`) VALUES
-- Super Admin HQ — full control over every module
(1, 1, 'user_management', 1, 1, 1, 1, 1, 1, 1),
(2, 1, 'role_management', 1, 1, 1, 1, 1, 1, 1),
(3, 1, 'vendor_management', 1, 1, 1, 1, 1, 1, 1),
(4, 1, 'contractor_management', 1, 1, 1, 1, 1, 1, 1),
(5, 1, 'unit_management', 1, 1, 1, 1, 1, 1, 1),
(6, 1, 'location_management', 1, 1, 1, 1, 1, 1, 1),
(7, 1, 'id_card_management', 1, 1, 1, 1, 1, 1, 1),
(8, 1, 'penalty_management', 1, 1, 1, 1, 1, 1, 1),
(9, 1, 'complaint_management', 1, 1, 1, 1, 1, 1, 1),
(10, 1, 'inspection_management', 1, 1, 1, 1, 1, 1, 1),
(11, 1, 'audit_logs', 1, 1, 1, 1, 1, 1, 1),
(12, 1, 'reports', 1, 1, 1, 1, 1, 1, 1),
(13, 1, 'dashboard', 1, 1, 1, 1, 1, 1, 1),
(14, 1, 'admin_module', 1, 1, 1, 1, 1, 1, 1),
-- Divisional Admin — full operational access within own division, no delete, view-only role/audit
(15, 2, 'user_management', 1, 1, 1, 0, 1, 1, 1),
(16, 2, 'role_management', 1, 1, 1, 1, 1, 1, 1),
(17, 2, 'vendor_management', 1, 1, 1, 0, 1, 1, 1),
(18, 2, 'contractor_management', 1, 1, 1, 0, 1, 1, 1),
(19, 2, 'unit_management', 1, 1, 1, 0, 1, 1, 1),
(20, 2, 'location_management', 1, 1, 1, 0, 1, 1, 1),
(21, 2, 'id_card_management', 1, 1, 1, 0, 1, 1, 1),
(22, 2, 'penalty_management', 1, 1, 1, 0, 1, 1, 1),
(23, 2, 'complaint_management', 1, 1, 1, 0, 1, 1, 1),
(24, 2, 'inspection_management', 1, 1, 1, 0, 1, 1, 1),
(25, 2, 'audit_logs', 1, 0, 0, 0, 0, 1, 1),
(26, 2, 'reports', 1, 1, 1, 0, 1, 1, 1),
(27, 2, 'dashboard', 1, 0, 0, 0, 0, 0, 1),
(28, 2, 'admin_module', 0, 0, 0, 0, 0, 0, 1),
-- Inspector — inspection-focused, view-only elsewhere
(29, 3, 'user_management', 0, 0, 0, 0, 0, 0, 1),
(30, 3, 'role_management', 0, 0, 0, 0, 0, 0, 1),
(31, 3, 'vendor_management', 1, 0, 0, 0, 0, 0, 1),
(32, 3, 'contractor_management', 1, 0, 0, 0, 0, 0, 1),
(33, 3, 'unit_management', 1, 0, 0, 0, 0, 0, 1),
(34, 3, 'location_management', 1, 0, 0, 0, 0, 0, 1),
(35, 3, 'id_card_management', 1, 0, 0, 0, 0, 0, 1),
(36, 3, 'penalty_management', 1, 0, 0, 0, 0, 0, 1),
(37, 3, 'complaint_management', 1, 1, 0, 0, 0, 0, 1),
(38, 3, 'inspection_management', 1, 1, 1, 0, 0, 0, 1),
(39, 3, 'audit_logs', 0, 0, 0, 0, 0, 0, 1),
(40, 3, 'reports', 1, 0, 0, 0, 0, 0, 1),
(41, 3, 'dashboard', 1, 0, 0, 0, 0, 0, 1),
(42, 3, 'admin_module', 0, 0, 0, 0, 0, 0, 1),
-- HQ Admin — full HQ-level access across all zones, no delete
(43, 5, 'user_management', 1, 1, 1, 0, 1, 1, 1),
(44, 5, 'role_management', 1, 1, 1, 1, 1, 1, 1),
(45, 5, 'vendor_management', 1, 1, 1, 0, 1, 1, 1),
(46, 5, 'contractor_management', 1, 1, 1, 0, 1, 1, 1),
(47, 5, 'unit_management', 1, 1, 1, 0, 1, 1, 1),
(48, 5, 'location_management', 1, 1, 1, 0, 1, 1, 1),
(49, 5, 'id_card_management', 1, 1, 1, 0, 1, 1, 1),
(50, 5, 'penalty_management', 1, 1, 1, 0, 1, 1, 1),
(51, 5, 'complaint_management', 1, 1, 1, 0, 1, 1, 1),
(52, 5, 'inspection_management', 1, 1, 1, 0, 1, 1, 1),
(53, 5, 'audit_logs', 1, 0, 0, 0, 0, 1, 1),
(54, 5, 'reports', 1, 1, 1, 0, 1, 1, 1),
(55, 5, 'dashboard', 1, 0, 0, 0, 0, 0, 1),
(56, 5, 'admin_module', 1, 1, 1, 0, 1, 1, 1),
-- HQ Sub Admin — limited HQ-level access, no approve/delete/export, no role/admin/audit access
(57, 6, 'user_management', 1, 1, 1, 0, 0, 0, 1),
(58, 6, 'role_management', 0, 0, 0, 0, 0, 0, 1),
(59, 6, 'vendor_management', 1, 1, 1, 0, 0, 0, 1),
(60, 6, 'contractor_management', 1, 1, 1, 0, 0, 0, 1),
(61, 6, 'unit_management', 1, 1, 1, 0, 0, 0, 1),
(62, 6, 'location_management', 1, 1, 1, 0, 0, 0, 1),
(63, 6, 'id_card_management', 1, 1, 1, 0, 1, 0, 1),
(64, 6, 'penalty_management', 1, 1, 1, 0, 0, 0, 1),
(65, 6, 'complaint_management', 1, 1, 1, 0, 0, 0, 1),
(66, 6, 'inspection_management', 1, 1, 1, 0, 0, 0, 1),
(67, 6, 'audit_logs', 0, 0, 0, 0, 0, 0, 1),
(68, 6, 'reports', 1, 0, 0, 0, 0, 1, 1),
(69, 6, 'dashboard', 1, 0, 0, 0, 0, 0, 1),
(70, 6, 'admin_module', 0, 0, 0, 0, 0, 0, 1),
-- Divisional Sub Admin — limited access within a division
(71, 7, 'user_management', 1, 1, 1, 0, 0, 0, 1),
(72, 7, 'role_management', 0, 0, 0, 0, 0, 0, 1),
(73, 7, 'vendor_management', 1, 1, 1, 0, 0, 0, 1),
(74, 7, 'contractor_management', 1, 1, 1, 0, 0, 0, 1),
(75, 7, 'unit_management', 1, 1, 1, 0, 0, 0, 1),
(76, 7, 'location_management', 1, 1, 1, 0, 0, 0, 1),
(77, 7, 'id_card_management', 1, 1, 1, 0, 1, 0, 1),
(78, 7, 'penalty_management', 1, 1, 1, 0, 0, 0, 1),
(79, 7, 'complaint_management', 1, 1, 1, 0, 0, 0, 1),
(80, 7, 'inspection_management', 1, 1, 1, 0, 0, 0, 1),
(81, 7, 'audit_logs', 0, 0, 0, 0, 0, 0, 1),
(82, 7, 'reports', 1, 0, 0, 0, 0, 0, 1),
(83, 7, 'dashboard', 1, 0, 0, 0, 0, 0, 1),
(84, 7, 'admin_module', 0, 0, 0, 0, 0, 0, 1),
-- Dealing Section — ATR, recovery, reports
(85, 8, 'user_management', 0, 0, 0, 0, 0, 0, 1),
(86, 8, 'role_management', 0, 0, 0, 0, 0, 0, 1),
(87, 8, 'vendor_management', 1, 0, 0, 0, 0, 0, 1),
(88, 8, 'contractor_management', 1, 0, 0, 0, 0, 0, 1),
(89, 8, 'unit_management', 1, 0, 0, 0, 0, 0, 1),
(90, 8, 'location_management', 1, 0, 0, 0, 0, 0, 1),
(91, 8, 'id_card_management', 1, 0, 0, 0, 0, 0, 1),
(92, 8, 'penalty_management', 1, 0, 1, 0, 0, 0, 1),
(93, 8, 'complaint_management', 1, 0, 1, 0, 0, 0, 1),
(94, 8, 'inspection_management', 1, 0, 1, 0, 0, 0, 1),
(95, 8, 'audit_logs', 0, 0, 0, 0, 0, 0, 1),
(96, 8, 'reports', 1, 0, 0, 0, 0, 1, 1),
(97, 8, 'dashboard', 1, 0, 0, 0, 0, 0, 1),
(98, 8, 'admin_module', 0, 0, 0, 0, 0, 0, 1),
-- Complaint Cell — complaint module only
(99, 9, 'user_management', 0, 0, 0, 0, 0, 0, 1),
(100, 9, 'role_management', 0, 0, 0, 0, 0, 0, 1),
(101, 9, 'vendor_management', 1, 0, 0, 0, 0, 0, 1),
(102, 9, 'contractor_management', 0, 0, 0, 0, 0, 0, 1),
(103, 9, 'unit_management', 1, 0, 0, 0, 0, 0, 1),
(104, 9, 'location_management', 1, 0, 0, 0, 0, 0, 1),
(105, 9, 'id_card_management', 0, 0, 0, 0, 0, 0, 1),
(106, 9, 'penalty_management', 0, 0, 0, 0, 0, 0, 1),
(107, 9, 'complaint_management', 1, 1, 1, 0, 0, 0, 1),
(108, 9, 'inspection_management', 0, 0, 0, 0, 0, 0, 1),
(109, 9, 'audit_logs', 0, 0, 0, 0, 0, 0, 1),
(110, 9, 'reports', 1, 0, 0, 0, 0, 0, 1),
(111, 9, 'dashboard', 1, 0, 0, 0, 0, 0, 1),
(112, 9, 'admin_module', 0, 0, 0, 0, 0, 0, 1);

-- --------------------------------------------------------

--
-- Table structure for table `stations`
--

CREATE TABLE `stations` (
  `id` int(10) UNSIGNED NOT NULL,
  `division_id` int(10) UNSIGNED NOT NULL,
  `station_code` varchar(10) NOT NULL,
  `station_name` varchar(100) NOT NULL,
  `platform_count` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stations`
--

INSERT INTO `stations` (`id`, `division_id`, `station_code`, `station_name`, `platform_count`, `created_at`, `updated_at`, `status`) VALUES
(1, 1, 'KGP', 'Kharagpur Junction', 6, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(2, 1, 'SRC', 'Santragachi', 4, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(3, 2, 'BKSC', 'Bokaro Steel City', 3, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(4, 5, 'TATA', 'Tatanagar', 5, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(5, 4, 'RNC', 'Ranchi', 4, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(6, 1, 'HWH', 'Howrah Station', 21, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(7, 6, 'HLD', 'Haldia Station', 2, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1);

-- --------------------------------------------------------

--
-- Table structure for table `trains`
--

CREATE TABLE `trains` (
  `id` int(10) UNSIGNED NOT NULL,
  `division_id` int(10) UNSIGNED NOT NULL,
  `train_number` varchar(20) NOT NULL,
  `train_name` varchar(150) NOT NULL,
  `source` varchar(100) NOT NULL,
  `destination` varchar(100) NOT NULL,
  `opposite_train_number` varchar(20) DEFAULT NULL,
  `opposite_train_name` varchar(150) DEFAULT NULL,
  `opposite_source` varchar(100) DEFAULT NULL,
  `opposite_destination` varchar(100) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `location_clusters`
--

CREATE TABLE `location_clusters` (
  `id` int(10) UNSIGNED NOT NULL,
  `division_id` int(10) UNSIGNED NOT NULL,
  `cluster_name` varchar(150) NOT NULL,
  `cluster_type` enum('station','train') NOT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cluster_members`
--

CREATE TABLE `cluster_members` (
  `id` int(10) UNSIGNED NOT NULL,
  `cluster_id` int(10) UNSIGNED NOT NULL,
  `station_id` int(10) UNSIGNED DEFAULT NULL,
  `train_id` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dropdown_options`
--

CREATE TABLE `dropdown_options` (
  `id` int(10) UNSIGNED NOT NULL,
  `category` varchar(100) NOT NULL,
  `division_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'NULL = global option, applies to all divisions',
  `value` varchar(100) NOT NULL,
  `label` varchar(150) NOT NULL,
  `sort_order` int(10) NOT NULL DEFAULT 0,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `dropdown_options`
--

INSERT INTO `dropdown_options` (`id`, `category`, `division_id`, `value`, `label`, `sort_order`, `created_by`, `created_at`, `updated_at`, `status`) VALUES
(1, 'contract_category', NULL, 'catering', 'Catering', 1, NULL, '2026-07-30 00:00:00', '2026-07-30 00:00:00', 1),
(2, 'contract_category', NULL, 'retail_stall', 'Retail Stall', 2, NULL, '2026-07-30 00:00:00', '2026-07-30 00:00:00', 1),
(3, 'contract_category', NULL, 'parking', 'Parking', 3, NULL, '2026-07-30 00:00:00', '2026-07-30 00:00:00', 1),
(4, 'contract_category', NULL, 'advertisement', 'Advertisement', 4, NULL, '2026-07-30 00:00:00', '2026-07-30 00:00:00', 1),
(5, 'contract_category', NULL, 'cleaning', 'Cleaning', 5, NULL, '2026-07-30 00:00:00', '2026-07-30 00:00:00', 1),
(6, 'contract_category', NULL, 'security', 'Security', 6, NULL, '2026-07-30 00:00:00', '2026-07-30 00:00:00', 1),
(7, 'contract_category', NULL, 'maintenance', 'Maintenance', 7, NULL, '2026-07-30 00:00:00', '2026-07-30 00:00:00', 1),
(8, 'contract_category', NULL, 'other', 'Other', 99, NULL, '2026-07-30 00:00:00', '2026-07-30 00:00:00', 1);

-- --------------------------------------------------------

--
-- Table structure for table `units`
--

CREATE TABLE `units` (
  `id` int(10) UNSIGNED NOT NULL,
  `unit_code` varchar(50) NOT NULL,
  `unit_name` varchar(150) NOT NULL,
  `location_type` enum('station','train','cluster') NOT NULL DEFAULT 'station',
  `station_id` int(10) UNSIGNED DEFAULT NULL,
  `train_id` int(10) UNSIGNED DEFAULT NULL,
  `cluster_id` int(10) UNSIGNED DEFAULT NULL,
  `platform_location` varchar(100) DEFAULT NULL,
  `cluster_name` varchar(100) DEFAULT NULL,
  `duration_type` enum('long_term','short_term','temporary') DEFAULT 'long_term',
  `contract_type` enum('earning','expenditure') DEFAULT NULL,
  `contract_category` varchar(100) DEFAULT NULL,
  `contract_category_id` int(10) UNSIGNED DEFAULT NULL,
  `area_description` text DEFAULT NULL,
  `sketch_map_file` varchar(255) DEFAULT NULL,
  `contractor_id` int(10) UNSIGNED DEFAULT NULL,
  `monthly_fee` decimal(10,2) DEFAULT 0.00,
  `license_period_start` date DEFAULT NULL,
  `license_period_end` date DEFAULT NULL,
  `units_status` enum('active','expiring','inactive','inspection_pending') NOT NULL DEFAULT 'active',
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `units`
--

INSERT INTO `units` (`id`, `unit_code`, `unit_name`, `station_id`, `platform_location`, `cluster_name`, `duration_type`, `contract_category`, `area_description`, `sketch_map_file`, `contractor_id`, `monthly_fee`, `license_period_start`, `license_period_end`, `units_status`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'UNT-KGP-01', 'Platform 1 Food Stall Cluster A', 1, 'Platform 1/2', NULL, 'long_term', NULL, NULL, NULL, 1, 15000.00, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26'),
(2, 'UNT-KGP-02', 'Platform 3 Tea Stall', 1, 'Platform 1/2', NULL, 'long_term', NULL, NULL, NULL, 4, 15000.00, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26'),
(3, 'UNT-SRC-01', 'Santragachi Platform 2 Snack Corner', 2, 'Platform 1/2', NULL, 'long_term', NULL, NULL, NULL, 7, 15000.00, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26'),
(4, 'UNT-BKSC-01', 'Bokaro Platform 1 Refreshment Room', 3, 'Platform 1/2', NULL, 'long_term', NULL, NULL, NULL, 2, 15000.00, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26'),
(5, 'UNT-BKSC-02', 'Bokaro Platform 2 Fruit Stall', 3, 'Platform 1/2', NULL, 'long_term', NULL, NULL, NULL, 8, 15000.00, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26'),
(6, 'UNT-TATA-01', 'Tatanagar Platform 1 Main Pantry', 4, 'Platform 1/2', NULL, 'long_term', NULL, NULL, NULL, 3, 15000.00, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26'),
(7, 'UNT-TATA-02', 'Tatanagar Platform 3 Food Plaza', 4, 'Platform 1/2', NULL, 'long_term', NULL, NULL, NULL, 5, 15000.00, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26'),
(8, 'UNT-RNC-01', 'Ranchi Platform 1 General Stall', 5, 'Platform 1/2', NULL, 'long_term', NULL, NULL, NULL, 3, 15000.00, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26'),
(9, 'UNT-HWH-01', 'Howrah Platform 17 Fast Food Corner', 6, 'Platform 1/2', NULL, 'long_term', NULL, NULL, NULL, 6, 15000.00, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26'),
(10, '455', 'tea', 7, NULL, NULL, 'short_term', NULL, NULL, NULL, NULL, 0.00, NULL, NULL, 'inactive', 1, '2026-07-11 13:26:13', '2026-07-12 14:42:37');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `employee_id` varchar(50) NOT NULL,
  `hrms_id` varchar(50) DEFAULT NULL,
  `username` varchar(50) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `designation` varchar(150) DEFAULT NULL,
  `designation_grade` enum('JAG','SG','SR_SUPERVISOR','JS','SS','OTHER') DEFAULT NULL,
  `card_signing_authority` tinyint(1) NOT NULL DEFAULT 0,
  `email` varchar(150) DEFAULT NULL,
  `mobile` varchar(15) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `is_temp_password` tinyint(1) NOT NULL DEFAULT 1,
  `role_id` int(10) UNSIGNED NOT NULL,
  `division_id` int(10) UNSIGNED DEFAULT NULL,
  `zone_id` int(10) UNSIGNED DEFAULT NULL,
  `station_id` int(10) UNSIGNED DEFAULT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `signature_path` varchar(255) DEFAULT NULL,
  `users_status` enum('active','inactive','suspended','pending_approval') NOT NULL DEFAULT 'active',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `employee_id`, `hrms_id`, `username`, `full_name`, `designation`, `designation_grade`, `card_signing_authority`, `email`, `mobile`, `password_hash`, `is_temp_password`, `role_id`, `division_id`, `zone_id`, `station_id`, `profile_image`, `signature_path`, `users_status`, `last_login_at`, `created_at`, `updated_at`, `status`) VALUES
(1, 'EMP-001', NULL, 'superadminhq', 'HQ Superadmin User', 'Sr. Administrator', NULL, 0, 'superadmin@cris.org.in', '9999999999', '$2b$12$Ko8ua7pkwnAlwaDFd8Y8JOd8KfM/y62.PbtYzkV6u1JllZy3edUSS', 0, 1, NULL, NULL, NULL, NULL, NULL, 'active', '2026-07-11 18:50:29', '2026-07-11 13:05:26', '2026-07-11 13:20:29', 1),
(2, 'SER-ADM-4421', NULL, 'arun_sharma', 'Arun Sharma', 'Assistant Comm. Manager', NULL, 0, 'arun.sharma@ser.railnet.gov.in', '9830011111', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 0, 1, NULL, NULL, NULL, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(3, 'SER-INS-2908', NULL, 'kiran_maurya', 'Kiran Maurya', 'Station Inspector', NULL, 0, 'kiran.m@ser.railnet.gov.in', '9830022222', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 0, 3, 1, NULL, 1, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(4, 'SER-DIV-8832', NULL, 'pratik_patel', 'Pratik Patel', 'Section Officer', NULL, 0, 'pratik.p@ser.railnet.gov.in', '9830033333', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 0, 2, 3, NULL, 4, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-12 18:25:41', 1),
(5, 'SER-ADM-5521', NULL, 'sanjay_jha', 'Sanjay Jha', 'Senior Clerk', NULL, 0, 'sanjay.jha@ser.railnet.gov.in', '9830044444', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 0, 1, NULL, NULL, NULL, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(6, 'SER-INS-1120', NULL, 'rina_tiwari', 'Rina Tiwari', 'Health Inspector', NULL, 0, 'rina.tiwari@ser.railnet.gov.in', '9830055555', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 0, 3, 1, NULL, 2, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(7, 'EMP-ADMIN_KGP', NULL, 'admin_kgp', 'R. Prasad', 'Divisional Administrator', 'JS', 1, 'kgp_admin@cris.org.in', '9876543210', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 0, 2, 1, NULL, 1, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(8, 'EMP-ADMIN_ADRA', NULL, 'admin_adra', 'B. K. Sharma', 'Divisional Administrator', 'JS', 1, 'adra_admin@cris.org.in', '9876543210', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 0, 2, 2, NULL, 3, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(9, 'EMP-ADMIN_CKP', NULL, 'admin_ckp', 'S. K. Roy', 'Divisional Administrator', 'JS', 1, 'ckp_admin@cris.org.in', '9876543210', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 0, 2, 3, NULL, 4, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(10, 'EMP-ADMIN_RNC', NULL, 'admin_rnc', 'A. K. Mehta', 'Divisional Administrator', 'JS', 1, 'rnc_admin@cris.org.in', '9876543210', '$2b$12$/7BeKIQB9wF7MxBFyJTtdu73HGuXAGb8AnSPz8TWC0AlNzWbIoy.S', 0, 2, 4, NULL, 5, NULL, NULL, 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1);

-- --------------------------------------------------------

--
-- Table structure for table `vendors`
--

CREATE TABLE `vendors` (
  `id` int(10) UNSIGNED NOT NULL,
  `vendor_code` varchar(50) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `father_name` varchar(150) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `aadhaar_number` varchar(20) DEFAULT NULL,
  `mobile_number` varchar(15) DEFAULT NULL,
  `address` varchar(200) DEFAULT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `signature_path` varchar(255) DEFAULT NULL,
  `blood_group` varchar(5) DEFAULT NULL,
  `emergency_contact` varchar(15) DEFAULT NULL,
  `vendor_type` enum('train_tsv','station_pf','station_stall','station_others') NOT NULL DEFAULT 'station_others',
  `contractor_id` int(10) UNSIGNED DEFAULT NULL,
  `unit_id` int(10) UNSIGNED DEFAULT NULL,
  `station_id` int(10) UNSIGNED DEFAULT NULL,
  `division_id` int(10) UNSIGNED DEFAULT NULL,
  `vendor_status` enum('active','pending','expired') NOT NULL DEFAULT 'pending',
  `validity_start` date DEFAULT NULL,
  `validity_end` date DEFAULT NULL,
  `police_verification_status` enum('pending','verified','rejected','expired') NOT NULL DEFAULT 'pending',
  `police_verification_issue_date` date DEFAULT NULL,
  `police_verification_valid_till` date DEFAULT NULL,
  `police_verification_remarks` text DEFAULT NULL,
  `police_verification_document` varchar(255) DEFAULT NULL,
  `medical_verification_status` enum('pending','verified','rejected','expired') NOT NULL DEFAULT 'pending',
  `medical_verification_issue_date` date DEFAULT NULL,
  `medical_verification_valid_till` date DEFAULT NULL,
  `medical_verification_remarks` text DEFAULT NULL,
  `medical_verification_document` varchar(255) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `vendors`
--

INSERT INTO `vendors` (`id`, `vendor_code`, `full_name`, `father_name`, `date_of_birth`, `aadhaar_number`, `mobile_number`, `address`, `profile_image`, `blood_group`, `emergency_contact`, `vendor_type`, `contractor_id`, `unit_id`, `station_id`, `division_id`, `vendor_status`, `validity_start`, `validity_end`, `police_verification_status`, `police_verification_issue_date`, `police_verification_valid_till`, `police_verification_remarks`, `police_verification_document`, `medical_verification_status`, `medical_verification_issue_date`, `medical_verification_valid_till`, `medical_verification_remarks`, `medical_verification_document`, `created_by`, `created_at`, `updated_at`, `status`) VALUES
(1, 'V-2024-0891', 'Subhash Mahato', 'Raman Mahato', '1990-05-15', '345678901234', '9830012345', 'Platform 1, Kharagpur Junction', NULL, NULL, NULL, 'station_others', 1, 1, 1, 1, 'active', '2024-01-01', '2025-12-12', 'verified', NULL, NULL, NULL, NULL, 'verified', NULL, NULL, NULL, NULL, 1, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(2, 'V-2024-1102', 'Aruna Kumari', 'Shyamlal Singh', '1994-08-20', '234567890123', '9876540123', 'Bokaro Steel City, ADRA Division', NULL, NULL, NULL, 'station_others', 2, 4, 3, 2, 'active', '2022-10-01', '2028-02-25', 'verified', NULL, NULL, NULL, NULL, 'pending', NULL, NULL, NULL, NULL, 1, '2026-07-11 13:05:26', '2026-07-12 18:31:13', 1),
(3, 'V-2024-0943', 'Rajesh Jha', 'Devendra Jha', '1988-12-10', '123456789012', '9431109876', 'Tatanagar, CKP Division', NULL, NULL, NULL, 'station_others', 3, 6, 4, 3, 'active', '2023-06-25', '2026-07-16', 'pending', NULL, NULL, NULL, NULL, 'verified', NULL, NULL, NULL, NULL, 1, '2026-07-11 13:05:26', '2026-07-11 13:30:41', 1),
(4, 'V-2024-1288', 'Bikash Khan', 'Jalil Khan', '1992-02-14', '456789012345', '9007123456', 'Platform 1, Kharagpur Junction', NULL, NULL, NULL, 'station_others', 1, 1, 1, 1, 'active', '2024-02-03', '2026-02-02', 'verified', NULL, NULL, NULL, NULL, 'verified', NULL, NULL, NULL, NULL, 1, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(5, 'V-2026-9594', 'OM Sharma', 'prakash', '2004-11-24', '277859614719', '+916207438729', 'Jealgorah, Jharkhand', '/uploads/profile_image-1783855036812.png', NULL, NULL, 'train_tsv', 7, 4, 3, 2, 'pending', '2026-04-04', '2028-12-15', 'verified', '2022-11-24', NULL, '442254236665', NULL, 'verified', NULL, NULL, NULL, '/uploads/medical_doc-1783855036815.png', 1, '2026-07-12 11:17:16', '2026-07-12 11:17:16', 1);

-- --------------------------------------------------------

--
-- Table structure for table `vendor_id_cards`
--

CREATE TABLE `vendor_id_cards` (
  `id` int(10) UNSIGNED NOT NULL,
  `vendor_id` int(10) UNSIGNED NOT NULL,
  `template` enum('template_a','template_b') NOT NULL DEFAULT 'template_a',
  `id_number` varchar(50) NOT NULL,
  `qr_code_data` text DEFAULT NULL,
  `issued_date` date DEFAULT NULL,
  `cards_status` enum('active','pending','expired') NOT NULL DEFAULT 'pending',
  `approval_status` enum('draft','pending_approval','approved','rejected') NOT NULL DEFAULT 'draft',
  `requested_by` int(10) UNSIGNED DEFAULT NULL,
  `requested_at` datetime DEFAULT NULL,
  `approved_by` int(10) UNSIGNED DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `expiry_source` enum('medical','police_verification') DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `signature_applied` tinyint(1) NOT NULL DEFAULT 0,
  `pdf_path` varchar(255) DEFAULT NULL,
  `last_checked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `vendor_id_cards`
--

INSERT INTO `vendor_id_cards` (`id`, `vendor_id`, `id_number`, `qr_code_data`, `issued_date`, `cards_status`, `last_checked_at`, `created_at`, `updated_at`, `status`) VALUES
(1, 1, 'CRIS-ID-2024-0891', 'VMS-VERIFY-CODE-V-2024-0891', '2026-07-11', 'active', '2026-07-11 19:08:23', '2026-07-11 13:05:26', '2026-07-11 13:38:23', 1),
(2, 2, 'CRIS-ID-2024-1102', 'VMS-VERIFY-CODE-V-2024-1102', '2022-10-01', 'expired', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(3, 3, 'CRIS-ID-2024-0943', 'VMS-VERIFY-CODE-V-2024-0943', '2023-06-25', 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(4, 4, 'CRIS-ID-2024-1288', 'VMS-VERIFY-CODE-V-2024-1288', '2024-02-03', 'active', NULL, '2026-07-11 13:05:26', '2026-07-11 13:05:26', 1),
(5, 5, 'CRIS-ID-9594', 'VMS-VERIFY-CODE-V-2026-9594', '2026-07-12', 'active', '2026-07-12 16:57:42', '2026-07-12 11:17:16', '2026-07-12 11:27:42', 1);

-- Existing cards were issued instantly under the old flow — mark them pre-approved
-- so they don't disappear from "active" views (mirrors migrations/005).
UPDATE `vendor_id_cards` SET `approval_status` = 'approved' WHERE `cards_status` = 'active';

-- --------------------------------------------------------

--
-- Table structure for table `vendor_documents`
--

CREATE TABLE `vendor_documents` (
  `id` int(10) UNSIGNED NOT NULL,
  `vendor_id` int(10) UNSIGNED NOT NULL,
  `document_type` enum('AADHAAR','MEDICAL','POLICE_VERIFICATION') NOT NULL,
  `document_path` varchar(255) NOT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `uploaded_by` int(10) UNSIGNED DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `vendor_renewals`
--

CREATE TABLE `vendor_renewals` (
  `id` int(10) UNSIGNED NOT NULL,
  `vendor_id` int(10) UNSIGNED NOT NULL,
  `renewal_period` varchar(50) DEFAULT NULL,
  `previous_expiry` date DEFAULT NULL,
  `new_expiry` date DEFAULT NULL,
  `medical_fitness_doc` varchar(255) DEFAULT NULL,
  `pvr_number` varchar(50) DEFAULT NULL,
  `pvr_issue_date` date DEFAULT NULL,
  `renewals_status` enum('draft','pending_approval','approved','rejected') NOT NULL DEFAULT 'draft',
  `submitted_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `vendor_renewals`
--

INSERT INTO `vendor_renewals` (`id`, `vendor_id`, `renewal_period`, `previous_expiry`, `new_expiry`, `medical_fitness_doc`, `pvr_number`, `pvr_issue_date`, `renewals_status`, `submitted_by`, `created_at`, `updated_at`, `status`) VALUES
(1, 3, '3 Years Extension (Standard)', '2024-06-24', '2026-07-16', NULL, NULL, '2025-07-02', 'approved', 1, '2026-07-11 13:22:33', '2026-07-11 13:30:41', 1),
(2, 2, '3 Years Extension (Standard)', '2023-10-15', '2028-02-25', NULL, '558855', '2026-02-26', 'approved', 1, '2026-07-11 13:51:57', '2026-07-12 18:31:13', 1);

-- --------------------------------------------------------

--
-- Table structure for table `zones`
--

CREATE TABLE `zones` (
  `id` int(10) UNSIGNED NOT NULL,
  `zone_name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` tinyint(4) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `zones`
--

INSERT INTO `zones` (`id`, `zone_name`, `created_at`, `status`) VALUES
(1, 'South Eastern Railway', '2026-07-11 13:05:25', 1);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_audit_user` (`user_id`),
  ADD KEY `idx_audit_module_record` (`module_name`,`record_id`);

--
-- Indexes for table `complaints`
--
ALTER TABLE `complaints`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `complaint_code` (`complaint_code`),
  ADD KEY `fk_complaint_unit` (`unit_id`),
  ADD KEY `fk_complaint_user` (`registered_by`);

--
-- Indexes for table `complaint_evidence`
--
ALTER TABLE `complaint_evidence`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_evidence_complaint` (`complaint_id`);

--
-- Indexes for table `contractors`
--
ALTER TABLE `contractors`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `contractor_code` (`contractor_code`),
  ADD KEY `fk_contractor_division` (`division_id`),
  ADD KEY `fk_contractor_creator` (`created_by`);

--
-- Indexes for table `contractor_documents`
--
ALTER TABLE `contractor_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_cdoc_contractor` (`contractor_id`);

--
-- Indexes for table `divisions`
--
ALTER TABLE `divisions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `division_code` (`division_code`),
  ADD KEY `fk_div_zone` (`zone_id`);

--
-- Indexes for table `inspections`
--
ALTER TABLE `inspections`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_inspection_unit` (`unit_id`),
  ADD KEY `fk_inspection_inspector` (`inspector_id`);

--
-- Indexes for table `penalties`
--
ALTER TABLE `penalties`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `penalty_code` (`penalty_code`),
  ADD KEY `fk_penalty_contractor` (`contractor_id`),
  ADD KEY `fk_penalty_vendor` (`vendor_id`),
  ADD KEY `fk_penalty_unit` (`unit_id`),
  ADD KEY `fk_penalty_user` (`issued_by`),
  ADD KEY `fk_penalty_complaint` (`complaint_id`),
  ADD KEY `fk_penalty_inspection` (`inspection_id`),
  ADD KEY `fk_penalty_approved_by` (`approved_by`),
  ADD KEY `fk_penalty_revoked_by` (`revoked_by`),
  ADD KEY `idx_penalty_recovery_status` (`recovery_status`),
  ADD KEY `idx_penalty_approval_status` (`approval_status`),
  ADD KEY `idx_penalty_due_date` (`due_date`);

--
-- Indexes for table `penalty_documents`
--
ALTER TABLE `penalty_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_penaltydoc_penalty` (`penalty_id`),
  ADD KEY `fk_penaltydoc_uploader` (`uploaded_by`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `role_name` (`role_name`);

--
-- Indexes for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_role_module` (`role_id`,`module_name`);

--
-- Indexes for table `stations`
--
ALTER TABLE `stations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `station_code` (`station_code`),
  ADD KEY `fk_station_division` (`division_id`);

--
-- Indexes for table `trains`
--
ALTER TABLE `trains`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `train_number` (`train_number`),
  ADD KEY `fk_train_division` (`division_id`),
  ADD KEY `fk_train_creator` (`created_by`);

--
-- Indexes for table `location_clusters`
--
ALTER TABLE `location_clusters`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_cluster_division` (`division_id`),
  ADD KEY `fk_cluster_creator` (`created_by`);

--
-- Indexes for table `cluster_members`
--
ALTER TABLE `cluster_members`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_cluster_station` (`cluster_id`,`station_id`),
  ADD UNIQUE KEY `uniq_cluster_train` (`cluster_id`,`train_id`),
  ADD KEY `fk_member_station` (`station_id`),
  ADD KEY `fk_member_train` (`train_id`);

--
-- Indexes for table `dropdown_options`
--
ALTER TABLE `dropdown_options`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_dropdown_category` (`category`),
  ADD KEY `fk_dropdown_division` (`division_id`),
  ADD KEY `fk_dropdown_creator` (`created_by`);

--
-- Indexes for table `units`
--
ALTER TABLE `units`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unit_code` (`unit_code`),
  ADD KEY `fk_unit_station` (`station_id`),
  ADD KEY `fk_unit_train` (`train_id`),
  ADD KEY `fk_unit_cluster` (`cluster_id`),
  ADD KEY `fk_unit_contract_category` (`contract_category_id`),
  ADD KEY `fk_unit_contractor` (`contractor_id`),
  ADD KEY `fk_unit_creator` (`created_by`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `employee_id` (`employee_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `fk_user_role` (`role_id`),
  ADD KEY `fk_user_division` (`division_id`),
  ADD KEY `fk_user_zone` (`zone_id`),
  ADD KEY `fk_user_station` (`station_id`);

--
-- Indexes for table `vendors`
--
ALTER TABLE `vendors`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `vendor_code` (`vendor_code`),
  ADD KEY `fk_vendor_contractor` (`contractor_id`),
  ADD KEY `fk_vendor_unit` (`unit_id`),
  ADD KEY `fk_vendor_station` (`station_id`),
  ADD KEY `fk_vendor_division` (`division_id`),
  ADD KEY `fk_vendor_creator` (`created_by`);

--
-- Indexes for table `vendor_id_cards`
--
ALTER TABLE `vendor_id_cards`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id_number` (`id_number`),
  ADD KEY `fk_idcard_vendor` (`vendor_id`),
  ADD KEY `fk_idcard_requested_by` (`requested_by`),
  ADD KEY `fk_idcard_approved_by` (`approved_by`),
  ADD KEY `idx_idcard_approval_status` (`approval_status`);

--
-- Indexes for table `vendor_documents`
--
ALTER TABLE `vendor_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_vdoc_vendor` (`vendor_id`),
  ADD KEY `fk_vdoc_uploader` (`uploaded_by`);

--
-- Indexes for table `vendor_renewals`
--
ALTER TABLE `vendor_renewals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_renewal_vendor` (`vendor_id`),
  ADD KEY `fk_renewal_user` (`submitted_by`);

--
-- Indexes for table `zones`
--
ALTER TABLE `zones`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `zone_name` (`zone_name`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `complaints`
--
ALTER TABLE `complaints`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `complaint_evidence`
--
ALTER TABLE `complaint_evidence`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `contractors`
--
ALTER TABLE `contractors`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `contractor_documents`
--
ALTER TABLE `contractor_documents`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `divisions`
--
ALTER TABLE `divisions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `inspections`
--
ALTER TABLE `inspections`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `penalties`
--
ALTER TABLE `penalties`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `penalty_documents`
--
ALTER TABLE `penalty_documents`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `role_permissions`
--
ALTER TABLE `role_permissions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=113;

--
-- AUTO_INCREMENT for table `stations`
--
ALTER TABLE `stations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `trains`
--
ALTER TABLE `trains`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `location_clusters`
--
ALTER TABLE `location_clusters`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cluster_members`
--
ALTER TABLE `cluster_members`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dropdown_options`
--
ALTER TABLE `dropdown_options`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `units`
--
ALTER TABLE `units`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `vendors`
--
ALTER TABLE `vendors`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `vendor_id_cards`
--
ALTER TABLE `vendor_id_cards`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `vendor_documents`
--
ALTER TABLE `vendor_documents`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `vendor_renewals`
--
ALTER TABLE `vendor_renewals`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `zones`
--
ALTER TABLE `zones`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `complaints`
--
ALTER TABLE `complaints`
  ADD CONSTRAINT `fk_complaint_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_complaint_user` FOREIGN KEY (`registered_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `complaint_evidence`
--
ALTER TABLE `complaint_evidence`
  ADD CONSTRAINT `fk_evidence_complaint` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `contractors`
--
ALTER TABLE `contractors`
  ADD CONSTRAINT `fk_contractor_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_contractor_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `contractor_documents`
--
ALTER TABLE `contractor_documents`
  ADD CONSTRAINT `fk_cdoc_contractor` FOREIGN KEY (`contractor_id`) REFERENCES `contractors` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `divisions`
--
ALTER TABLE `divisions`
  ADD CONSTRAINT `fk_div_zone` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`);

--
-- Constraints for table `inspections`
--
ALTER TABLE `inspections`
  ADD CONSTRAINT `fk_inspection_inspector` FOREIGN KEY (`inspector_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inspection_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `penalties`
--
ALTER TABLE `penalties`
  ADD CONSTRAINT `fk_penalty_contractor` FOREIGN KEY (`contractor_id`) REFERENCES `contractors` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_penalty_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_penalty_user` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_penalty_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_penalty_complaint` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_penalty_inspection` FOREIGN KEY (`inspection_id`) REFERENCES `inspections` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_penalty_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_penalty_revoked_by` FOREIGN KEY (`revoked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `penalty_documents`
--
ALTER TABLE `penalty_documents`
  ADD CONSTRAINT `fk_penaltydoc_penalty` FOREIGN KEY (`penalty_id`) REFERENCES `penalties` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_penaltydoc_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `stations`
--
ALTER TABLE `stations`
  ADD CONSTRAINT `fk_station_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`);

--
-- Constraints for table `trains`
--
ALTER TABLE `trains`
  ADD CONSTRAINT `fk_train_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`),
  ADD CONSTRAINT `fk_train_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `location_clusters`
--
ALTER TABLE `location_clusters`
  ADD CONSTRAINT `fk_cluster_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`),
  ADD CONSTRAINT `fk_cluster_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `cluster_members`
--
ALTER TABLE `cluster_members`
  ADD CONSTRAINT `fk_member_cluster` FOREIGN KEY (`cluster_id`) REFERENCES `location_clusters` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_member_station` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_member_train` FOREIGN KEY (`train_id`) REFERENCES `trains` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `dropdown_options`
--
ALTER TABLE `dropdown_options`
  ADD CONSTRAINT `fk_dropdown_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_dropdown_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `units`
--
ALTER TABLE `units`
  ADD CONSTRAINT `fk_unit_contractor` FOREIGN KEY (`contractor_id`) REFERENCES `contractors` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_unit_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_unit_station` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`),
  ADD CONSTRAINT `fk_unit_train` FOREIGN KEY (`train_id`) REFERENCES `trains` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_unit_cluster` FOREIGN KEY (`cluster_id`) REFERENCES `location_clusters` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_unit_contract_category` FOREIGN KEY (`contract_category_id`) REFERENCES `dropdown_options` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_user_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_user_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  ADD CONSTRAINT `fk_user_station` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_user_zone` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `vendors`
--
ALTER TABLE `vendors`
  ADD CONSTRAINT `fk_vendor_contractor` FOREIGN KEY (`contractor_id`) REFERENCES `contractors` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_vendor_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_vendor_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_vendor_station` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_vendor_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `vendor_id_cards`
--
ALTER TABLE `vendor_id_cards`
  ADD CONSTRAINT `fk_idcard_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_idcard_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_idcard_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `vendor_documents`
--
ALTER TABLE `vendor_documents`
  ADD CONSTRAINT `fk_vdoc_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_vdoc_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `vendor_renewals`
--
ALTER TABLE `vendor_renewals`
  ADD CONSTRAINT `fk_renewal_user` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_renewal_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
