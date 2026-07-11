import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import {
  DIVISION_LABELS,
  type Contractor,
  type Division,
  type Vendor,
} from "../types";
import styles from "./VendorManagementPage.module.css";

const DIVISIONS: Division[] = ["ADRA", "RANCHI", "CHAKRADHARPUR", "KHARAGPUR"];

export default function VendorManagementPage() {
  const [tab, setTab] = useState<"contractors" | "vendors">("contractors");

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vendor Management</h1>
          <p className={styles.subtitle}>
            Manage contractors and vendors across South Eastern Railway divisions.
          </p>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={tab === "contractors" ? styles.tabActive : styles.tab}
          onClick={() => setTab("contractors")}
        >
          Contractors
        </button>
        <button
          className={tab === "vendors" ? styles.tabActive : styles.tab}
          onClick={() => setTab("vendors")}
        >
          Vendors
        </button>
      </div>

      {tab === "contractors" ? <ContractorsPanel /> : <VendorsPanel />}
    </div>
  );
}

function ContractorsPanel() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  function load() {
    setIsLoading(true);
    api
      .get<Contractor[]>("/contractors")
      .then(setContractors)
      .catch(() => setError("Unable to load contractors"))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  const totalActive = contractors.filter((c) => c.status === "ACTIVE").length;
  const feesOverdue = contractors.filter((c) => c.feeStatus === "OVERDUE").length;
  const totalVendors = contractors.reduce((sum, c) => sum + c._count.vendors, 0);

  return (
    <div>
      <div className={styles.statGrid}>
        <StatCard label="Total Contractors" value={contractors.length} />
        <StatCard label="Active" value={totalActive} />
        <StatCard label="Fees Overdue" value={feesOverdue} />
        <StatCard label="Total Vendors" value={totalVendors} />
      </div>

      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Master Contractor Listing</h2>
        <button className={styles.addBtn} onClick={() => setIsFormOpen(true)}>
          + Onboard New Contractor
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Contractor Name</th>
              <th>License Number</th>
              <th>Division</th>
              <th>Validity Date</th>
              <th>Fee Status</th>
              <th>Vendor Count</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : contractors.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  No contractors yet.
                </td>
              </tr>
            ) : (
              contractors.map((c) => (
                <tr key={c.id}>
                  <td className={styles.strong}>{c.name}</td>
                  <td>{c.licenseNumber}</td>
                  <td>{DIVISION_LABELS[c.division]}</td>
                  <td>{new Date(c.validityDate).toLocaleDateString()}</td>
                  <td>
                    <span
                      className={
                        c.feeStatus === "PAID" ? styles.statusGood : styles.statusBad
                      }
                    >
                      {c.feeStatus === "PAID" ? "Paid" : "Overdue"}
                    </span>
                  </td>
                  <td>{c._count.vendors}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <AddContractorModal
          onClose={() => setIsFormOpen(false)}
          onCreated={() => {
            setIsFormOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddContractorModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [division, setDivision] = useState<Division>("ADRA");
  const [validityDate, setValidityDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/contractors", { name, licenseNumber, division, validityDate });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create contractor");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>Onboard New Contractor</h2>
        <div className={styles.formGrid}>
          <Field label="Contractor / Company Name">
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="License Number">
            <input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              required
            />
          </Field>
          <Field label="Division">
            <select value={division} onChange={(e) => setDivision(e.target.value as Division)}>
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>
                  {DIVISION_LABELS[d]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="License Validity">
            <input
              type="date"
              value={validityDate}
              onChange={(e) => setValidityDate(e.target.value)}
              required
            />
          </Field>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit Registration"}
          </button>
        </div>
      </form>
    </div>
  );
}

function VendorsPanel() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  function load() {
    setIsLoading(true);
    Promise.all([api.get<Vendor[]>("/vendors"), api.get<Contractor[]>("/contractors")])
      .then(([v, c]) => {
        setVendors(v);
        setContractors(c);
      })
      .catch(() => setError("Unable to load vendors"))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  const aadhaarVerified = vendors.filter((v) => v.aadhaarStatus === "VERIFIED").length;
  const activeVendors = vendors.filter((v) => v.status === "ACTIVE").length;

  return (
    <div>
      <div className={styles.statGrid}>
        <StatCard label="Total Vendors" value={vendors.length} />
        <StatCard label="Active" value={activeVendors} />
        <StatCard label="Aadhaar Verified" value={aadhaarVerified} />
      </div>

      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Vendor Master Listing</h2>
        <button
          className={styles.addBtn}
          onClick={() => setIsFormOpen(true)}
          disabled={contractors.length === 0}
        >
          + Onboard New Vendor
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}
      {!isLoading && contractors.length === 0 && (
        <p className={styles.hint}>Add a contractor first before onboarding vendors.</p>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Vendor ID</th>
              <th>Vendor Name</th>
              <th>Contractor</th>
              <th>Unit</th>
              <th>Aadhaar Status</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  No vendors yet.
                </td>
              </tr>
            ) : (
              vendors.map((v) => (
                <tr key={v.id}>
                  <td>{v.vendorCode}</td>
                  <td className={styles.strong}>{v.fullName}</td>
                  <td>{v.contractor.name}</td>
                  <td>{v.unitStation}</td>
                  <td>
                    <span
                      className={
                        v.aadhaarStatus === "VERIFIED" ? styles.statusGood : styles.statusWarn
                      }
                    >
                      {v.aadhaarStatus === "VERIFIED" ? "Verified" : "Pending"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        v.status === "ACTIVE"
                          ? styles.statusGood
                          : v.status === "EXPIRED"
                          ? styles.statusBad
                          : styles.statusWarn
                      }
                    >
                      {v.status.charAt(0) + v.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <AddVendorModal
          contractors={contractors}
          onClose={() => setIsFormOpen(false)}
          onCreated={() => {
            setIsFormOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddVendorModal({
  contractors,
  onClose,
  onCreated,
}: {
  contractors: Contractor[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [vendorCode, setVendorCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [contractorId, setContractorId] = useState(contractors[0]?.id ?? "");
  const [division, setDivision] = useState<Division>(contractors[0]?.division ?? "ADRA");
  const [unitStation, setUnitStation] = useState("");
  const [vendorType, setVendorType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/vendors", {
        vendorCode,
        fullName,
        contractorId,
        division,
        unitStation,
        vendorType,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create vendor");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>Onboard New Vendor</h2>
        <div className={styles.formGrid}>
          <Field label="Vendor Code">
            <input value={vendorCode} onChange={(e) => setVendorCode(e.target.value)} required />
          </Field>
          <Field label="Full Name (as per Aadhaar)">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Field>
          <Field label="Contractor / Agency">
            <select
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value)}
            >
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Division">
            <select value={division} onChange={(e) => setDivision(e.target.value as Division)}>
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>
                  {DIVISION_LABELS[d]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Unit / Station">
            <input value={unitStation} onChange={(e) => setUnitStation(e.target.value)} required />
          </Field>
          <Field label="Vendor Type">
            <input
              value={vendorType}
              onChange={(e) => setVendorType(e.target.value)}
              placeholder="e.g. Catering, Stationary Vendor"
              required
            />
          </Field>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit Registration"}
          </button>
        </div>
      </form>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
