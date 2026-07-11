import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { api, ApiError } from "../api/client";
import { DIVISION_LABELS, type Vendor } from "../types";
import styles from "./IdCardQrPage.module.css";

export default function IdCardQrPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  function load() {
    api
      .get<Vendor[]>("/vendors")
      .then((v) => {
        setVendors(v);
        if (!selectedId && v.length > 0) setSelectedId(v[0].id);
      })
      .catch(() => setError("Unable to load vendors"));
  }

  useEffect(load, []);

  const selectedVendor = vendors.find((v) => v.id === selectedId) ?? null;

  const filtered = useMemo(
    () =>
      vendors.filter(
        (v) =>
          !search ||
          v.fullName.toLowerCase().includes(search.toLowerCase()) ||
          v.vendorCode.toLowerCase().includes(search.toLowerCase())
      ),
    [vendors, search]
  );

  useEffect(() => {
    if (!selectedVendor) {
      setQrDataUrl(null);
      return;
    }
    const payload = JSON.stringify({
      vendorCode: selectedVendor.vendorCode,
      fullName: selectedVendor.fullName,
      division: selectedVendor.division,
      unit: selectedVendor.unitStation,
      idCardStatus: selectedVendor.idCardStatus,
    });
    QRCode.toDataURL(payload, { width: 180, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [selectedVendor]);

  const activeCards = vendors.filter((v) => v.idCardStatus === "ACTIVE").length;
  const pendingCards = vendors.filter((v) => v.idCardStatus === "NOT_ISSUED").length;

  async function handleIssue() {
    if (!selectedVendor) return;
    setIsIssuing(true);
    setError(null);
    try {
      await api.post(`/vendors/${selectedVendor.id}/issue-id-card`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to issue ID card");
    } finally {
      setIsIssuing(false);
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>ID Card & QR Management</h1>
        <p className={styles.subtitle}>
          Generate, manage and verify digital identity credentials for railway vendors.
        </p>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Active IDs" value={activeCards} />
        <StatCard label="Pending Generation" value={pendingCards} />
        <StatCard label="Total Vendors" value={vendors.length} />
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
            {filtered.map((v) => (
              <button
                key={v.id}
                className={
                  v.id === selectedId ? styles.vendorItemActive : styles.vendorItem
                }
                onClick={() => setSelectedId(v.id)}
              >
                <div className={styles.vendorAvatar}>{v.fullName.charAt(0)}</div>
                <div>
                  <div className={styles.vendorName}>{v.fullName}</div>
                  <div className={styles.vendorSub}>{v.vendorCode}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className={styles.emptyState}>No vendors match your search.</p>
            )}
          </div>
        </div>

        <div className={styles.cardPanel}>
          {selectedVendor ? (
            <>
              <div className={styles.idCard}>
                <div className={styles.idCardHeader}>
                  <span>SOUTH EASTERN RAILWAY</span>
                  <span>Vendor Identity Card</span>
                </div>
                <div className={styles.idCardBody}>
                  <div className={styles.idCardAvatar}>
                    {selectedVendor.fullName.charAt(0)}
                  </div>
                  <div className={styles.idCardDetails}>
                    <div className={styles.idCardName}>{selectedVendor.fullName}</div>
                    <div className={styles.idCardRow}>
                      <span>Unit / Station</span>
                      <strong>{selectedVendor.unitStation}</strong>
                    </div>
                    <div className={styles.idCardRow}>
                      <span>Division</span>
                      <strong>{DIVISION_LABELS[selectedVendor.division]}</strong>
                    </div>
                    <div className={styles.idCardRow}>
                      <span>Vendor Type</span>
                      <strong>{selectedVendor.vendorType}</strong>
                    </div>
                    <div className={styles.idCardRow}>
                      <span>ID Number</span>
                      <strong>{selectedVendor.vendorCode}</strong>
                    </div>
                  </div>
                  {qrDataUrl && (
                    <img className={styles.qrImage} src={qrDataUrl} alt="Vendor QR code" />
                  )}
                </div>
                <div
                  className={
                    selectedVendor.idCardStatus === "ACTIVE"
                      ? styles.idCardStatusActive
                      : styles.idCardStatusPending
                  }
                >
                  {selectedVendor.idCardStatus === "ACTIVE"
                    ? "ID ACTIVE"
                    : selectedVendor.idCardStatus === "EXPIRED"
                    ? "ID EXPIRED"
                    : "NOT ISSUED"}
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.issueBtn}
                  onClick={handleIssue}
                  disabled={isIssuing || selectedVendor.idCardStatus === "ACTIVE"}
                >
                  {isIssuing
                    ? "Issuing…"
                    : selectedVendor.idCardStatus === "ACTIVE"
                    ? "ID Already Active"
                    : "Issue ID Card"}
                </button>
              </div>
            </>
          ) : (
            <p className={styles.emptyState}>Select a vendor to preview their ID card.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}
