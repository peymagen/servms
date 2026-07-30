import { useState, type ReactNode } from "react";
import { ASSET_BASE } from "../../store/apiSlice";
import {
  useGetInspectionByIdQuery,
  useSubmitInspectionMutation,
  useReturnToInspectorMutation,
  useCloseInspectionMutation,
  useDeleteInspectionDocumentMutation,
} from "../../api/inspectionApi";
import { useAuth } from "../../context/AuthContext";
import type { Inspection, InspectionAtr } from "../../types";
import styles from "../../styles/listPage.module.css";
import AssignInspectionModal from "./AssignInspectionModal";
import AtrDraftModal from "./AtrDraftModal";
import AtrDecisionModal from "./AtrDecisionModal";

const STATUS_LABELS: Record<Inspection["inspection_status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  returned: "Returned to Inspector",
  assigned: "Assigned",
  atr_submitted: "ATR Submitted",
  under_review: "Under Review",
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
type DecisionMode = "forward" | "send_back_review" | "accept" | "reject" | "send_back_decide";

export default function InspectionDetailModal({ inspectionId, onClose }: { inspectionId: number; onClose: () => void }) {
  const { user, can } = useAuth();
  const { data: inspection, isLoading } = useGetInspectionByIdQuery(inspectionId);
  const [submitInspection, { isLoading: submitting }] = useSubmitInspectionMutation();
  const [returnToInspector, { isLoading: returning }] = useReturnToInspectorMutation();
  const [closeInspection, { isLoading: closing }] = useCloseInspectionMutation();
  const [deleteDocument] = useDeleteInspectionDocumentMutation();
  const [error, setError] = useState<string | null>(null);

  const [assignAction, setAssignAction] = useState<AssignAction | null>(null);
  const [atrTarget, setAtrTarget] = useState<InspectionAtr | "new" | null>(null);
  const [decision, setDecision] = useState<{ atr: InspectionAtr; mode: DecisionMode } | null>(null);

  const canEdit = can("inspection_management", "edit");
  const canDecide = can("inspection_management", "approve_reject");
  const isOwner = inspection && (inspection as any).inspector_id === user?.id;

  async function handleSubmit() {
    setError(null);
    try {
      await submitInspection(inspectionId).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to submit inspection");
    }
  }

  async function handleReturn() {
    setError(null);
    try {
      await returnToInspector({ id: inspectionId }).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to return inspection");
    }
  }

  async function handleClose() {
    setError(null);
    try {
      await closeInspection({ id: inspectionId }).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to close inspection");
    }
  }

  if (isLoading || !inspection) {
    return (
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  const canSubmit = canEdit && isOwner && ["draft", "returned"].includes(inspection.inspection_status);
  const canReturn = canEdit && inspection.inspection_status === "submitted";
  const canAssign = canEdit && inspection.inspection_status === "submitted";
  const canReassign = canEdit && ["assigned", "atr_submitted"].includes(inspection.inspection_status);
  const canWorkAtr = canEdit && ["assigned", "atr_submitted"].includes(inspection.inspection_status);
  const canCloseInspection = canDecide && ["approved", "rejected"].includes(inspection.inspection_status);

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modal} style={{ maxWidth: 780, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
          <h2 className={styles.modalTitle}>{inspection.inspection_no ?? `Inspection #${inspection.id}`}</h2>

          {error && <div className={styles.errorBanner}>{error}</div>}

          <div className={styles.formGrid}>
            <DetailItem label="Status" value={STATUS_LABELS[inspection.inspection_status]} />
            <DetailItem label="Division" value={inspection.division_name ?? "—"} />
            <DetailItem label="Station / Train" value={inspection.station_name ?? inspection.train_number ?? "—"} />
            <DetailItem label="Unit of Inspection" value={inspection.unit_name ?? "—"} />
            <DetailItem label="Inspection Category" value={inspection.inspection_category_label ?? "—"} />
            <DetailItem label="Inspection Type" value={inspection.inspection_type_label ?? "—"} />
            <DetailItem label="Inspecting Official" value={inspection.inspecting_official_name ?? "—"} />
            <DetailItem label="Designation" value={inspection.designation ?? "—"} />
            <DetailItem label="Place of Posting" value={inspection.place_of_posting ?? "—"} />
            <DetailItem label="Priority" value={inspection.priority.toUpperCase()} />
            <DetailItem label="Inspection Date" value={formatDateTime(inspection.inspection_date)} />
            <DetailItem label="Inspector" value={inspection.inspector_name ?? "—"} />
            <div className={styles.fieldWide}>
              <div className={styles.fieldLabel}>Observations</div>
              <div className={styles.strong}>{inspection.observations ?? "—"}</div>
            </div>
            <div className={styles.fieldWide}>
              <div className={styles.fieldLabel}>Deficiencies</div>
              <div className={styles.strong}>{inspection.deficiencies ?? "—"}</div>
            </div>
            {inspection.recommendations && (
              <div className={styles.fieldWide}>
                <div className={styles.fieldLabel}>Recommendations</div>
                <div className={styles.strong}>{inspection.recommendations}</div>
              </div>
            )}
          </div>

          {canSubmit && (
            <div className={styles.modalActions} style={{ justifyContent: "flex-start" }}>
              <button className={styles.addBtn} onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit for Review"}
              </button>
            </div>
          )}

          {inspection.documents && inspection.documents.length > 0 && (
            <Section title="Documents">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {inspection.documents.map((doc) => (
                  <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <a className={styles.pageBtn} href={`${ASSET_BASE}${doc.file_path}`} target="_blank" rel="noreferrer" title={doc.original_name}>
                      📄 {doc.document_type === "atr" ? "ATR" : "Inspection"}
                    </a>
                    {canEdit && (
                      <button className={styles.pageBtn} title="Delete" onClick={() => deleteDocument({ documentId: doc.id, inspectionId: inspection.id })}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section
            title="Assignment"
            action={
              <div style={{ display: "flex", gap: 6 }}>
                {canReturn && (
                  <button className={styles.pageBtn} onClick={handleReturn} disabled={returning}>
                    Return to Inspector
                  </button>
                )}
                {canAssign && (
                  <button className={styles.pageBtn} onClick={() => setAssignAction("initial")}>
                    Assign
                  </button>
                )}
                {canReassign && (
                  <>
                    <button className={styles.pageBtn} onClick={() => setAssignAction("reassign")}>
                      Reassign
                    </button>
                    <button className={styles.pageBtn} onClick={() => setAssignAction("transfer")}>
                      Transfer
                    </button>
                  </>
                )}
              </div>
            }
          >
            {inspection.assignments && inspection.assignments.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                {inspection.assignments.map((a) => (
                  <li key={a.id}>
                    <strong>{a.assignment_type}</strong> to {a.to_unit_name ?? "—"} by {a.assigned_by_name ?? "—"} — {formatDateTime(a.created_at)}
                    {a.remarks ? ` — ${a.remarks}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <span className={styles.hint}>Not yet assigned to a Dealing Section.</span>
            )}
          </Section>

          <Section
            title="Action Taken Reports"
            action={
              canWorkAtr && (
                <button className={styles.pageBtn} onClick={() => setAtrTarget("new")}>
                  + Add ATR
                </button>
              )
            }
          >
            {inspection.atrs && inspection.atrs.length > 0 ? (
              inspection.atrs.map((atr) => (
                <div key={atr.id} style={{ borderTop: "1px solid var(--color-border)", padding: "8px 0", fontSize: 12.5 }}>
                  <div>
                    <span className={styles.strong}>{atr.review_status.replace(/_/g, " ")}</span> — {atr.completion_status.replace(/_/g, " ")}
                  </div>
                  <div>{atr.action_description}</div>
                  {atr.review_remarks && <div>Sub-admin remarks: {atr.review_remarks}</div>}
                  {atr.decision_remarks && <div>Admin remarks: {atr.decision_remarks}</div>}
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {canEdit && ["draft", "sent_back"].includes(atr.review_status) && (
                      <button className={styles.pageBtn} onClick={() => setAtrTarget(atr)}>
                        Edit / Submit
                      </button>
                    )}
                    {canEdit && atr.review_status === "pending_review" && (
                      <>
                        <button className={styles.pageBtn} onClick={() => setDecision({ atr, mode: "forward" })}>
                          Forward to Admin
                        </button>
                        <button className={styles.pageBtn} onClick={() => setDecision({ atr, mode: "send_back_review" })}>
                          Send Back
                        </button>
                      </>
                    )}
                    {canDecide && atr.review_status === "sub_admin_reviewed" && (
                      <>
                        <button className={styles.pageBtn} onClick={() => setDecision({ atr, mode: "accept" })}>
                          Accept
                        </button>
                        <button className={styles.pageBtn} onClick={() => setDecision({ atr, mode: "reject" })}>
                          Reject
                        </button>
                        <button className={styles.pageBtn} onClick={() => setDecision({ atr, mode: "send_back_decide" })}>
                          Return for Correction
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <span className={styles.hint}>No Action Taken Report yet.</span>
            )}
          </Section>

          <Section title="Status Timeline">
            {inspection.statusHistory && inspection.statusHistory.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                {inspection.statusHistory.map((h) => (
                  <li key={h.id}>
                    {h.from_status ? `${STATUS_LABELS[h.from_status as Inspection["inspection_status"]] ?? h.from_status} → ` : ""}
                    {STATUS_LABELS[h.to_status as Inspection["inspection_status"]] ?? h.to_status} — {formatDateTime(h.created_at)}
                    {h.changed_by_name ? ` (${h.changed_by_name})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <span className={styles.hint}>No history yet.</span>
            )}
          </Section>

          <div className={styles.modalActions}>
            {canCloseInspection && (
              <button type="button" className={styles.addBtn} onClick={handleClose} disabled={closing}>
                {closing ? "Closing…" : "Close Inspection"}
              </button>
            )}
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Close Window
            </button>
          </div>
        </div>
      </div>

      {assignAction && <AssignInspectionModal inspection={inspection} assignmentType={assignAction} onClose={() => setAssignAction(null)} />}
      {atrTarget && (
        <AtrDraftModal inspection={inspection} editingAtr={atrTarget === "new" ? null : atrTarget} onClose={() => setAtrTarget(null)} />
      )}
      {decision && <AtrDecisionModal inspection={inspection} atr={decision.atr} mode={decision.mode} onClose={() => setDecision(null)} />}
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
