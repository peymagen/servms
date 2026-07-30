import { useState } from "react";
import { useGetUnitsLiteQuery } from "../../api/mastersApi";
import { useAssignComplaintMutation, useReassignComplaintMutation, useTransferComplaintMutation } from "../../api/complaintApi";
import type { Complaint } from "../../types";
import styles from "../../styles/listPage.module.css";

type AssignmentType = "initial" | "reassign" | "transfer";

const TITLES: Record<AssignmentType, string> = {
  initial: "Assign Complaint",
  reassign: "Reassign Complaint",
  transfer: "Transfer Complaint",
};

export default function AssignComplaintModal({
  complaint,
  assignmentType,
  onClose,
}: {
  complaint: Complaint;
  assignmentType: AssignmentType;
  onClose: () => void;
}) {
  const { data: units = [] } = useGetUnitsLiteQuery();
  const [assign, { isLoading: assigning }] = useAssignComplaintMutation();
  const [reassign, { isLoading: reassigning }] = useReassignComplaintMutation();
  const [transfer, { isLoading: transferring }] = useTransferComplaintMutation();

  const [toUnitId, setToUnitId] = useState<number | "">(complaint.unit_id ?? "");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSubmitting = assigning || reassigning || transferring;

  async function handleSubmit() {
    setError(null);
    if (!toUnitId) {
      setError("Concerned Unit is required");
      return;
    }
    const body = { to_unit_id: Number(toUnitId), remarks: remarks || undefined };
    try {
      if (assignmentType === "initial") await assign({ id: complaint.id, data: body }).unwrap();
      else if (assignmentType === "reassign") await reassign({ id: complaint.id, data: body }).unwrap();
      else await transfer({ id: complaint.id, data: body }).unwrap();
      onClose();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to update assignment");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {TITLES[assignmentType]} — #{complaint.complaint_code}
        </h2>
        <div className={styles.formGrid}>
          <div className={styles.fieldWide}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Concerned Unit</span>
              <select value={toUnitId} onChange={(e) => setToUnitId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select Unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_name} — {u.station_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.fieldWide}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Remarks</span>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.addBtn} onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
