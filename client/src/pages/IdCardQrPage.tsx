import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { ASSET_BASE } from "../store/apiSlice";
import { useAuth } from "../context/AuthContext";
import {
  useGetIdCardsQuery,
  useRequestIdCardMutation,
  useApproveIdCardMutation,
  useRejectIdCardMutation,
} from "../api/idcardApi";
import { VENDOR_TYPE_LABELS, type CardExpirySource, type IdCard } from "../types";
import StatCard from "../components/ui/StatCard";
import styles from "./IdCardQrPage.module.css";

const APPROVAL_LABELS: Record<IdCard["approval_status"], string> = {
  draft: "Not Requested",
  pending_approval: "Pending Sub Admin Approval",
  approved: "Approved & Issued",
  rejected: "Rejected",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function IdCardQrPage() {
  const [searchParams] = useSearchParams();
  const preselectVendorId = searchParams.get("vendor");
  const { user, can } = useAuth();
  const canApprove = can("id_card_management", "approve_reject") && Boolean(user?.card_signing_authority);
  const canRequest = can("id_card_management", "create");

  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(
    preselectVendorId ? Number(preselectVendorId) : null
  );
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [expirySource, setExpirySource] = useState<CardExpirySource>("medical");
  const [rejectReason, setRejectReason] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const { data: listData } = useGetIdCardsQuery({ limit: 200 });
  const [requestCard, { isLoading: isRequesting }] = useRequestIdCardMutation();
  const [approveCard, { isLoading: isApproving }] = useApproveIdCardMutation();
  const [rejectCard, { isLoading: isRejecting }] = useRejectIdCardMutation();

  const cards = listData?.rows ?? [];

  useEffect(() => {
    if (!selectedVendorId && cards.length > 0) setSelectedVendorId(cards[0].vendor_id);
  }, [cards, selectedVendorId]);

  const selectedCard = cards.find((c) => c.vendor_id === selectedVendorId) ?? null;

  const filtered = useMemo(
    () =>
      cards.filter(
        (c) =>
          !search ||
          c.full_name.toLowerCase().includes(search.toLowerCase()) ||
          c.vendor_code.toLowerCase().includes(search.toLowerCase())
      ),
    [cards, search]
  );

  useEffect(() => {
    if (!selectedCard || selectedCard.approval_status !== "approved") {
      setQrDataUrl(null);
      return;
    }
    const payload = {
      vendor_name: selectedCard.full_name,
      vendor_type: VENDOR_TYPE_LABELS[selectedCard.vendor_type],
      contractor: selectedCard.contractor_name ?? null,
      contractor_mobile: selectedCard.contractor_mobile ?? null,
      unit: selectedCard.unit_name ?? null,
      id_card_validity: selectedCard.expiry_date ?? null,
      card_number: selectedCard.id_number,
      card_status: selectedCard.cards_status,
      issuing_authority_name: selectedCard.approved_by_name ?? null,
      blood_group: selectedCard.blood_group ?? null,
      department: selectedCard.division_name ?? null,
      verification_url: `${window.location.origin}/verify/${selectedCard.id_number}`,
    };
    QRCode.toDataURL(JSON.stringify(payload), { width: 400, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [selectedCard]);

  const activeCards = cards.filter((c) => c.approval_status === "approved").length;
  const pendingCards = cards.filter((c) => c.approval_status === "pending_approval").length;

  async function handleRequest() {
    if (!selectedCard) return;
    setError(null);
    try {
      await requestCard({ vendorId: selectedCard.vendor_id, template: "template_a", expiry_source: expirySource }).unwrap();
      setShowRequestForm(false);
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to submit issue request");
    }
  }

  async function handleApprove() {
    if (!selectedCard) return;
    setError(null);
    try {
      await approveCard(selectedCard.vendor_id).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to approve ID card");
    }
  }

  async function handleReject() {
    if (!selectedCard || !rejectReason.trim()) return;
    setError(null);
    try {
      await rejectCard({ vendorId: selectedCard.vendor_id, reason: rejectReason }).unwrap();
      setShowRejectForm(false);
      setRejectReason("");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to reject ID card");
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>ID Card & QR Management</h1>
        <p className={styles.subtitle}>
          Issue-request → Sub Admin approval → automatic digital signature → QR → PDF workflow for
          vendor identity credentials.
        </p>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Approved & Issued" value={activeCards} />
        <StatCard label="Pending Approval" value={pendingCards} />
        <StatCard label="Total Vendors" value={cards.length} />
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.layout}>
        <div className={styles.selectionPanel}>
          <h2 className={styles.panelTitle}>Vendor Selection</h2>
          <input
            className={styles.searchInput}
            placeholder="Search by Name / ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={styles.vendorList}>
            {filtered.map((c) => (
              <button
                key={c.vendor_id}
                className={c.vendor_id === selectedVendorId ? styles.vendorItemActive : styles.vendorItem}
                onClick={() => {
                  setSelectedVendorId(c.vendor_id);
                  setShowRequestForm(false);
                  setShowRejectForm(false);
                }}
              >
                <div className={styles.vendorAvatar}>{c.full_name.charAt(0)}</div>
                <div>
                  <div className={styles.vendorName}>{c.full_name}</div>
                  <div className={styles.vendorSub}>
                    {c.vendor_code} · {APPROVAL_LABELS[c.approval_status]}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className={styles.emptyState}>No vendors match your search.</p>}
          </div>
        </div>

        <div className={styles.cardPanel}>
          {selectedCard ? (
            <>
              {selectedCard.approval_status === "approved" ? (
                <div className={styles.idCard}>
                  <div className={styles.idCardHeader}>
                    <span>SOUTH EASTERN RAILWAY</span>
                    <span>Vendor Identity Card</span>
                  </div>
                  <div className={styles.idCardBody}>
                    <div className={styles.idCardAvatar}>{selectedCard.full_name.charAt(0)}</div>
                    <div className={styles.idCardDetails}>
                      <div className={styles.idCardName}>{selectedCard.full_name}</div>
                      <div className={styles.idCardRow}>
                        <span>Unit / Station</span>
                        <strong>{selectedCard.unit_name ?? selectedCard.station_name ?? "—"}</strong>
                      </div>
                      <div className={styles.idCardRow}>
                        <span>Division</span>
                        <strong>{selectedCard.division_name ?? "—"}</strong>
                      </div>
                      <div className={styles.idCardRow}>
                        <span>Vendor Type</span>
                        <strong>{VENDOR_TYPE_LABELS[selectedCard.vendor_type]}</strong>
                      </div>
                      <div className={styles.idCardRow}>
                        <span>Blood Group</span>
                        <strong>{selectedCard.blood_group ?? "—"}</strong>
                      </div>
                      <div className={styles.idCardRow}>
                        <span>ID Number</span>
                        <strong>{selectedCard.id_number}</strong>
                      </div>
                      <div className={styles.idCardRow}>
                        <span>Card Validity</span>
                        <strong>{formatDate(selectedCard.expiry_date)}</strong>
                      </div>
                      <div className={styles.idCardRow}>
                        <span>Issued / Signed By</span>
                        <strong>{selectedCard.approved_by_name ?? "—"}</strong>
                      </div>
                    </div>
                    {qrDataUrl && <img className={styles.qrImage} src={qrDataUrl} alt="Vendor QR code" />}
                  </div>
                  <div className={styles.idCardStatusActive}>ID ACTIVE — DIGITALLY SIGNED</div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p>
                    <strong>{APPROVAL_LABELS[selectedCard.approval_status]}</strong>
                  </p>
                  {selectedCard.approval_status === "pending_approval" && (
                    <p>
                      Requested by {selectedCard.requested_by_name ?? "—"} on {formatDate(selectedCard.requested_at)}
                    </p>
                  )}
                  {selectedCard.approval_status === "rejected" && selectedCard.rejection_reason && (
                    <p>Reason: {selectedCard.rejection_reason}</p>
                  )}
                </div>
              )}

              <div className={styles.actions}>
                {selectedCard.approval_status === "approved" && selectedCard.pdf_path && (
                  <a
                    className={styles.issueBtn}
                    href={`${ASSET_BASE}${selectedCard.pdf_path}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download PDF
                  </a>
                )}

                {canRequest && selectedCard.approval_status !== "pending_approval" && !showRequestForm && (
                  <button className={styles.issueBtn} onClick={() => setShowRequestForm(true)}>
                    {selectedCard.approval_status === "approved" ? "Re-issue ID Card" : "Request ID Card"}
                  </button>
                )}

                {canApprove && selectedCard.approval_status === "pending_approval" && (
                  <>
                    <button className={styles.issueBtn} onClick={handleApprove} disabled={isApproving}>
                      {isApproving ? "Approving…" : "Approve & Sign"}
                    </button>
                    <button className={styles.issueBtn} onClick={() => setShowRejectForm(true)}>
                      Reject
                    </button>
                  </>
                )}
              </div>

              {showRequestForm && (
                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  <label>
                    ID Card Expiry Driver
                    <select value={expirySource} onChange={(e) => setExpirySource(e.target.value as CardExpirySource)}>
                      <option value="medical">Use Medical Expiry</option>
                      <option value="police_verification">Use Police Verification Expiry</option>
                    </select>
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className={styles.issueBtn} onClick={handleRequest} disabled={isRequesting}>
                      {isRequesting ? "Submitting…" : "Submit Request"}
                    </button>
                    <button className={styles.issueBtn} onClick={() => setShowRequestForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {showRejectForm && (
                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  <label>
                    Rejection Reason
                    <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className={styles.issueBtn} onClick={handleReject} disabled={isRejecting || !rejectReason.trim()}>
                      {isRejecting ? "Rejecting…" : "Confirm Reject"}
                    </button>
                    <button className={styles.issueBtn} onClick={() => setShowRejectForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className={styles.emptyState}>Select a vendor to preview their ID card.</p>
          )}
        </div>
      </div>
    </div>
  );
}
