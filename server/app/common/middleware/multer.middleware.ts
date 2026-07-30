import multer, { type FileFilterCallback, StorageEngine } from "multer";
import path from "path";
import { type Request } from "express";

// Configure storage engine and filename
const storage: StorageEngine = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname),
    );
  },
});

// Initialize upload middleware and add file size limit
export const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Restrict identity/verification document uploads (Aadhaar, Medical, Police
// Verification) to PDF/JPG/PNG so a wrong file type is rejected up front.
const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

const documentFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) {
    const err = new Error(`Only PDF, JPG, and PNG files are allowed (received "${file.originalname}")`);
    (err as any).status = 400;
    cb(err);
    return;
  }
  cb(null, true);
};

export const documentUpload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: documentFileFilter,
});

// Inspection reports and Action Taken Reports additionally accept Word
// documents (DOC/DOCX), unlike identity-verification uploads above.
const ALLOWED_INSPECTION_DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];

const inspectionDocumentFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_INSPECTION_DOCUMENT_EXTENSIONS.includes(ext)) {
    const err = new Error(`Only PDF, DOC, DOCX, JPG, and PNG files are allowed (received "${file.originalname}")`);
    (err as any).status = 400;
    cb(err);
    return;
  }
  cb(null, true);
};

export const inspectionDocumentUpload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: inspectionDocumentFileFilter,
});

// Signature uploads (User Management, ID Card auto-signing) are always images.
const ALLOWED_SIGNATURE_EXTENSIONS = [".jpg", ".jpeg", ".png"];

const signatureFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_SIGNATURE_EXTENSIONS.includes(ext)) {
    const err = new Error(`Only JPG and PNG files are allowed for a signature (received "${file.originalname}")`);
    (err as any).status = 400;
    cb(err);
    return;
  }
  cb(null, true);
};

export const signatureUpload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: signatureFileFilter,
});
