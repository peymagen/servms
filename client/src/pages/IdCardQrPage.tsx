import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { api, ApiError } from "../api/client";
import type { IdCard } from "../types";
import StatCard from "../components/ui/StatCard";
import styles from "./IdCardQrPage.module.css";

export default function IdCardQrPage() {
  const [searchParams] = useSearchParams();
  const preselectVendorId = searchParams.get("vendor");
  const [cards, setCards] = useState<IdCard[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(
    preselectVendorId ? Number(preselectVendorId) : null
  );
  const [search, setSearch] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  function load() {
    api
      .get<{ total: number; rows: IdCard[] }>("/idcards?limit=100")
      .then((res) => {
        setCards(res.rows);
        if (!selectedVendorId && res.rows.length > 0) setSelectedVendorId(res.rows[0].vendor_id);
      })
      .catch(() => setError("Unable to load ID cards"));
  }

  useEffect(load, []);

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
    if (!selectedCard) {
      setQrDataUrl(null);
      return;
    }
    const code = selectedCard.qr_code_data ?? selectedCard.id_number;
    const verifyUrl = `${window.location.origin}/verify/${encodeURIComponent(code)}`;
    QRCode.toDataURL(verifyUrl, { width: 180, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [selectedCard]);

  const activeCards = cards.filter((c) => c.cards_status === "active").length;
  const pendingCards = cards.filter((c) => c.cards_status === "pending").length;

  async function handleIssue() {
    if (!selectedCard) return;
    setIsIssuing(true);
    setError(null);
    try {
      await api.post(`/idcards/${selectedCard.vendor_id}/issue`);
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
                onClick={() => setSelectedVendorId(c.vendor_id)}
              >
                <div className={styles.vendorAvatar}>{c.full_name.charAt(0)}</div>
                <div>
                  <div className={styles.vendorName}>{c.full_name}</div>
                  <div className={styles.vendorSub}>{c.vendor_code}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className={styles.emptyState}>No vendors match your search.</p>}
          </div>
        </div>

        <div className={styles.cardPanel}>
          {selectedCard ? (
            <>
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
                      <strong>{selectedCard.vendor_type}</strong>
                    </div>
                    <div className={styles.idCardRow}>
                      <span>ID Number</span>
                      <strong>{selectedCard.id_number}</strong>
                    </div>
                  </div>
                  {qrDataUrl && <img className={styles.qrImage} src={qrDataUrl} alt="Vendor QR code" />}
                </div>
                <div
                  className={
                    selectedCard.cards_status === "active"
                      ? styles.idCardStatusActive
                      : styles.idCardStatusPending
                  }
                >
                  {selectedCard.cards_status === "active"
                    ? "ID ACTIVE"
                    : selectedCard.cards_status === "expired"
                    ? "ID EXPIRED"
                    : "NOT ISSUED"}
                </div>
              </div>

              <div className={styles.actions}>
                <button className={styles.issueBtn} onClick={handleIssue} disabled={isIssuing}>
                  {isIssuing
                    ? "Issuing…"
                    : selectedCard.cards_status === "active"
                    ? "Reissue ID Card"
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
