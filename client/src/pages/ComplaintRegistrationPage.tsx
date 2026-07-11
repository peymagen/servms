import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { Complaint, Unit } from "../types";
import styles from "./ComplaintRegistrationPage.module.css";

const CATEGORIES = [
  "Food Quality & Hygiene",
  "Overcharging",
  "Vendor Misbehavior",
  "Unauthorized Vendor",
  "Unhygienic Premises",
  "Other",
];

const PRIORITIES: Array<{ value: Complaint["priority"]; label: string; icon: ReactNode }> = [
  { value: "low", label: "Low", icon: <ExclaimIcon /> },
  { value: "medium", label: "Medium", icon: <WarnIcon /> },
  { value: "high", label: "High", icon: <StarIcon /> },
];

export default function ComplaintRegistrationPage() {
  const navigate = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState<number | "">("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [occurrenceDate, setOccurrenceDate] = useState("");
  const [occurrenceTime, setOccurrenceTime] = useState("");
  const [priority, setPriority] = useState<Complaint["priority"]>("medium");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<{ total: number; rows: Unit[] }>("/units?limit=100")
      .then((res) => setUnits(res.rows))
      .catch(() => {});
  }, []);

  function handleFilesSelected(selected: FileList | null) {
    if (!selected) return;
    setFiles((prev) => [...prev, ...Array.from(selected)]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("unit_id", String(unitId));
      formData.append("category", category);
      formData.append("description", description);
      formData.append("priority", priority);
      if (occurrenceDate) formData.append("occurrence_date", occurrenceDate);
      if (occurrenceTime) formData.append("occurrence_time", occurrenceTime);
      files.forEach((file) => formData.append("evidence", file));

      await api.post("/complaints", formData, true);
      navigate("/complaints");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to register complaint");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Complaint Registration</h1>
            <p className={styles.subtitle}>
              Lodge a new vendor-related grievance or operational issue within the SERVMS
              network.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => navigate("/complaints")}>
              ✕ Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "▤ Submit Complaint"}
            </button>
          </div>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.grid}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <InfoIcon /> General Details
            </h2>
            <div className={styles.fieldRow}>
              <Field label="Unit / Location (Searchable)">
                <div className={styles.inputWithIcon}>
                  <PinIcon />
                  <select value={unitId} onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : "")} required>
                    <option value="">e.g. Shalimar Station, Platform 2</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_name} — {u.station_name}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field label="Complaint Category">
                <div className={styles.inputWithIcon}>
                  <CategoryIcon />
                  <select value={category} onChange={(e) => setCategory(e.target.value)} required>
                    <option value="">Select Category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>
            <Field label="Detailed Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a clear and concise description of the incident, including specific details that can aid in investigation…"
                required
              />
            </Field>
          </section>

          <aside className={styles.card}>
            <h2 className={styles.cardTitle}>Incident Parameters</h2>
            <Field label="Occurrence Date">
              <div className={styles.inputWithIcon}>
                <CalendarIcon />
                <input
                  type="date"
                  value={occurrenceDate}
                  onChange={(e) => setOccurrenceDate(e.target.value)}
                />
              </div>
            </Field>
            <Field label="Occurrence Time">
              <div className={styles.inputWithIcon}>
                <ClockIcon />
                <input
                  type="time"
                  value={occurrenceTime}
                  onChange={(e) => setOccurrenceTime(e.target.value)}
                />
              </div>
            </Field>
            <span className={styles.fieldLabel}>Priority Level</span>
            <div className={styles.priorityRow}>
              {PRIORITIES.map((p) => (
                <button
                  type="button"
                  key={p.value}
                  className={priority === p.value ? styles.priorityTileActive : styles.priorityTile}
                  onClick={() => setPriority(p.value)}
                >
                  {p.icon}
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <ClipIcon /> Evidence &amp; Documentation
            </h2>
            <label className={styles.dropzone}>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                hidden
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <CloudUploadIcon />
              <div className={styles.dropzoneTitle}>Click to upload or drag and drop</div>
              <div className={styles.dropzoneHint}>PNG, JPG or PDF (Multiple files supported)</div>
            </label>
            {files.length > 0 && (
              <div className={styles.thumbRow}>
                {files.map((file, i) => (
                  <div key={i} className={styles.thumb}>
                    {file.type.startsWith("image/") ? (
                      <img src={URL.createObjectURL(file)} alt={file.name} />
                    ) : (
                      <span className={styles.thumbFile}>{file.name.slice(0, 10)}</span>
                    )}
                  </div>
                ))}
                <label className={styles.thumbAdd}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    hidden
                    onChange={(e) => handleFilesSelected(e.target.files)}
                  />
                  +
                </label>
              </div>
            )}
          </section>

          <aside className={styles.stack}>
            <div className={styles.policyCard}>
              <div className={styles.policyTitle}>
                <ListCheckIcon /> Registration Policy
              </div>
              <ul className={styles.policyList}>
                <li>Ensure all fields are factual and evidence-backed.</li>
                <li>Frivolous complaints may lead to administrative action.</li>
                <li>Investigation typically initiates within 24 business hours.</li>
              </ul>
              <div className={styles.policyDivider} />
              <div className={styles.protectionRow}>
                <span className={styles.toggleOn} /> Sovereign Data Protection Active
              </div>
            </div>

            <div className={styles.locationCard}>
              <div className={styles.locationHeader}>
                <span>Location Context</span>
                <span className={styles.liveBadge}>LIVE TRACKING</span>
              </div>
              <div className={styles.mapGraphic}>
                <div className={styles.mapDiamond}>
                  <PinFilledIcon />
                </div>
                <div className={styles.mapLabel}>S.E. Railway Zone</div>
              </div>
            </div>
          </aside>
        </div>
      </form>

      <p className={styles.footer}>SECURE TRANSACTION ENCRYPTED VIA RAILWAY INTRANET NODES</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 11v5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="9.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CategoryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="14" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13" y="14" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ExclaimIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 6v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17.5" r="1" fill="currentColor" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M10.3 4.3a2 2 0 0 1 3.4 0l7.4 12.8A2 2 0 0 1 19.4 20H4.6a2 2 0 0 1-1.7-3l7.4-12.7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M12 9.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="16.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2v6M12 16v6M2 12h6M16 12h6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M19.1 4.9l-4.2 4.2M9.1 14.9l-4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClipIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 12.5 15 5.5a3.2 3.2 0 0 1 4.5 4.5l-8.5 8.5a5 5 0 1 1-7-7l8-8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloudUploadIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 18a4 4 0 0 1-.6-7.95A5 5 0 0 1 16 8.5a4 4 0 0 1 .8 7.9"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M12 21v-8M9 15l3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ListCheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinFilledIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.4" fill="white" />
    </svg>
  );
}
