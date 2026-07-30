import { useState, type ReactNode } from "react";
import { ASSET_BASE } from "../../store/apiSlice";
import { useGetComplaintByIdQuery, useCloseComplaintMutation } from "../../api/complaintApi";
import { useAuth } from "../../context/AuthContext";
import type { Complaint, ComplaintAtr } from "../../types";
import styles from "../../styles/listPage.module.css";
import AssignComplaintModal from "./AssignComplaintModal";
import AtrSubmitModal from "./AtrSubmitModal";
import AtrDecisionModal from "./AtrDecisionModal";

const STATUS_LABELS: Record<Complaint["complaints_status"], string> = {
  pending: "Pending",
  assigned: "Assigned",
  under_review: "Under Review",
  action_taken: "Action Taken",
  approved: "Approved",
  rejected: "Rejected",
  closed: "Closed",
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

type AssignAction = "initial" | "reassign" | "transfer";
type AtrDecisionMode = "review" | "accept" | "reject" | "send_back";

export default function ComplaintDetailModal({ complaintId, onClose }: { complaintId: number; onClose: () => void }) {
  const { can } = useAuth();
  const { data: complaint, isLoading } = useGetComplaintByIdQuery(complaintId);
  const [closeComplaint, { isLoading: closing }] = useCloseComplaintMutation();
  const [error, setError] = useState<string | null>(null);

  const [assignAction, setAssignAction] = useState<AssignAction | null>(null);
  const [atrSubmitTarget, setAtrSubmitTarget] = useState<ComplaintAtr | "new" | null>(null);
  const [atrDecision, setAtrDecision] = useState<{ atr: ComplaintAtr; mode: AtrDecisionMode } | null>(null);

  const canEdit = can("complaint_management", "edit");
  const canDecide = can("complaint_management", "approve_reject");

  async function handleClose() {
    setError(null);
    try {
      await closeComplaint({ id: complaintId }).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to close complaint");
    }
  }

  if (isLoading || !complaint) {
    return (
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  const canSubmitAtr = canEdit && ["assigned", "under_review", "action_taken"].includes(complaint.complaints_status);
  const canClose = canDecide && ["approved", "rejected"].includes(complaint.complaints_status);

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modal} style={{ maxWidth: 760, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
          <h2 className={styles.modalTitle}>
            #{complaint.complaint_code} <span className={styles.roleTag}>{complaint.complaint_source.toUpperCase()}</span>
          </h2>

          {error && <div className={styles.errorBanner}>{error}</div>}

          <div className={styles.formGrid}>
            <DetailItem label="Reference No." value={complaint.complaint_ref_no ?? "—"} />
            <DetailItem label="Status" value={STATUS_LABELS[complaint.complaints_status]} />
            <DetailItem label="Division" value={complaint.division_name ?? "—"} />
            <DetailItem label="Station / Train" value={complaint.station_name ?? complaint.train_number ?? "—"} />
            <DetailItem label="Concerned Unit" value={complaint.unit_name ?? "Not yet assigned"} />
            <DetailItem label="Priority" value={complaint.priority.toUpperCase()} />
            <DetailItem label="Complaint Type" value={complaint.complaint_type_label ?? "—"} />
            <DetailItem label="Complaint Sub-Type" value={complaint.complaint_subtype_label ?? "—"} />
            <DetailItem label="Complainant" value={complaint.complainant_name ?? "—"} />
            <DetailItem label="Mobile" value={complaint.complainant_mobile ?? "—"} />
            <DetailItem label="Registered On" value={formatDateTime(complaint.complaint_date)} />
            <DetailItem label="Registered By" value={complaint.registered_by_name ?? "—"} />
            <div className={styles.fieldWide}>
              <div className={styles.fieldLabel}>Description</div>
              <div className={styles.strong}>{complaint.description}</div>
            </div>
          </div>

          {complaint.documents && complaint.documents.length > 0 && (
            <Section title="Documents">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {complaint.documents.map((doc) => (
                  <a
                    key={doc.id}
                    className={styles.pageBtn}
                    href={`${ASSET_BASE}${doc.file_path}`}
                    target="_blank"
                    rel="noreferrer"
                    title={doc.original_name}
                  >
                    📄 {doc.document_type === "atr" ? "ATR" : "Evidence"}
                  </a>
                ))}
              </div>
            </Section>
          )}

          <Section
            title="Assignment"
            action={
              canEdit && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button className={styles.pageBtn} onClick={() => setAssignAction(complaint.unit_id ? "reassign" : "initial")}>
                    {complaint.unit_id ? "Reassign" : "Assign"}
                  </button>
                  {complaint.unit_id && (
                    <button className={styles.pageBtn} onClick={() => setAssignAction("transfer")}>
                      Transfer
                    </button>
                  )}
                </div>
              )
            }
          >
            {complaint.assignments && complaint.assignments.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                {complaint.assignments.map((a) => (
                  <li key={a.id}>
                    <strong>{a.assignment_type}</strong> to {a.to_unit_name ?? "—"} by {a.assigned_by_name ?? "—"} —{" "}
                    {formatDateTime(a.created_at)}
                    {a.remarks ? ` — ${a.remarks}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <span className={styles.hint}>Not yet assigned to a Concerned Unit.</span>
            )}
          </Section>

          <Section
            title="Action Taken Reports"
            action={
              canSubmitAtr && (
                <button className={styles.pageBtn} onClick={() => setAtrSubmitTarget("new")}>
                  + Submit ATR
                </button>
              )
            }
          >
            {complaint.atrs && complaint.atrs.length > 0 ? (
              complaint.atrs.map((atr) => (
                <div key={atr.id} style={{ borderTop: "1px solid var(--color-border)", padding: "8px 0", fontSize: 12.5 }}>
                  <div>
                    <span className={styles.strong}>{atr.review_status.replace(/_/g, " ")}</span> — submitted by{" "}
                    {atr.submitted_by_name ?? "—"} ({formatDateTime(atr.submitted_at)})
                  </div>
                  <div>{atr.remarks}</div>
                  {atr.review_remarks && <div>Sub-admin remarks: {atr.review_remarks}</div>}
                  {atr.decision_remarks && <div>Admin remarks: {atr.decision_remarks}</div>}
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {canEdit && atr.review_status === "pending_review" && (
                      <>
                        <button className={styles.pageBtn} onClick={() => setAtrSubmitTarget(atr)}>
                          Edit
                        </button>
                        <button className={styles.pageBtn} onClick={() => setAtrDecision({ atr, mode: "review" })}>
                          Review (Sub-admin)
                        </button>
                      </>
                    )}
                    {canDecide && atr.review_status === "sub_admin_reviewed" && (
                      <>
                        <button className={styles.pageBtn} onClick={() => setAtrDecision({ atr, mode: "accept" })}>
                          Accept
                        </button>
                        <button className={styles.pageBtn} onClick={() => setAtrDecision({ atr, mode: "reject" })}>
                          Reject
                        </button>
                        <button className={styles.pageBtn} onClick={() => setAtrDecision({ atr, mode: "send_back" })}>
                          Send Back
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <span className={styles.hint}>No Action Taken Report submitted yet.</span>
            )}
          </Section>

          <Section title="Status Timeline">
            {complaint.statusHistory && complaint.statusHistory.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                {complaint.statusHistory.map((h) => (
                  <li key={h.id}>
                    {h.from_status ? `${STATUS_LABELS[h.from_status as Complaint["complaints_status"]] ?? h.from_status} → ` : ""}
                    {STATUS_LABELS[h.to_status as Complaint["complaints_status"]] ?? h.to_status} — {formatDateTime(h.created_at)}
                    {h.changed_by_name ? ` (${h.changed_by_name})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <span className={styles.hint}>No history yet.</span>
            )}
          </Section>

          <div className={styles.modalActions}>
            {canClose && (
              <button type="button" className={styles.addBtn} onClick={handleClose} disabled={closing}>
                {closing ? "Closing…" : "Close Complaint"}
              </button>
            )}
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Close Window
            </button>
          </div>
        </div>
      </div>

      {assignAction && <AssignComplaintModal complaint={complaint} assignmentType={assignAction} onClose={() => setAssignAction(null)} />}
      {atrSubmitTarget && (
        <AtrSubmitModal
          complaint={complaint}
          editingAtr={atrSubmitTarget === "new" ? null : atrSubmitTarget}
          onClose={() => setAtrSubmitTarget(null)}
        />
      )}
      {atrDecision && (
        <AtrDecisionModal complaint={complaint} atr={atrDecision.atr} mode={atrDecision.mode} onClose={() => setAtrDecision(null)} />
      )}
    </>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, margin: 0, color: "var(--color-text-muted)" }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.strong}>{value}</div>
    </div>
  );
}
