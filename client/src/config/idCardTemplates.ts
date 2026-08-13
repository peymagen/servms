import type { CardTemplate } from "../types";

// Single source of truth for every selectable ID card format. Add a new entry here
// (and a matching branch in the server's renderIdCardPdf) to introduce another
// template — the selector, download actions, and live front/back preview all pick
// it up automatically as long as it fits this strip/header/signature/back-info shape.
export interface IdCardTemplateConfig {
  id: CardTemplate;
  name: string;
  description: string;
  hasSideStrip: boolean;
  headerTitle: string;
  // Thumbnail placeholder text for the TemplateSelector's mini mock.
  headerSubtitle: string;
  // Where the live preview's real header subtitle value comes from — "idNumber"
  // renders "ID Card No. <id>", "department" renders the fixed "Commercial Department" label.
  headerSubtitleKind: "idNumber" | "department";
  // Front face signature block: "dual" draws a vendor signature line plus a second
  // authority signature line + designation; "single" draws just the vendor signature
  // line plus an "Issuing Authority" name label.
  frontSignatureKind: "dual" | "single";
  // Back face info block below the department/contractor-mobile lines: "contractor"
  // prints contractor name + contract validity + date of issue; "masked" prints a
  // masked Aadhaar-style number instead.
  backInfoKind: "contractor" | "masked";
}

export const ID_CARD_TEMPLATES: IdCardTemplateConfig[] = [
  {
    id: "template_a",
    name: "Format 1 — Indian Railway",
    description: "Annexure B. Plain header, no side strip. Masked Aadhaar shown on the back.",
    hasSideStrip: false,
    headerTitle: "Indian Railway",
    headerSubtitle: "ID Card No. …",
    headerSubtitleKind: "idNumber",
    frontSignatureKind: "single",
    backInfoKind: "masked",
  },
  {
    id: "template_b",
    name: "Format 2 — Entry Pass",
    description: "Annexure-II. Orange \"ON CONTRACT\" side strip with Entry Pass header.",
    hasSideStrip: true,
    headerTitle: "Entry Pass",
    headerSubtitle: "Name of Office",
    headerSubtitleKind: "department",
    frontSignatureKind: "dual",
    backInfoKind: "contractor",
  },
];
