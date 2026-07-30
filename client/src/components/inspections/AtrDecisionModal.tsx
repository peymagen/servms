import { useState } from "react";
import { useReviewAtrMutation, useDecideAtrMutation } from "../../api/inspectionApi";
import type { Inspection, InspectionAtr } from "../../types";
import styles from "../../styles/listPage.module.css";

type Mode = "forward" | "send_back_review" | "accept" | "reject" | "send_back_decide";

const TITLES: Record<Mode, string> = {
  forward: "Forward to Admin",
  send_back_review: "Send Back to Dealing Section",
  accept: "Accept Action Taken Report",
  reject: "Reject Action Taken Report",
  send_back_decide: "Return for Correction",
};

export default function AtrDecisionModal({
  inspection,
  atr,
  mode,
  onClose,
}: {
  inspection: Inspection;
  atr: InspectionAtr;
  mode: Mode;
  onClose: () => void;
}) {
  const [reviewAtr, { isLoading: reviewing }] = useReviewAtrMutation();
  const [decideAtr, { isLoading: deciding }] = useDecideAtrMutation();
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSubmitting = reviewing || deciding;

  async function handleSubmit() {
    setError(null);
    try {
      if (mode === "forward" || mode === "send_back_review") {
        await reviewAtr({
          id: inspection.id,
          atrId: atr.id,
          decision: mode === "forward" ? "forward" : "send_back",
          remarks: remarks || undefined,
        }).unwrap();
      } else {
        const decision = mode === "accept" ? "accepted" : mode === "reject" ? "rejected" : "sent_back";
        await decideAtr({ id: inspection.id, atrId: atr.id, decision, remarks: remarks || undefined }).unwrap();
      }
      onClose();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to record decision");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {TITLES[mode]} — {inspection.inspection_no}
        </h2>
        <div className={styles.formGrid}>
          <div className={styles.fieldWide}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Action Taken (submitted)</span>
              <div className={styles.strong}>{atr.action_description}</div>
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
