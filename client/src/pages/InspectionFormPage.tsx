import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCreateInspectionMutation,
  useEditInspectionMutation,
  useSubmitInspectionMutation,
  useGetInspectionByIdQuery,
  useGetInspectionCategoriesQuery,
  useGetInspectionTypesQuery,
} from "../api/inspectionApi";
import { useGetUnitsLiteQuery, useGetDivisionsQuery, useGetStationsQuery } from "../api/mastersApi";
import { useGetTrainsQuery } from "../api/trainApi";
import type { Inspection } from "../types";
import styles from "./ComplaintRegistrationPage.module.css";

export default function InspectionFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { data: existing } = useGetInspectionByIdQuery(Number(id), { skip: !isEdit });

  const { data: units = [] } = useGetUnitsLiteQuery();
  const { data: divisions = [] } = useGetDivisionsQuery();
  const [createInspection, { isLoading: isCreating }] = useCreateInspectionMutation();
  const [editInspection, { isLoading: isEditing }] = useEditInspectionMutation();
  const [submitInspection, { isLoading: isSubmitting }] = useSubmitInspectionMutation();

  const [unitId, setUnitId] = useState<number | "">("");
  const [divisionId, setDivisionId] = useState<number | "">("");
  const { data: stations = [] } = useGetStationsQuery(divisionId || undefined);
  const { data: trainsResult } = useGetTrainsQuery({ division_id: divisionId || undefined, limit: 500 });
  const [trainId, setTrainId] = useState<number | "">("");
  const [stationId, setStationId] = useState<number | "">("");

  const { data: categories = [] } = useGetInspectionCategoriesQuery();
  const [categoryId, setCategoryId] = useState<number | "">("");
  const { data: types = [] } = useGetInspectionTypesQuery({ categoryId: categoryId || 0 }, { skip: !categoryId });
  const [typeId, setTypeId] = useState<number | "">("");

  const [officialName, setOfficialName] = useState("");
  const [designation, setDesignation] = useState("");
  const [placeOfPosting, setPlaceOfPosting] = useState("");
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split("T")[0]);
  const [observations, setObservations] = useState("");
  const [deficiencies, setDeficiencies] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [remarks, setRemarks] = useState("");
  const [priority, setPriority] = useState<Inspection["priority"]>("medium");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setUnitId(existing.unit_id ?? "");
    setDivisionId(existing.division_id ?? "");
    setTrainId(existing.train_id ?? "");
    setStationId(existing.station_id ?? "");
    setCategoryId(existing.inspection_category_id ?? "");
    setTypeId(existing.inspection_type_id ?? "");
    setOfficialName(existing.inspecting_official_name ?? "");
    setDesignation(existing.designation ?? "");
    setPlaceOfPosting(existing.place_of_posting ?? "");
    setInspectionDate(existing.inspection_date ? existing.inspection_date.split("T")[0] : "");
    setObservations(existing.observations ?? "");
    setDeficiencies(existing.deficiencies ?? "");
    setRecommendations(existing.recommendations ?? "");
    setRemarks(existing.remarks ?? "");
    setPriority(existing.priority);
  }, [existing]);

  useEffect(() => {
    setTypeId("");
  }, [categoryId]);

  function handleFilesSelected(selected: FileList | null) {
    if (!selected) return;
    setFiles((prev) => [...prev, ...Array.from(selected)]);
  }

  function buildPayload() {
    return {
      unit_id: Number(unitId),
      division_id: divisionId || undefined,
      train_id: trainId || undefined,
      station_id: stationId || undefined,
      inspecting_official_name: officialName || undefined,
      designation: designation || undefined,
      place_of_posting: placeOfPosting || undefined,
      inspection_category_id: Number(categoryId),
      inspection_type_id: Number(typeId),
      inspection_date: inspectionDate,
      observations: observations || undefined,
      deficiencies: deficiencies || undefined,
      recommendations: recommendations || undefined,
      remarks: remarks || undefined,
      priority,
      documents: files.length > 0 ? files : undefined,
    };
  }

  async function handleSaveDraft(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!unitId || !categoryId || !typeId) {
      setError("Unit of Inspection, Category, and Type are required");
      return;
    }
    try {
      if (isEdit) {
        await editInspection({ id: Number(id), data: buildPayload() }).unwrap();
        navigate("/inspections");
      } else {
        const result = await createInspection(buildPayload()).unwrap();
        navigate(`/inspections/${result.id}/edit`);
      }
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to save inspection");
    }
  }

  async function handleSubmitInspection() {
    setError(null);
    try {
      let inspectionId = id ? Number(id) : undefined;
      if (!inspectionId) {
        const result = await createInspection(buildPayload()).unwrap();
        inspectionId = result.id;
      } else {
        await editInspection({ id: inspectionId, data: buildPayload() }).unwrap();
      }
      await submitInspection(inspectionId).unwrap();
      navigate("/inspections");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to submit inspection");
    }
  }

  const isBusy = isCreating || isEditing || isSubmitting;
  const canEditRecord = !isEdit || !existing || ["draft", "returned"].includes(existing.inspection_status);

  return (
    <div>
      <form onSubmit={handleSaveDraft}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>{isEdit ? `Edit Inspection ${existing?.inspection_no ?? ""}` : "New Inspection"}</h1>
            <p className={styles.subtitle}>File a digital inspection report. Save as draft, then submit for Sub-admin review.</p>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => navigate("/inspections")}>
              ✕ Cancel
            </button>
            <button type="submit" className={styles.cancelBtn} disabled={isBusy || !canEditRecord}>
              {isBusy ? "Saving…" : "💾 Save Draft"}
            </button>
            <button type="button" className={styles.submitBtn} disabled={isBusy || !canEditRecord} onClick={handleSubmitInspection}>
              {isBusy ? "Submitting…" : "▤ Submit for Review"}
            </button>
          </div>
        </div>

        {!canEditRecord && (
          <div className={styles.errorBanner}>
            This inspection is "{existing?.inspection_status}" and can no longer be edited.
          </div>
        )}
        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.grid}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>General Details</h2>
            <div className={styles.fieldRow}>
              <Field label="Date of Inspection">
                <div className={styles.inputWithIcon}>
                  <input type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} required />
                </div>
              </Field>
              <Field label="Unit of Inspection">
                <div className={styles.inputWithIcon}>
                  <select value={unitId} onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : "")} required>
                    <option value="">Select Unit</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_name} — {u.station_name}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Inspecting Official Name">
                <div className={styles.inputWithIcon}>
                  <input value={officialName} onChange={(e) => setOfficialName(e.target.value)} />
                </div>
              </Field>
              <Field label="Designation">
                <div className={styles.inputWithIcon}>
                  <input value={designation} onChange={(e) => setDesignation(e.target.value)} />
                </div>
              </Field>
            </div>
            <Field label="Place of Posting">
              <div className={styles.inputWithIcon}>
                <input value={placeOfPosting} onChange={(e) => setPlaceOfPosting(e.target.value)} />
              </div>
            </Field>
          </section>

          <aside className={styles.card}>
            <h2 className={styles.cardTitle}>Location</h2>
            <Field label="Division">
              <div className={styles.inputWithIcon}>
                <select
                  value={divisionId}
                  onChange={(e) => {
                    setDivisionId(e.target.value ? Number(e.target.value) : "");
                    setTrainId("");
                    setStationId("");
                  }}
                >
                  <option value="">Select Division</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.division_name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
            <Field label="Station (if applicable)">
              <div className={styles.inputWithIcon}>
                <select value={stationId} onChange={(e) => setStationId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— None —</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.station_name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
            <Field label="Train (if applicable)">
              <div className={styles.inputWithIcon}>
                <select value={trainId} onChange={(e) => setTrainId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— None —</option>
                  {(trainsResult?.rows ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.train_number} — {t.train_name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          </aside>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Classification</h2>
            <div className={styles.fieldRow}>
              <Field label="Inspection Category">
                <div className={styles.inputWithIcon}>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")} required>
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field label="Inspection Type">
                <div className={styles.inputWithIcon}>
                  <select value={typeId} onChange={(e) => setTypeId(e.target.value ? Number(e.target.value) : "")} disabled={!categoryId} required>
                    <option value="">{categoryId ? "Select Type" : "Select Category first"}</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>
            <Field label="Observations">
              <textarea value={observations} onChange={(e) => setObservations(e.target.value)} />
            </Field>
            <Field label="Deficiencies">
              <textarea value={deficiencies} onChange={(e) => setDeficiencies(e.target.value)} />
            </Field>
            <Field label="Recommendations">
              <textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} />
            </Field>
            <Field label="Remarks">
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
          </section>

          <aside className={styles.card}>
            <h2 className={styles.cardTitle}>Priority &amp; Documents</h2>
            <div className={styles.priorityRow}>
              {(["low", "medium", "high"] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  className={priority === p ? styles.priorityTileActive : styles.priorityTile}
                  onClick={() => setPriority(p)}
                >
                  <span>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                </button>
              ))}
            </div>
            <label className={styles.dropzone} style={{ marginTop: 16 }}>
              <input type="file" accept=".pdf,.doc,.docx,image/*" multiple hidden onChange={(e) => handleFilesSelected(e.target.files)} />
              <div className={styles.dropzoneTitle}>Click to upload documents</div>
              <div className={styles.dropzoneHint}>PDF, DOC, DOCX, JPG, PNG (Multiple files supported, max 20MB each)</div>
            </label>
            {files.length > 0 && (
              <div className={styles.thumbRow}>
                {files.map((file, i) => (
                  <div key={i} className={styles.thumb}>
                    <span className={styles.thumbFile}>{file.name.slice(0, 12)}</span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </form>
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
