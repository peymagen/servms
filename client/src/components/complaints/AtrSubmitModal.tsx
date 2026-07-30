import { useState } from "react";
import { useSubmitAtrMutation, useEditAtrMutation } from "../../api/complaintApi";
import type { Complaint, ComplaintAtr } from "../../types";
import styles from "../../styles/listPage.module.css";

export default function AtrSubmitModal({
  complaint,
  editingAtr,
  onClose,
}: {
  complaint: Complaint;
  editingAtr?: ComplaintAtr | null;
  onClose: () => void;
}) {
  const [submitAtr, { isLoading: submitting }] = useSubmitAtrMutation();
  const [editAtr, { isLoading: editing }] = useEditAtrMutation();
  const [remarks, setRemarks] = useState(editingAtr?.remarks ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isSubmitting = submitting || editing;

  async function handleSubmit() {
    setError(null);
    if (!remarks.trim()) {
      setError("Action Taken remarks are required");
      return;
    }
    try {
      if (editingAtr) {
        await editAtr({ id: complaint.id, atrId: editingAtr.id, remarks, documents: files.length ? files : undefined }).unwrap();
      } else {
        await submitAtr({ id: complaint.id, remarks, documents: files.length ? files : undefined }).unwrap();
      }
      onClose();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to submit Action Taken Report");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {editingAtr ? "Edit" : "Submit"} Action Taken Report — #{complaint.complaint_code}
        </h2>
        <div className={styles.formGrid}>
          <div className={styles.fieldWide}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Action Taken / Remarks</span>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
          <div className={styles.fieldWide}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Supporting Documents (optional)</span>
              <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            </div>
          </div>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.addBtn} onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : editingAtr ? "Save Changes" : "Submit ATR"}
          </button>
        </div>
      </div>
    </div>
  );
}
