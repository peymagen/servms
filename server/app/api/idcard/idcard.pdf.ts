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
  unitName: string | null;
  stationName: string | null;
  divisionName: string | null;
  photoPath: string | null;
  cardNumber: string;
  cardStatus: string;
  issuedDate: string | null;
  expiryDate: string | null;
  signingAuthorityName: string | null;
  signingAuthorityDesignation: string | null;
  signaturePath: string | null;
}

const NAVY = rgb(0.075, 0.16, 0.35);
const TEAL = rgb(0.06, 0.35, 0.32);
const WHITE = rgb(1, 1, 1);
const DARK = rgb(0.15, 0.15, 0.18);
const MUTED = rgb(0.4, 0.4, 0.44);

async function embedImage(doc: PDFDocument, img: { bytes: Buffer; isPng: boolean } | null) {
  if (!img) return null;
  try {
    return img.isPng ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
  } catch {
    return null;
  }
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color = DARK
) {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
      line = word;
      cursorY -= size + 2;
    } else {
      line = test;
    }
  }
  if (line) page.drawText(line, { x, y: cursorY, size, font, color });
  return cursorY;
}

// Renders one of the two UAT card templates to a single-page PDF and returns the bytes.
// Template A: portrait badge, navy header. Template B: landscape card, teal accent.
export const renderIdCardPdf = async (
  template: CardTemplate,
  data: IdCardRenderData,
  qrPayload: IQrPayload
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const qrPng = await QRCode.toBuffer(JSON.stringify(qrPayload), { margin: 1, width: 200 });
  const qrImage = await doc.embedPng(qrPng);
  const photo = await embedImage(doc, loadImageBytes(data.photoPath));
  const signature = await embedImage(doc, loadImageBytes(data.signaturePath));

  if (template === "template_b") {
    return renderLandscape(doc, font, bold, qrImage, photo, signature, data);
  }
  return renderPortrait(doc, font, bold, qrImage, photo, signature, data);
};

async function renderPortrait(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  qrImage: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  photo: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  signature: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  data: IdCardRenderData
): Promise<Uint8Array> {
  const W = 243;
  const H = 380;
  const page = doc.addPage([W, H]);

  page.drawRectangle({ x: 0, y: H - 56, width: W, height: 56, color: NAVY });
  page.drawText("SOUTH EASTERN RAILWAY", { x: 14, y: H - 24, size: 9, font: bold, color: WHITE });
  page.drawText("VENDOR IDENTITY CARD", { x: 14, y: H - 38, size: 11, font: bold, color: WHITE });

  const photoBoxY = H - 140;
  page.drawRectangle({ x: (W - 84) / 2, y: photoBoxY, width: 84, height: 84, color: rgb(0.9, 0.9, 0.92) });
  if (photo) {
    const scale = Math.min(84 / photo.width, 84 / photo.height);
    page.drawImage(photo, {
      x: (W - photo.width * scale) / 2,
      y: photoBoxY + (84 - photo.height * scale) / 2,
      width: photo.width * scale,
      height: photo.height * scale,
    });
  }

  page.drawText(data.fullName, { x: 14, y: photoBoxY - 18, size: 12, font: bold, color: DARK });
  page.drawText(data.vendorTypeLabel, { x: 14, y: photoBoxY - 32, size: 8, font, color: MUTED });

  let y = photoBoxY - 52;
  const rows: [string, string][] = [
    ["Vendor Code", data.vendorCode],
    ["Contractor", data.contractorName ?? "—"],
    ["Unit", data.unitName ?? "—"],
    ["Station / Division", `${data.stationName ?? "—"} / ${data.divisionName ?? "—"}`],
    ["Card Number", data.cardNumber],
    ["Valid Until", data.expiryDate ?? "—"],
  ];
  for (const [label, value] of rows) {
    page.drawText(label.toUpperCase(), { x: 14, y, size: 6.5, font: bold, color: MUTED });
    y -= 9;
    y = drawWrappedText(page, value, 14, y, W - 28, font, 8.5) - 6;
  }

  page.drawImage(qrImage, { x: W - 74, y: 40, width: 60, height: 60 });

  if (signature) {
    const scale = Math.min(50 / signature.width, 20 / signature.height);
    page.drawImage(signature, { x: 14, y: 46, width: signature.width * scale, height: signature.height * scale });
  }
  page.drawText(data.signingAuthorityName ?? "—", { x: 14, y: 32, size: 7, font: bold, color: DARK });
  page.drawText(data.signingAuthorityDesignation ?? "Issuing Authority", { x: 14, y: 22, size: 6, font, color: MUTED });
  page.drawLine({ start: { x: 14, y: 44 }, end: { x: 70, y: 44 }, thickness: 0.5, color: MUTED });

  page.drawText(`Status: ${data.cardStatus.toUpperCase()}`, { x: 14, y: 8, size: 6, font: bold, color: NAVY });

  return doc.save();
}

async function renderLandscape(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  qrImage: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  photo: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  signature: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  data: IdCardRenderData
): Promise<Uint8Array> {
  const W = 380;
  const H = 243;
  const page = doc.addPage([W, H]);

  page.drawRectangle({ x: 0, y: 0, width: 10, height: H, color: TEAL });
  page.drawRectangle({ x: 0, y: H - 34, width: W, height: 34, color: TEAL });
  page.drawText("SOUTH EASTERN RAILWAY — VENDOR IDENTITY CARD", { x: 20, y: H - 22, size: 10, font: bold, color: WHITE });

  const photoBoxX = 20;
  const photoBoxY = H - 120;
  page.drawRectangle({ x: photoBoxX, y: photoBoxY, width: 76, height: 76, color: rgb(0.9, 0.9, 0.92) });
  if (photo) {
    const scale = Math.min(76 / photo.width, 76 / photo.height);
    page.drawImage(photo, {
      x: photoBoxX + (76 - photo.width * scale) / 2,
      y: photoBoxY + (76 - photo.height * scale) / 2,
      width: photo.width * scale,
      height: photo.height * scale,
    });
  }

  const detailX = 110;
  page.drawText(data.fullName, { x: detailX, y: H - 50, size: 13, font: bold, color: DARK });
  page.drawText(data.vendorTypeLabel, { x: detailX, y: H - 64, size: 8, font, color: MUTED });

  let y = H - 82;
  const rows: [string, string][] = [
    ["Vendor Code", data.vendorCode],
    ["Contractor", data.contractorName ?? "—"],
    ["Unit / Station", `${data.unitName ?? "—"} / ${data.stationName ?? "—"}`],
    ["Card Number", data.cardNumber],
    ["Valid Until", data.expiryDate ?? "—"],
  ];
  for (const [label, value] of rows) {
    page.drawText(`${label}:`, { x: detailX, y, size: 7.5, font: bold, color: MUTED });
    page.drawText(value, { x: detailX + 78, y, size: 7.5, font, color: DARK });
    y -= 13;
  }

  page.drawImage(qrImage, { x: W - 90, y: H - 130, width: 70, height: 70 });

  if (signature) {
    const scale = Math.min(60 / signature.width, 22 / signature.height);
    page.drawImage(signature, { x: detailX, y: 22, width: signature.width * scale, height: signature.height * scale });
  }
  page.drawLine({ start: { x: detailX, y: 20 }, end: { x: detailX + 70, y: 20 }, thickness: 0.5, color: MUTED });
  page.drawText(data.signingAuthorityName ?? "—", { x: detailX, y: 10, size: 7, font: bold, color: DARK });
  page.drawText(data.signingAuthorityDesignation ?? "Issuing Authority", { x: detailX + 90, y: 10, size: 6, font, color: MUTED });
  page.drawText(`Status: ${data.cardStatus.toUpperCase()}`, { x: W - 90, y: H - 140, size: 6, font: bold, color: TEAL });

  return doc.save();
}
