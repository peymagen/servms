import { body, param } from "express-validator";
import { pool } from "../../common/services/sql.service";
import { type RowDataPacket } from "mysql2";

// Some divisions (e.g. Chakradharpur) have no stations configured at all, so the
// Station field can only be enforced as mandatory when the selected division actually
// has stations to choose from.
const divisionHasStations = async (divisionId: number): Promise<boolean> => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as total FROM stations WHERE division_id = ? AND status = 1",
    [divisionId]
  );
  return Number(rows[0]?.total ?? 0) > 0;
};

// Every unit belongs to a station, so a division with no stations also has no units.
// Unit is only mandatory when at least one unit exists for the given station (if
// selected) or, failing that, anywhere in the given division.
const divisionHasUnits = async (divisionId: number, stationId?: number): Promise<boolean> => {
  const params: any[] = [];
  const whereSql = stationId ? "u.station_id = ?" : "s.division_id = ?";
  params.push(stationId ?? divisionId);

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM units u JOIN stations s ON s.id = u.station_id WHERE ${whereSql}`,
    params
  );
  return Number(rows[0]?.total ?? 0) > 0;
};

const verificationFields = (prefix: "police_verification" | "medical_verification") => [
  body(`${prefix}_status`)
    .optional()
    .isIn(["pending", "verified", "rejected", "expired"])
    .withMessage(`Invalid ${prefix.replace("_", " ")} status value`),

  body(`${prefix}_issue_date`)
    .optional({ nullable: true })
    .isDate()
    .withMessage(`${prefix.replace("_", " ")} issue date must be a valid date`),

  body(`${prefix}_valid_till`)
    .optional({ nullable: true })
    .isDate()
    .withMessage(`${prefix.replace("_", " ")} valid till date must be a valid date`)
    .custom((value, { req }) => {
      const issueDate = req.body[`${prefix}_issue_date`];
      if (value && issueDate && new Date(value) < new Date(issueDate)) {
        throw new Error("Valid till date cannot be before the issue date");
      }
      return true;
    }),

  body(`${prefix}_remarks`).optional({ nullable: true }).trim(),
];

export const createVendorValidation = [
  body("full_name")
    .trim()
    .notEmpty().withMessage("Vendor full name is required"),

  body("aadhaar_number")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 12, max: 12 }).withMessage("Aadhaar number must be exactly 12 digits"),

  body("mobile_number")
    .trim()
    .notEmpty().withMessage("Mobile number is required"),

  body("division_id")
    .notEmpty().withMessage("Division selection is required")
    .isInt().withMessage("division_id must be an integer"),

  body("station_id")
    .optional({ nullable: true, checkFalsy: true })
    .isInt().withMessage("station_id must be an integer"),

  body("station_id").custom(async (value, { req }) => {
    if (value) return true;
    const divisionId = Number(req.body.division_id);
    if (divisionId && (await divisionHasStations(divisionId))) {
      throw new Error("Station selection is required for this division");
    }
    return true;
  }),

  body("contractor_id")
    .notEmpty().withMessage("Contractor selection is required")
    .isInt().withMessage("contractor_id must be an integer"),

  body("unit_id")
    .optional({ nullable: true, checkFalsy: true })
    .isInt().withMessage("unit_id must be an integer"),

  body("unit_id").custom(async (value, { req }) => {
    if (value) return true;
    const divisionId = Number(req.body.division_id);
    const stationId = req.body.station_id ? Number(req.body.station_id) : undefined;
    if (divisionId && (await divisionHasUnits(divisionId, stationId))) {
      throw new Error("Platform unit stall selection is required for this division");
    }
    return true;
  }),

  body("validity_start")
    .optional({ nullable: true })
    .isDate().withMessage("Must be a valid validity start date"),

  body("validity_end")
    .optional({ nullable: true })
    .isDate().withMessage("Must be a valid validity end date"),

  body("vendor_status")
    .optional()
    .isIn(["active", "pending", "expired"]).withMessage("Invalid vendor status value"),

  body("vendor_type")
    .optional()
    .isIn(["train_tsv", "station_pf", "station_stall", "station_others"])
    .withMessage("Invalid vendor type value"),

  ...verificationFields("police_verification"),
  ...verificationFields("medical_verification"),
];

export const updateVendorValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),

  body("full_name")
    .optional()
    .trim()
    .notEmpty().withMessage("Vendor name cannot be empty"),

  body("aadhaar_number")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 12, max: 12 }).withMessage("Aadhaar number must be exactly 12 digits"),

  body("mobile_number")
    .optional()
    .trim()
    .notEmpty().withMessage("Mobile number cannot be empty"),

  body("division_id")
    .optional()
    .isInt().withMessage("division_id must be an integer"),

  body("station_id")
    .optional()
    .isInt().withMessage("station_id must be an integer"),

  body("contractor_id")
    .optional()
    .isInt().withMessage("contractor_id must be an integer"),

  body("unit_id")
    .optional()
    .isInt().withMessage("unit_id must be an integer"),

  body("vendor_status")
    .optional()
    .isIn(["active", "pending", "expired"]).withMessage("Invalid vendor status value"),

  body("vendor_type")
    .optional()
    .isIn(["train_tsv", "station_pf", "station_stall", "station_others"])
    .withMessage("Invalid vendor type value"),

  ...verificationFields("police_verification"),
  ...verificationFields("medical_verification"),
];

export const transferUnitValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),
  body("unit_id").notEmpty().withMessage("unit_id is required").isInt().withMessage("unit_id must be an integer"),
];

export const transferContractorValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),
  body("contractor_id")
    .notEmpty().withMessage("contractor_id is required")
    .isInt().withMessage("contractor_id must be an integer"),
];

export const updateVerificationValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),

  body("status")
    .optional()
    .isIn(["pending", "verified", "rejected", "expired"])
    .withMessage("Invalid verification status value"),

  body("issue_date")
    .optional({ nullable: true })
    .isDate().withMessage("Issue date must be a valid date"),

  body("valid_till")
    .optional({ nullable: true })
    .isDate().withMessage("Valid till date must be a valid date")
    .custom((value, { req }) => {
      if (value && req.body.issue_date && new Date(value) < new Date(req.body.issue_date)) {
        throw new Error("Valid till date cannot be before the issue date");
      }
      return true;
    }),

  body("remarks").optional({ nullable: true }).trim(),
];

export const uploadDocumentValidation = [
  param("id").isInt().withMessage("id param must be a valid integer"),

  body("document_type")
    .notEmpty().withMessage("document_type is required")
    .isIn(["AADHAAR", "MEDICAL", "POLICE_VERIFICATION"])
    .withMessage("Invalid document_type value"),
];
