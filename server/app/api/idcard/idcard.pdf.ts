import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { type CardTemplate, type IQrPayload } from "./idcard.dto";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

function loadImageBytes(relativePath: string | null | undefined): { bytes: Buffer; isPng: boolean } | null {
  if (!relativePath) return null;
  try {
    const filename = relativePath.replace(/^\/?uploads\//, "");
    const fullPath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(fullPath)) return null;
    const ext = path.extname(fullPath).toLowerCase();
    if (![".png", ".jpg", ".jpeg"].includes(ext)) return null;
    return { bytes: fs.readFileSync(fullPath), isPng: ext === ".png" };
  } catch {
    return null;
  }
}

export interface IdCardRenderData {
  fullName: string;
  vendorCode: string;
  vendorTypeLabel: string;
  contractorName: string | null;
  contractorMobile: string | null;
  vendorMobile: string | null;
  unitName: string | null;
  stationName: string | null;
  divisionName: string | null;
  department: string | null;
  bloodGroup: string | null;
  aadhaarNumber: string | null;
  photoPath: string | null;
  vendorSignaturePath: string | null;
  cardNumber: string;
  cardStatus: string;
  contractValidFrom: string | null;
  contractValidTo: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  signingAuthorityName: string | null;
  signingAuthorityDesignation: string | null;
  signaturePath: string | null;
}

const ORANGE = rgb(0.91, 0.42, 0.09);
const ORANGE_LIGHT = rgb(0.99, 0.92, 0.83);
const WHITE = rgb(1, 1, 1);
const DARK = rgb(0.12, 0.1, 0.08);
const MUTED = rgb(0.38, 0.34, 0.3);

// Physical card size per Annexure-II spec: 87mm x 54mm PVC card, held portrait.
const MM = 2.834645669;
const CARD_W = 54 * MM;
const CARD_H = 87 * MM;
const MARGIN = 20;
const GAP = 20;
const STRIP_W = 0.7 * 10 * MM; // 0.7cm "ON CONTRACT" side strip

async function embedImage(doc: PDFDocument, img: { bytes: Buffer; isPng: boolean } | null) {
  if (!img) return null;
  try {
    return img.isPng ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
  } catch {
    return null;
  }
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function qrFmtDate(value: string | null): string {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function maskAadhaar(aadhaar: string | null): string {
  if (!aadhaar) return "XXXX-XXXX-XXXX";
  const digits = aadhaar.replace(/\D/g, "");
  const last4 = digits.slice(-4).padStart(4, "X");
  return `XXXX-XXXX-${last4}`;
}

// Plain-text QR payload per Railway Board Commercial Circular 13/2025 —
// a scanner must show readable fields directly, not a JSON blob.
export function buildQrText(payload: IQrPayload): string {
  const nameAddress = [payload.vendor_name, payload.address].filter(Boolean).join(", ") || "N/A";
  const issuingAuthority = [payload.issuing_authority_name, payload.issuing_authority_designation]
    .filter(Boolean)
    .join(", ") || "N/A";
  return [
    `Name & Address: ${nameAddress}`,
    `Aadhaar No: ${payload.aadhaar ?? "N/A"}`,
    `PVR Validity: ${qrFmtDate(payload.pvr_validity)}`,
    `Medical Validity: ${qrFmtDate(payload.medical_validity)}`,
    `Unit: ${payload.unit ?? "N/A"}`,
    `Vendor Type: ${payload.vendor_type}`,
    `Contractor: ${payload.contractor ?? "N/A"}`,
    `Validity of ID Card: ${qrFmtDate(payload.id_card_validity)}`,
    `Issuing Authority: ${issuingAuthority}`,
    `Verify: ${payload.verification_url}`,
    ...(payload.excel_status_link ? [`Check ID Card Status: ${payload.excel_status_link}`] : []),
  ].join("\n");
}

function drawCentered(page: PDFPage, text: string, centerX: number, y: number, font: PDFFont, size: number, color = DARK) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: centerX - width / 2, y, size, font, color });
}

async function embedAll(doc: PDFDocument, data: IdCardRenderData) {
  const photo = await embedImage(doc, loadImageBytes(data.photoPath));
  const vendorSignature = await embedImage(doc, loadImageBytes(data.vendorSignaturePath));
  const authoritySignature = await embedImage(doc, loadImageBytes(data.signaturePath));
  return { photo, vendorSignature, authoritySignature };
}

export const renderIdCardPdf = async (
  template: CardTemplate,
  data: IdCardRenderData,
  qrPayload: IQrPayload
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  // margin 4 = the QR spec's minimum quiet zone — a thinner border makes a small
  // printed code (~2cm on the physical card) unreliable to scan even though the
  // encoded content is fine.
  const qrPng = await QRCode.toBuffer(buildQrText(qrPayload), { margin: 4, width: 200, errorCorrectionLevel: "M" });
  const qrImage = await doc.embedPng(qrPng);
  const { photo, vendorSignature, authoritySignature } = await embedAll(doc, data);

  const pageW = MARGIN * 2 + CARD_W * 2 + GAP;
  const pageH = MARGIN * 2 + CARD_H;
  const page = doc.addPage([pageW, pageH]);

  const frontX = MARGIN;
  const backX = MARGIN + CARD_W + GAP;
  const cardY = MARGIN;

  if (template === "template_a") {
    // Format 1 (Annexure B) — plain "Indian Railway" header, no ON CONTRACT side strip.
    drawCardFrame(page, frontX, cardY, false);
    drawFrontFaceFormat1(page, frontX, cardY, font, bold, photo, vendorSignature, data);

    drawCardFrame(page, backX, cardY, false);
    drawBackFaceFormat1(page, backX, cardY, font, bold, italic, qrImage, data);
  } else {
    // Format 2 (Annexure-II) — "Entry Pass" header with ON CONTRACT side strip.
    drawCardFrame(page, frontX, cardY, true);
    drawFrontFace(page, frontX, cardY, font, bold, photo, vendorSignature, authoritySignature, data);

    drawCardFrame(page, backX, cardY, true);
    drawBackFace(page, backX, cardY, font, bold, italic, qrImage, data);
  }

  return doc.save();
};

function drawCardFrame(page: PDFPage, x: number, y: number, withStrip: boolean) {
  page.drawRectangle({ x, y, width: CARD_W, height: CARD_H, color: WHITE, borderColor: ORANGE, borderWidth: 1.5 });
  if (withStrip) drawSideStrip(page, x, y, CARD_H);
}

function drawSideStrip(page: PDFPage, x: number, y: number, height: number) {
  page.drawRectangle({ x, y, width: STRIP_W, height, color: ORANGE });
}

function drawStripLabel(page: PDFPage, x: number, y: number, height: number, font: PDFFont) {
  const letters = "ON CONTRACT".replace(/\s/g, "").split("");
  const size = 7.5;
  const usable = height - 16;
  const lineHeight = usable / letters.length;
  let cursorY = y + height - 12 - lineHeight * 0.6;
  for (const letter of letters) {
    const w = font.widthOfTextAtSize(letter, size);
    page.drawText(letter, { x: x + STRIP_W / 2 - w / 2, y: cursorY, size, font, color: WHITE });
    cursorY -= lineHeight;
  }
}

function drawFrontFace(
  page: PDFPage,
  x: number,
  y: number,
  font: PDFFont,
  bold: PDFFont,
  photo: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  vendorSignature: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  authoritySignature: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  data: IdCardRenderData
) {
  drawStripLabel(page, x, y, CARD_H, bold);

  const contentX = x + STRIP_W;
  const contentW = CARD_W - STRIP_W;
  const centerX = contentX + contentW / 2;

  drawCentered(page, "Entry Pass", centerX, y + CARD_H - 20, bold, 13, ORANGE);
  drawCentered(page, data.department ?? "Name of Office", centerX, y + CARD_H - 32, font, 7, MUTED);

  const photoSize = Math.min(contentW - 16, 90);
  const photoX = centerX - photoSize / 2;
  const photoY = y + CARD_H - 48 - photoSize;
  page.drawRectangle({ x: photoX, y: photoY, width: photoSize, height: photoSize, color: ORANGE_LIGHT, borderColor: ORANGE, borderWidth: 1 });
  if (photo) {
    const scale = Math.min(photoSize / photo.width, photoSize / photo.height);
    page.drawImage(photo, {
      x: photoX + (photoSize - photo.width * scale) / 2,
      y: photoY + (photoSize - photo.height * scale) / 2,
      width: photo.width * scale,
      height: photo.height * scale,
    });
  }

  let cursorY = photoY - 10;
  if (vendorSignature) {
    const maxW = contentW - 20;
    const scale = Math.min(maxW / vendorSignature.width, 16 / vendorSignature.height);
    page.drawImage(vendorSignature, {
      x: centerX - (vendorSignature.width * scale) / 2,
      y: cursorY - 14,
      width: vendorSignature.width * scale,
      height: vendorSignature.height * scale,
    });
  }
  page.drawLine({ start: { x: contentX + 10, y: cursorY - 16 }, end: { x: contentX + contentW - 10, y: cursorY - 16 }, thickness: 0.5, color: MUTED });
  drawCentered(page, "Signature of card holder", centerX, cursorY - 26, font, 5.5, MUTED);

  cursorY -= 40;
  page.drawText(`Name: ${data.fullName}`, { x: contentX + 8, y: cursorY, size: 8, font: bold, color: DARK });

  cursorY -= 28;
  if (authoritySignature) {
    const maxW = contentW - 20;
    const scale = Math.min(maxW / authoritySignature.width, 16 / authoritySignature.height);
    page.drawImage(authoritySignature, {
      x: centerX - (authoritySignature.width * scale) / 2,
      y: cursorY,
      width: authoritySignature.width * scale,
      height: authoritySignature.height * scale,
    });
  }
  page.drawLine({ start: { x: contentX + 10, y: cursorY - 2 }, end: { x: contentX + contentW - 10, y: cursorY - 2 }, thickness: 0.5, color: MUTED });
  drawCentered(page, "(Signature)", centerX, cursorY - 11, font, 5.5, MUTED);
  drawCentered(page, data.signingAuthorityDesignation ?? "Designation of Issuing Authority", centerX, cursorY - 19, font, 5.5, MUTED);
}

function drawBackFace(
  page: PDFPage,
  x: number,
  y: number,
  font: PDFFont,
  bold: PDFFont,
  italic: PDFFont,
  qrImage: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  data: IdCardRenderData
) {
  drawStripLabel(page, x, y, CARD_H, bold);

  const contentX = x + STRIP_W;
  const contentW = CARD_W - STRIP_W;
  const centerX = contentX + contentW / 2;

  const qrSize = 2 * 10 * MM * (contentW / (4.25 * 10 * MM)); // scaled to fit content width
  const qrBoxSize = Math.min(qrSize, contentW * 0.42);
  const qrY = y + CARD_H - 14 - qrBoxSize;
  page.drawImage(qrImage, { x: contentX + 6, y: qrY, width: qrBoxSize, height: qrBoxSize });

  const bgBoxSize = qrBoxSize * 0.75;
  const bgX = contentX + contentW - bgBoxSize - 6;
  const bgY = qrY + (qrBoxSize - bgBoxSize) / 2;
  page.drawRectangle({ x: bgX, y: bgY, width: bgBoxSize, height: bgBoxSize, color: ORANGE_LIGHT, borderColor: ORANGE, borderWidth: 1 });
  drawCentered(page, data.bloodGroup ?? "—", bgX + bgBoxSize / 2, bgY + bgBoxSize / 2 - 6, bold, 14, ORANGE);
  drawCentered(page, "Blood Group", bgX + bgBoxSize / 2, bgY - 8, font, 4.5, MUTED);

  let cursorY = qrY - 20;
  drawCentered(page, data.department ?? "—", centerX, cursorY, bold, 9, DARK);
  cursorY -= 14;
  drawCentered(page, data.vendorMobile ?? "—", centerX, cursorY, bold, 11, ORANGE);

  cursorY -= 18;
  const lines = [
    `Name of Contractor: ${data.contractorName ?? "—"}`,
    `Validity of Contract: ${fmtDate(data.contractValidFrom)} To ${fmtDate(data.contractValidTo)}`,
    `Date of Issue: ${fmtDate(data.issuedDate)}`,
    `Validity: 01 year from the date of issue`,
  ];
  for (const line of lines) {
    page.drawText(line, { x: contentX + 6, y: cursorY, size: 5.8, font, color: DARK });
    cursorY -= 10;
  }

  cursorY -= 4;
  page.drawText("Please surrender to issuing authority on", { x: contentX + 6, y: cursorY, size: 4.8, font: italic, color: MUTED });
  cursorY -= 7;
  page.drawText("completion/termination of contractual services.", { x: contentX + 6, y: cursorY, size: 4.8, font: italic, color: MUTED });

  drawCentered(page, `Card No: ${data.cardNumber}`, centerX, y + 6, font, 5, MUTED);
}

function drawFrontFaceFormat1(
  page: PDFPage,
  x: number,
  y: number,
  font: PDFFont,
  bold: PDFFont,
  photo: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  vendorSignature: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  data: IdCardRenderData
) {
  const centerX = x + CARD_W / 2;

  drawCentered(page, "Indian Railway", centerX, y + CARD_H - 20, bold, 13, ORANGE);
  drawCentered(page, `ID Card No. ${data.cardNumber}`, centerX, y + CARD_H - 32, font, 7, MUTED);

  const photoSize = Math.min(CARD_W - 16, 90);
  const photoX = centerX - photoSize / 2;
  const photoY = y + CARD_H - 48 - photoSize;
  page.drawRectangle({ x: photoX, y: photoY, width: photoSize, height: photoSize, color: ORANGE_LIGHT, borderColor: ORANGE, borderWidth: 1 });
  if (photo) {
    const scale = Math.min(photoSize / photo.width, photoSize / photo.height);
    page.drawImage(photo, {
      x: photoX + (photoSize - photo.width * scale) / 2,
      y: photoY + (photoSize - photo.height * scale) / 2,
      width: photo.width * scale,
      height: photo.height * scale,
    });
  }

  let cursorY = photoY - 10;
  if (vendorSignature) {
    const maxW = CARD_W - 20;
    const scale = Math.min(maxW / vendorSignature.width, 16 / vendorSignature.height);
    page.drawImage(vendorSignature, {
      x: centerX - (vendorSignature.width * scale) / 2,
      y: cursorY - 14,
      width: vendorSignature.width * scale,
      height: vendorSignature.height * scale,
    });
  }
  page.drawLine({ start: { x: x + 10, y: cursorY - 16 }, end: { x: x + CARD_W - 10, y: cursorY - 16 }, thickness: 0.5, color: MUTED });
  drawCentered(page, "Signature of card holder", centerX, cursorY - 26, font, 5.5, MUTED);

  cursorY -= 44;
  page.drawText(`Name: ${data.fullName}`, { x: x + 8, y: cursorY, size: 9, font: bold, color: DARK });

  cursorY -= 18;
  const label = "Issuing Authority";
  const labelWidth = font.widthOfTextAtSize(label, 5.5);
  page.drawText(label, { x: x + CARD_W - 10 - labelWidth, y: cursorY, size: 5.5, font, color: MUTED });
  if (data.signingAuthorityName) {
    cursorY -= 8;
    const nameWidth = font.widthOfTextAtSize(data.signingAuthorityName, 5.5);
    page.drawText(data.signingAuthorityName, { x: x + CARD_W - 10 - nameWidth, y: cursorY, size: 5.5, font, color: DARK });
  }
}

function drawBackFaceFormat1(
  page: PDFPage,
  x: number,
  y: number,
  font: PDFFont,
  bold: PDFFont,
  italic: PDFFont,
  qrImage: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  data: IdCardRenderData
) {
  const centerX = x + CARD_W / 2;

  const qrSize = 2 * 10 * MM * (CARD_W / (4.25 * 10 * MM));
  const qrBoxSize = Math.min(qrSize, CARD_W * 0.42);
  const qrY = y + CARD_H - 14 - qrBoxSize;
  page.drawImage(qrImage, { x: x + 6, y: qrY, width: qrBoxSize, height: qrBoxSize });

  const bgBoxSize = qrBoxSize * 0.75;
  const bgX = x + CARD_W - bgBoxSize - 6;
  const bgY = qrY + (qrBoxSize - bgBoxSize) / 2;
  page.drawRectangle({ x: bgX, y: bgY, width: bgBoxSize, height: bgBoxSize, color: ORANGE_LIGHT, borderColor: ORANGE, borderWidth: 1 });
  drawCentered(page, data.bloodGroup ?? "—", bgX + bgBoxSize / 2, bgY + bgBoxSize / 2 - 6, bold, 14, ORANGE);
  drawCentered(page, "Blood Group", bgX + bgBoxSize / 2, bgY - 8, font, 4.5, MUTED);

  let cursorY = qrY - 24;
  drawCentered(page, data.department ?? "—", centerX, cursorY, bold, 11, DARK);
  cursorY -= 18;
  drawCentered(page, data.vendorMobile ?? "—", centerX, cursorY, bold, 12, ORANGE);
  cursorY -= 16;
  drawCentered(page, maskAadhaar(data.aadhaarNumber), centerX, cursorY, bold, 10, DARK);

  cursorY -= 16;
  page.drawLine({ start: { x: x + 8, y: cursorY }, end: { x: x + CARD_W - 8, y: cursorY }, thickness: 0.5, color: MUTED });

  cursorY -= 12;
  drawCentered(page, "Instruction", centerX, cursorY, bold, 4.8, MUTED);
  cursorY -= 8;
  drawCentered(page, "Please surrender to issuing authority on", centerX, cursorY, italic, 4.8, MUTED);
  cursorY -= 7;
  drawCentered(page, "completion/termination of contractual services.", centerX, cursorY, italic, 4.8, MUTED);

  drawCentered(page, `Card No: ${data.cardNumber}`, centerX, y + 6, font, 5, MUTED);
}
