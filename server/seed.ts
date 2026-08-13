import { pool } from "./app/common/services/sql.service";
import bcrypt from "bcrypt";

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  try {
    console.log("Starting database seeding...");

    // 1. Clean existing records in correct order due to foreign key constraints
    const tablesToClean = [
      "audit_logs",
      "complaint_evidence",
      "complaints",
      "penalties",
      "vendor_id_cards",
      "vendor_renewals",
      "vendors",
      "units",
      "contractors",
      "users",
      "role_permissions",
      "roles",
      "stations",
      "divisions",
      "zones"
    ];

    console.log("Cleaning old tables...");
    for (const table of tablesToClean) {
      await pool.execute(`DELETE FROM \`${table}\``);
    }
    console.log("Tables cleaned.");

    // 2. Insert Zone
    console.log("Inserting zone...");
    const [zoneResult] = await pool.execute(
      "INSERT INTO zones (zone_name) VALUES (?)",
      ["South Eastern Railway"]
    );
    const zoneId = (zoneResult as any).insertId;

    // 3. Insert Divisions
    console.log("Inserting divisions...");
    const divisions = [
      { code: "KGP", name: "Kharagpur Division" },
      { code: "ADRA", name: "Adra Division" },
      { code: "CKP", name: "Chakradharpur Division" },
      { code: "RNC", name: "Ranchi Division" },
      { code: "TATA", name: "Tatanagar Division" },
      { code: "HLD", name: "Haldia Division" }
    ];

    const divisionIds: Record<string, number> = {};
    for (const div of divisions) {
      const [res] = await pool.execute(
        "INSERT INTO divisions (zone_id, division_code, division_name) VALUES (?, ?, ?)",
        [zoneId, div.code, div.name]
      );
      divisionIds[div.code] = (res as any).insertId;
    }

    // 4. Insert Stations
    console.log("Inserting stations...");
    const stations = [
      { code: "KGP", name: "Kharagpur Junction", divCode: "KGP" },
      { code: "SRC", name: "Santragachi", divCode: "KGP" },
      { code: "BKSC", name: "Bokaro Steel City", divCode: "ADRA" },
      { code: "TATA", name: "Tatanagar", divCode: "TATA" },
      { code: "RNC", name: "Ranchi", divCode: "RNC" },
      { code: "HWH", name: "Howrah Station", divCode: "KGP" },
      { code: "HLD", name: "Haldia Station", divCode: "HLD" }
    ];

    const stationIds: Record<string, number> = {};
    for (const st of stations) {
      const [res] = await pool.execute(
        "INSERT INTO stations (division_id, station_code, station_name) VALUES (?, ?, ?)",
        [divisionIds[st.divCode], st.code, st.name]
      );
      stationIds[st.code] = (res as any).insertId;
    }

    // 5. Insert Roles — the 8-role hierarchy required by the UAT spec
    console.log("Inserting roles...");
    const roleDefs = [
      { key: "super_admin_hq", name: "super_admin_hq", desc: "Super Admin HQ — complete control over every zone and division" },
      { key: "hq_admin", name: "hq_admin", desc: "HQ Admin — full HQ-level access across all zones" },
      { key: "hq_sub_admin", name: "hq_sub_admin", desc: "HQ Sub Admin — limited HQ-level access" },
      { key: "divisional_admin", name: "divisional_admin", desc: "Divisional Admin — full access within a single division" },
      { key: "divisional_sub_admin", name: "divisional_sub_admin", desc: "Divisional Sub Admin — limited access within a division" },
      { key: "inspector", name: "inspector", desc: "Inspector — creates inspections, limited dashboard access" },
      { key: "dealing_section", name: "dealing_section", desc: "Dealing Section — ATR, recovery, and reports" },
      { key: "complaint_cell", name: "complaint_cell", desc: "Complaint Cell — complaint module only" },
    ] as const;

    const roleIds: Record<string, number> = {};
    for (const role of roleDefs) {
      const [res] = await pool.execute(
        "INSERT INTO roles (role_name, description) VALUES (?, ?)",
        [role.name, role.desc]
      );
      roleIds[role.key] = (res as any).insertId;
    }
    const superAdminRoleId = roleIds["super_admin_hq"];
    const adminRoleId = roleIds["divisional_admin"];
    const inspectorRoleId = roleIds["inspector"];

    // 6. Insert Role Permissions — module x action matrix for every role
    console.log("Inserting role permissions...");
    const modules = [
      "user_management",
      "role_management",
      "vendor_management",
      "contractor_management",
      "unit_management",
      "location_management",
      "id_card_management",
      "penalty_management",
      "complaint_management",
      "inspection_management",
      "audit_logs",
      "reports",
      "dashboard",
      "admin_module",
    ] as const;

    type Perm = [view: number, create: number, edit: number, del: number, approve: number, exportP: number];
    const FULL: Perm = [1, 1, 1, 1, 1, 1];
    const NONE: Perm = [0, 0, 0, 0, 0, 0];

    // Per-role, per-module permission matrix. Modules not listed for a role default to NONE.
    const rolePermissionOverrides: Record<string, Partial<Record<(typeof modules)[number], Perm>>> = {
      hq_admin: {
        user_management: [1, 1, 1, 0, 1, 1],
        // Divisional & HQ Admin shall have full powers in Role Management Module (per UAT doc).
        role_management: FULL,
        vendor_management: [1, 1, 1, 0, 1, 1],
        contractor_management: [1, 1, 1, 0, 1, 1],
        unit_management: [1, 1, 1, 0, 1, 1],
        location_management: [1, 1, 1, 0, 1, 1],
        id_card_management: [1, 1, 1, 0, 1, 1],
        penalty_management: [1, 1, 1, 0, 1, 1],
        complaint_management: [1, 1, 1, 0, 1, 1],
        inspection_management: [1, 1, 1, 0, 1, 1],
        audit_logs: [1, 0, 0, 0, 0, 1],
        reports: [1, 1, 1, 0, 1, 1],
        dashboard: [1, 0, 0, 0, 0, 0],
        admin_module: [1, 1, 1, 0, 1, 1],
      },
      hq_sub_admin: {
        // Divisional & HQ Sub-admin shall have full powers in terms of creation of users (per UAT doc) —
        // create/edit, but approval stays with the Admin tier.
        user_management: [1, 1, 1, 0, 0, 0],
        vendor_management: [1, 1, 1, 0, 0, 0],
        contractor_management: [1, 1, 1, 0, 0, 0],
        unit_management: [1, 1, 1, 0, 0, 0],
        location_management: [1, 1, 1, 0, 0, 0],
        // UAT: ID cards are approved by Sub Admin — narrowed further at the application
        // layer to users.card_signing_authority=1 (see idcard module).
        id_card_management: [1, 1, 1, 0, 1, 0],
        penalty_management: [1, 1, 1, 0, 0, 0],
        complaint_management: [1, 1, 1, 0, 0, 0],
        inspection_management: [1, 1, 1, 0, 0, 0],
        reports: [1, 0, 0, 0, 0, 1],
        dashboard: [1, 0, 0, 0, 0, 0],
      },
      divisional_admin: {
        user_management: [1, 1, 1, 0, 1, 1],
        // Divisional & HQ Admin shall have full powers in Role Management Module (per UAT doc).
        role_management: FULL,
        vendor_management: [1, 1, 1, 0, 1, 1],
        contractor_management: [1, 1, 1, 0, 1, 1],
        unit_management: [1, 1, 1, 0, 1, 1],
        location_management: [1, 1, 1, 0, 1, 1],
        id_card_management: [1, 1, 1, 0, 1, 1],
        penalty_management: [1, 1, 1, 0, 1, 1],
        complaint_management: [1, 1, 1, 0, 1, 1],
        inspection_management: [1, 1, 1, 0, 1, 1],
        audit_logs: [1, 0, 0, 0, 0, 1],
        reports: [1, 1, 1, 0, 1, 1],
        dashboard: [1, 0, 0, 0, 0, 0],
      },
      divisional_sub_admin: {
        // Divisional & HQ Sub-admin shall have full powers in terms of creation of users (per UAT doc) —
        // create/edit, but approval stays with the Admin tier.
        user_management: [1, 1, 1, 0, 0, 0],
        vendor_management: [1, 1, 1, 0, 0, 0],
        contractor_management: [1, 1, 1, 0, 0, 0],
        unit_management: [1, 1, 1, 0, 0, 0],
        location_management: [1, 1, 1, 0, 0, 0],
        // UAT: ID cards are approved by Sub Admin — narrowed further at the application
        // layer to users.card_signing_authority=1 (see idcard module).
        id_card_management: [1, 1, 1, 0, 1, 0],
        penalty_management: [1, 1, 1, 0, 0, 0],
        complaint_management: [1, 1, 1, 0, 0, 0],
        inspection_management: [1, 1, 1, 0, 0, 0],
        reports: [1, 0, 0, 0, 0, 0],
        dashboard: [1, 0, 0, 0, 0, 0],
      },
      inspector: {
        vendor_management: [1, 0, 0, 0, 0, 0],
        contractor_management: [1, 0, 0, 0, 0, 0],
        unit_management: [1, 0, 0, 0, 0, 0],
        location_management: [1, 0, 0, 0, 0, 0],
        id_card_management: [1, 0, 0, 0, 0, 0],
        penalty_management: [1, 0, 0, 0, 0, 0],
        complaint_management: [1, 1, 0, 0, 0, 0],
        inspection_management: [1, 1, 1, 0, 0, 0],
        reports: [1, 0, 0, 0, 0, 0],
        dashboard: [1, 0, 0, 0, 0, 0],
      },
      dealing_section: {
        vendor_management: [1, 0, 0, 0, 0, 0],
        contractor_management: [1, 0, 0, 0, 0, 0],
        unit_management: [1, 0, 0, 0, 0, 0],
        location_management: [1, 0, 0, 0, 0, 0],
        id_card_management: [1, 0, 0, 0, 0, 0],
        penalty_management: [1, 0, 1, 0, 0, 0],
        complaint_management: [1, 0, 1, 0, 0, 0],
        inspection_management: [1, 0, 1, 0, 0, 0],
        reports: [1, 0, 0, 0, 0, 1],
        dashboard: [1, 0, 0, 0, 0, 0],
      },
      complaint_cell: {
        vendor_management: [1, 0, 0, 0, 0, 0],
        unit_management: [1, 0, 0, 0, 0, 0],
        location_management: [1, 0, 0, 0, 0, 0],
        complaint_management: [1, 1, 1, 0, 0, 0],
        reports: [1, 0, 0, 0, 0, 0],
        dashboard: [1, 0, 0, 0, 0, 0],
      },
    };

    for (const role of roleDefs) {
      const roleId = roleIds[role.key];
      for (const mod of modules) {
        const perm: Perm =
          role.key === "super_admin_hq" ? FULL : rolePermissionOverrides[role.key]?.[mod] ?? NONE;
        await pool.execute(
          `INSERT INTO role_permissions
          (role_id, module_name, can_view, can_create, can_edit, can_delete, can_approve_reject, can_export)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [roleId, mod, ...perm]
        );
      }
    }

    // 7. Insert Users
    console.log("Inserting users...");
    const passwordHash = await hashPassword("admin123");
    const superadminHash = await hashPassword("superadmin123"); 

    // Super Admin HQ — username renamed to "superadminhq" per UAT requirement
    const [superUserRes] = await pool.execute(
      `INSERT INTO users
      (employee_id, username, full_name, email, mobile, password_hash, is_temp_password, role_id, division_id, station_id, designation)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL, ?)`,
      ["EMP-001", "superadminhq", "HQ Superadmin User", "superadmin@cris.org.in", "9999999999", superadminHash, superAdminRoleId, "Sr. Administrator"]
    );
    const superuserId = (superUserRes as any).insertId;

    // Seeding mock users from the user management console mockup
    const mockUsers = [
      {
        employee_id: "SER-ADM-4421",
        username: "arun_sharma",
        full_name: "Arun Sharma",
        email: "arun.sharma@ser.railnet.gov.in",
        mobile: "9830011111",
        role_id: superAdminRoleId, // ADMIN role maps to superadmin
        division_id: null,
        station_id: null,
        designation: "Assistant Comm. Manager",
        status: "active"
      },
      {
        employee_id: "SER-INS-2908",
        username: "kiran_maurya",
        full_name: "Kiran Maurya",
        email: "kiran.m@ser.railnet.gov.in",
        mobile: "9830022222",
        role_id: inspectorRoleId, // INSPECTOR
        division_id: divisionIds["KGP"],
        station_id: stationIds["KGP"],
        designation: "Station Inspector",
        status: "active"
      },
      {
        employee_id: "SER-DIV-8832",
        username: "pratik_patel",
        full_name: "Pratik Patel",
        email: "pratik.p@ser.railnet.gov.in",
        mobile: "9830033333",
        role_id: adminRoleId, // DIVISION ADMIN (admin)
        division_id: divisionIds["CKP"],
        station_id: stationIds["TATA"],
        designation: "Section Officer",
        status: "inactive"
      },
      {
        employee_id: "SER-ADM-5521",
        username: "sanjay_jha",
        full_name: "Sanjay Jha",
        email: "sanjay.jha@ser.railnet.gov.in",
        mobile: "9830044444",
        role_id: superAdminRoleId, // ADMIN
        division_id: null,
        station_id: null,
        designation: "Senior Clerk",
        status: "active"
      },
      {
        employee_id: "SER-INS-1120",
        username: "rina_tiwari",
        full_name: "Rina Tiwari",
        email: "rina.tiwari@ser.railnet.gov.in",
        mobile: "9830055555",
        role_id: inspectorRoleId, // INSPECTOR
        division_id: divisionIds["KGP"],
        station_id: stationIds["SRC"],
        designation: "Health Inspector",
        status: "active"
      }
    ];

    const userIds: Record<string, number> = {};
    for (const usr of mockUsers) {
      const [res] = await pool.execute(
        `INSERT INTO users
        (employee_id, username, full_name, email, mobile, password_hash, is_temp_password, role_id, division_id, station_id, designation, users_status)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
        [
          usr.employee_id,
          usr.username,
          usr.full_name,
          usr.email,
          usr.mobile,
          passwordHash,
          usr.role_id,
          usr.division_id,
          usr.station_id,
          usr.designation,
          usr.status
        ]
      );
      userIds[usr.username] = (res as any).insertId;
    }

    // Divisional Admins — every division's admin is seeded as a JS-graded Card Signing
    // Authority for their own division, so each of the four divisions can approve/sign
    // ID cards for its own vendors without needing a separate Sub Admin account first.
    const divisionalAdmins = [
      { username: "admin_kgp", name: "R. Prasad", email: "kgp_admin@cris.org.in", divCode: "KGP", stCode: "KGP", designationGrade: "JS", cardSigningAuthority: 1 },
      { username: "admin_adra", name: "B. K. Sharma", email: "adra_admin@cris.org.in", divCode: "ADRA", stCode: "BKSC", designationGrade: "JS", cardSigningAuthority: 1 },
      { username: "admin_ckp", name: "S. K. Roy", email: "ckp_admin@cris.org.in", divCode: "CKP", stCode: "TATA", designationGrade: "JS", cardSigningAuthority: 1 },
      { username: "admin_rnc", name: "A. K. Mehta", email: "rnc_admin@cris.org.in", divCode: "RNC", stCode: "RNC", designationGrade: "JS", cardSigningAuthority: 1 }
    ];

    for (const adm of divisionalAdmins) {
      const [res] = await pool.execute(
        `INSERT INTO users
        (employee_id, username, full_name, email, mobile, password_hash, is_temp_password, role_id, division_id, station_id, designation, designation_grade, card_signing_authority)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
        [
          `EMP-${adm.username.toUpperCase()}`,
          adm.username,
          adm.name,
          adm.email,
          "9876543210",
          passwordHash,
          adminRoleId,
          divisionIds[adm.divCode],
          stationIds[adm.stCode],
          "Divisional Administrator",
          adm.designationGrade,
          adm.cardSigningAuthority
        ]
      );
      userIds[adm.username] = (res as any).insertId;
    }

    // 8. Insert Contractors
    console.log("Inserting contractors...");
    const contractors = [
      { code: "CON-001", company: "Eastern Catering Pvt. Ltd.", contact: "Amit Dutta", divCode: "KGP", compliance: 95.5 },
      { code: "CON-002", company: "Railway Pantry Services", contact: "Vikas Sinha", divCode: "ADRA", compliance: 90.0 },
      { code: "CON-003", company: "Jha & Sons Logistics", contact: "Rajesh Jha", divCode: "CKP", compliance: 88.2 },
      { code: "CON-004", company: "Sai Kripa Caterers", contact: "K. R. Rao", divCode: "KGP", compliance: 98.2 },
      { code: "CON-005", company: "Rail Bhojan Services", contact: "P. K. Mishra", divCode: "CKP", compliance: 92.0 },
      { code: "CON-006", company: "Metro Snacks Ltd", contact: "Sanjiv Goenka", divCode: "KGP", compliance: 75.0 },
      { code: "CON-007", company: "Grand Trunk Refreshments", contact: "T. S. Ahluwalia", divCode: "KGP", compliance: 94.0 },
      { code: "CON-008", company: "Jagannath Catering", contact: "L. N. Patnaik", divCode: "ADRA", compliance: 85.0 }
    ];

    const contractorIds: Record<string, number> = {};
    for (const con of contractors) {
      const [res] = await pool.execute(
        `INSERT INTO contractors 
        (contractor_code, company_name, primary_contact_name, primary_contact_mobile, official_email, division_id, contractors_status, compliance_rate) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [con.code, con.company, con.contact, "9112233445", `${con.code.toLowerCase()}@railnet.gov.in`, divisionIds[con.divCode], "active", con.compliance]
      );
      contractorIds[con.code] = (res as any).insertId;
    }

    // 9. Insert Units
    console.log("Inserting units...");
    const units = [
      { code: "UNT-KGP-01", name: "Platform 1 Food Stall Cluster A", stationCode: "KGP", contractorCode: "CON-001" },
      { code: "UNT-KGP-02", name: "Platform 3 Tea Stall", stationCode: "KGP", contractorCode: "CON-004" },
      { code: "UNT-SRC-01", name: "Santragachi Platform 2 Snack Corner", stationCode: "SRC", contractorCode: "CON-007" },
      { code: "UNT-BKSC-01", name: "Bokaro Platform 1 Refreshment Room", stationCode: "BKSC", contractorCode: "CON-002" },
      { code: "UNT-BKSC-02", name: "Bokaro Platform 2 Fruit Stall", stationCode: "BKSC", contractorCode: "CON-008" },
      { code: "UNT-TATA-01", name: "Tatanagar Platform 1 Main Pantry", stationCode: "TATA", contractorCode: "CON-003" },
      { code: "UNT-TATA-02", name: "Tatanagar Platform 3 Food Plaza", stationCode: "TATA", contractorCode: "CON-005" },
      { code: "UNT-RNC-01", name: "Ranchi Platform 1 General Stall", stationCode: "RNC", contractorCode: "CON-003" },
      { code: "UNT-HWH-01", name: "Howrah Platform 17 Fast Food Corner", stationCode: "HWH", contractorCode: "CON-006" }
    ];

    const unitIds: Record<string, number> = {};
    for (const unt of units) {
      const [res] = await pool.execute(
        `INSERT INTO units
        (unit_code, unit_name, station_id, platform_location, contractor_id, annual_fee, units_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          unt.code,
          unt.name,
          stationIds[unt.stationCode],
          "Platform 1/2",
          contractorIds[unt.contractorCode],
          15000.00,
          "active"
        ]
      );
      unitIds[unt.code] = (res as any).insertId;
    }

    // 10. Insert Vendors (matching the Vendor Master Listing screenshot)
    console.log("Inserting vendors...");
    const vendors = [
      {
        code: "V-2024-0891",
        name: "Subhash Mahato",
        father: "Raman Mahato",
        dob: "1990-05-15",
        aadhaar: "345678901234",
        mobile: "9830012345",
        email: "subhash@gmail.com",
        contractorCode: "CON-001",
        unitCode: "UNT-KGP-01",
        stationCode: "KGP",
        divCode: "KGP",
        status: "active",
        validityStart: "2024-01-01",
        validityEnd: "2025-12-12",
        pvrStatus: "verified",
        medicalStatus: "verified"
      },
      {
        code: "V-2024-1102",
        name: "Aruna Kumari",
        father: "Shyamlal Singh",
        dob: "1994-08-20",
        aadhaar: "234567890123",
        mobile: "9876540123",
        email: "aruna@gmail.com",
        contractorCode: "CON-002",
        unitCode: "UNT-BKSC-01",
        stationCode: "BKSC",
        divCode: "ADRA",
        status: "expired",
        validityStart: "2022-10-01",
        validityEnd: "2023-10-15",
        pvrStatus: "verified",
        medicalStatus: "pending"
      },
      {
        code: "V-2024-0943",
        name: "Rajesh Jha",
        father: "Devendra Jha",
        dob: "1988-12-10",
        aadhaar: "123456789012",
        mobile: "9431109876",
        email: "rajesh.jha@gmail.com",
        contractorCode: "CON-003",
        unitCode: "UNT-TATA-01",
        stationCode: "TATA",
        divCode: "CKP",
        status: "active",
        validityStart: "2023-06-25",
        validityEnd: "2024-06-24",
        pvrStatus: "pending",
        medicalStatus: "verified"
      },
      {
        code: "V-2024-1288",
        name: "Bikash Khan",
        father: "Jalil Khan",
        dob: "1992-02-14",
        aadhaar: "456789012345",
        mobile: "9007123456",
        email: "bikash@gmail.com",
        contractorCode: "CON-001",
        unitCode: "UNT-KGP-01",
        stationCode: "KGP",
        divCode: "KGP",
        status: "active",
        validityStart: "2024-02-03",
        validityEnd: "2026-02-02",
        pvrStatus: "verified",
        medicalStatus: "verified"
      }
    ];

    const vendorIds: Record<string, number> = {};
    for (const vnd of vendors) {
      const [res] = await pool.execute(
        `INSERT INTO vendors
        (vendor_code, full_name, father_name, date_of_birth, aadhaar_number, mobile_number, email,
         contractor_id, unit_id, station_id, division_id, vendor_status, validity_start, validity_end,
         police_verification_status, medical_verification_status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vnd.code,
          vnd.name,
          vnd.father,
          vnd.dob,
          vnd.aadhaar,
          vnd.mobile,
          vnd.email,
          contractorIds[vnd.contractorCode],
          unitIds[vnd.unitCode],
          stationIds[vnd.stationCode],
          divisionIds[vnd.divCode],
          vnd.status,
          vnd.validityStart,
          vnd.validityEnd,
          vnd.pvrStatus,
          vnd.medicalStatus,
          superuserId
        ]
      );
      vendorIds[vnd.code] = (res as any).insertId;

      // 11. Insert ID Card for vendor
      console.log(`Inserting ID card for ${vnd.code}...`);
      await pool.execute(
        `INSERT INTO vendor_id_cards (vendor_id, id_number, qr_code_data, issued_date, cards_status) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          vendorIds[vnd.code],
          `CRIS-ID-${vnd.code.substring(2)}`,
          `VMS-VERIFY-CODE-${vnd.code}`,
          vnd.validityStart,
          vnd.status === "active" ? "active" : "expired"
        ]
      );
    }

    // 12. Insert Complaints (matching Complaints Tracking screen)
    console.log("Inserting complaints...");
    const complaints = [
      {
        code: "CMP-88219",
        unitCode: "UNT-KGP-01",
        category: "Food Quality & Hygiene",
        desc: "Found stale food and dirty trays served in platform 1 food stall.",
        date: "2023-10-24",
        time: "12:30:00",
        priority: "high",
        status: "open"
      },
      {
        code: "CMP-88214",
        unitCode: "UNT-TATA-01",
        category: "Overcharging",
        desc: "Charging ₹30 for a bottle of water which has MRP ₹15.",
        date: "2023-10-23",
        time: "16:45:00",
        priority: "medium",
        status: "investigating"
      },
      {
        code: "CMP-88198",
        unitCode: "UNT-RNC-01",
        category: "Vendor Misbehavior",
        desc: "Vendor staff was rude and argumentative when asked for bills.",
        date: "2023-10-22",
        time: "09:15:00",
        priority: "low",
        status: "resolved"
      },
      {
        code: "CMP-88152",
        unitCode: "UNT-BKSC-01",
        category: "Unauthorized Vendor",
        desc: "An unauthorized vendor selling food on platform without proper ID card.",
        date: "2023-10-21",
        time: "18:20:00",
        priority: "high",
        status: "investigating"
      }
    ];

    for (const cmp of complaints) {
      await pool.execute(
        `INSERT INTO complaints 
        (complaint_code, unit_id, location_text, category, description, occurrence_date, occurrence_time, priority, complaints_status, registered_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cmp.code,
          unitIds[cmp.unitCode],
          "Platform Area",
          cmp.category,
          cmp.desc,
          cmp.date,
          cmp.time,
          cmp.priority,
          cmp.status,
          userIds["admin_kgp"] // registered by R. Prasad
        ]
      );
    }

    // 13. Insert Penalties (matching Penalty Recovery Ledger screen)
    console.log("Inserting penalties...");
    const penalties = [
      {
        code: "PNL-2024-0012",
        contractorCode: "CON-004", // Sai Kripa
        vendorCode: "V-2024-0891", // associated vendor (optional)
        unitCode: "UNT-KGP-02",
        amount: 25000.00,
        reason: "HYGIENE LAPSE: Insects found in food preparation area on inspect.",
        status: "recovered",
        issuedDate: "2024-01-10",
        adminUser: "admin_kgp"
      },
      {
        code: "PNL-2024-0015",
        contractorCode: "CON-005", // Rail Bhojan
        vendorCode: null,
        unitCode: "UNT-TATA-02",
        amount: 12500.00,
        reason: "OVERCHARGING: Charging extra for tea and biscuits.",
        status: "pending",
        issuedDate: "2024-02-12",
        adminUser: "admin_ckp"
      },
      {
        code: "PNL-2024-0792",
        contractorCode: "CON-006", // Metro Snacks
        vendorCode: null,
        unitCode: "UNT-HWH-01",
        amount: 50000.00,
        reason: "ILLEGAL VENDING: Selling items outside designated platform area.",
        status: "pending", // we'll treat overdue as pending, but amount overdue is tracked
        issuedDate: "2024-03-05",
        adminUser: "admin_kgp"
      },
      {
        code: "PNL-2024-0820",
        contractorCode: "CON-007", // Grand Trunk
        vendorCode: null,
        unitCode: "UNT-SRC-01",
        amount: 5000.00,
        reason: "UNIFORM DEFAULT: Vendor staff not wearing standard uniform/apron.",
        status: "recovered",
        issuedDate: "2024-03-15",
        adminUser: "admin_kgp"
      },
      {
        code: "PNL-2024-0822",
        contractorCode: "CON-008", // Jagannath Catering
        vendorCode: null,
        unitCode: "UNT-BKSC-02",
        amount: 15000.00,
        reason: "EXPIRED ITEMS: Expired dairy products found in display case.",
        status: "pending",
        issuedDate: "2024-04-02",
        adminUser: "admin_adra"
      }
    ];

    for (const pnl of penalties) {
      await pool.execute(
        `INSERT INTO penalties 
        (penalty_code, contractor_id, vendor_id, unit_id, amount, reason, penalties_status, issued_by, issued_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pnl.code,
          contractorIds[pnl.contractorCode],
          pnl.vendorCode ? vendorIds[pnl.vendorCode] : null,
          unitIds[pnl.unitCode],
          pnl.amount,
          pnl.reason,
          pnl.status,
          userIds[pnl.adminUser] || superuserId,
          pnl.issuedDate
        ]
      );
    }

    // 14. Insert Inspections
    console.log("Inserting inspections...");
    const inspections = [
      { unitCode: "UNT-KGP-01", inspectorUser: "kiran_maurya", date: "2024-05-10", result: "satisfactory", remarks: "Hygiene is good." },
      { unitCode: "UNT-KGP-02", inspectorUser: "kiran_maurya", date: "2024-05-12", result: "minor_issues", remarks: "Slight dust on counters." },
      { unitCode: "UNT-SRC-01", inspectorUser: "rina_tiwari", date: "2024-05-15", result: "satisfactory", remarks: "All vendors have valid cards." },
      { unitCode: "UNT-BKSC-01", inspectorUser: "kiran_maurya", date: "2024-05-18", result: "critical_failure", remarks: "Unauthorized vendors found." },
      { unitCode: "UNT-TATA-01", inspectorUser: "kiran_maurya", date: "2024-05-20", result: "satisfactory", remarks: "Excellent compliance." },
      { unitCode: "UNT-TATA-02", inspectorUser: "kiran_maurya", date: "2024-05-22", result: "minor_issues", remarks: "Prices not displayed clearly." }
    ];

    for (const insp of inspections) {
      await pool.execute(
        `INSERT INTO inspections (unit_id, inspector_id, inspection_date, result, remarks) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          unitIds[insp.unitCode],
          userIds[insp.inspectorUser] || superuserId,
          insp.date,
          insp.result,
          insp.remarks
        ]
      );
    }

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Database seeding failed:", error);
  } finally {
    await pool.end();
  }
}

main();
