import { useState } from "react";
import { useCreateAtrDraftMutation, useEditAtrMutation, useSubmitAtrMutation } from "../../api/inspectionApi";
import type { Inspection, InspectionAtr } from "../../types";
import styles from "../../styles/listPage.module.css";

const COMPLETION_LABELS: Record<InspectionAtr["completion_status"], string> = {
  in_progress: "In Progress",
  partially_completed: "Partially Completed",
  completed: "Completed",
};

export default function AtrDraftModal({
  inspection,
  editingAtr,
  onClose,
}: {
  inspection: Inspection;
  editingAtr?: InspectionAtr | null;
  onClose: () => void;
}) {
  const [createDraft, { isLoading: creating }] = useCreateAtrDraftMutation();
  const [editAtr, { isLoading: editing }] = useEditAtrMutation();
  const [submitAtr, { isLoading: submitting }] = useSubmitAtrMutation();

  const [actionDescription, setActionDescription] = useState(editingAtr?.action_description ?? "");
  const [actionDate, setActionDate] = useState(editingAtr?.action_date?.split("T")[0] ?? "");
  const [completionStatus, setCompletionStatus] = useState<InspectionAtr["completion_status"]>(editingAtr?.completion_status ?? "in_progress");
  const [remarks, setRemarks] = useState(editingAtr?.remarks ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isBusy = creating || editing || submitting;

  function buildPayload() {
    return {
      action_description: actionDescription,
      action_date: actionDate || undefined,
      completion_status: completionStatus,
      remarks: remarks || undefined,
      documents: files.length ? files : undefined,
    };
  }

  async function handleSaveDraft() {
    setError(null);
    if (!actionDescription.trim()) {
      setError("Action Description is required");
      return;
    }
    try {
      if (editingAtr) {
        await editAtr({ id: inspection.id, atrId: editingAtr.id, ...buildPayload() }).unwrap();
      } else {
        await createDraft({ id: inspection.id, ...buildPayload() }).unwrap();
      }
      onClose();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to save Action Taken Report");
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!actionDescription.trim()) {
      setError("Action Description is required");
      return;
    }
    try {
      let atrId = editingAtr?.id;
      if (atrId) {
        await editAtr({ id: inspection.id, atrId, ...buildPayload() }).unwrap();
      } else {
        const result = await createDraft({ id: inspection.id, ...buildPayload() }).unwrap();
        atrId = result.id;
      }
      await submitAtr({ id: inspection.id, atrId }).unwrap();
      onClose();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to submit Action Taken Report");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Action Taken Report — {inspection.inspection_no}</h2>
        <div className={styles.formGrid}>
          <div className={styles.fieldWide}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Action Description</span>
              <textarea value={actionDescription} onChange={(e) => setActionDescription(e.target.value)} />
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Action Date</span>
            <input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Completion Status</span>
            <select value={completionStatus} onChange={(e) => setCompletionStatus(e.target.value as InspectionAtr["completion_status"])}>
              {Object.entries(COMPLETION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.fieldWide}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Remarks</span>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
          <div className={styles.fieldWide}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Supporting Documents (optional)</span>
              <input type="file" multiple accept=".pdf,.doc,.docx,image/*" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            </div>
          </div>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.cancelBtn} onClick={handleSaveDraft} disabled={isBusy}>
            {isBusy ? "Saving…" : "Save Draft"}
          </button>
          <button type="button" className={styles.addBtn} onClick={handleSubmit} disabled={isBusy}>
            {isBusy ? "Submitting…" : "Submit ATR"}
          </button>
        </div>
      </div>
    </div>
  );
}
