import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGetComplaintTypesQuery,
  useGetComplaintSubtypesQuery,
  useCreateComplaintTypeMutation,
  useCreateComplaintSubtypeMutation,
  useEditComplaintTypeOptionMutation,
  useDeleteComplaintTypeOptionMutation,
  useActivateComplaintTypeOptionMutation,
} from "../api/complaintApi";
import type { DropdownOption } from "../types";
import styles from "../styles/listPage.module.css";

function slugify(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export default function ComplaintTypeMasterPage() {
  const navigate = useNavigate();
  const { data: types = [] } = useGetComplaintTypesQuery({ includeInactive: true });
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(types[0]?.id ?? null);
  const { data: subtypes = [] } = useGetComplaintSubtypesQuery(
    { typeId: selectedTypeId ?? 0, includeInactive: true },
    { skip: !selectedTypeId }
  );

  const [createType] = useCreateComplaintTypeMutation();
  const [createSubtype] = useCreateComplaintSubtypeMutation();
  const [editOption] = useEditComplaintTypeOptionMutation();
  const [deleteOption] = useDeleteComplaintTypeOptionMutation();
  const [activateOption] = useActivateComplaintTypeOptionMutation();

  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [newSubtypeLabel, setNewSubtypeLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeType = selectedTypeId ?? types[0]?.id ?? null;
  if (activeType !== selectedTypeId && activeType) setSelectedTypeId(activeType);

  async function handleAddType() {
    setError(null);
    if (!newTypeLabel.trim()) return;
    try {
      await createType({ value: slugify(newTypeLabel), label: newTypeLabel.trim() }).unwrap();
      setNewTypeLabel("");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to create Complaint Type");
    }
  }

  async function handleAddSubtype() {
    setError(null);
    if (!newSubtypeLabel.trim() || !selectedTypeId) return;
    try {
      await createSubtype({ parent_id: selectedTypeId, value: slugify(newSubtypeLabel), label: newSubtypeLabel.trim() }).unwrap();
      setNewSubtypeLabel("");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to create Complaint Sub-Type");
    }
  }

  async function toggleActive(option: DropdownOption, isSubtype: boolean, parentId?: number) {
    setError(null);
    try {
      if ((option as any).status === 0) {
        await activateOption({ id: option.id, isSubtype, parentId }).unwrap();
      } else {
        await deleteOption({ id: option.id, isSubtype, parentId }).unwrap();
      }
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to update status");
    }
  }

  async function renameOption(option: DropdownOption, isSubtype: boolean, parentId?: number) {
    const label = window.prompt("New label", option.label);
    if (!label || label === option.label) return;
    setError(null);
    try {
      await editOption({ id: option.id, isSubtype, parentId, label }).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to rename");
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Complaint Type / Sub-Type Master</h1>
          <p className={styles.subtitle}>Manage the dropdown values used when registering complaints.</p>
        </div>
        <button className={styles.cancelBtn} onClick={() => navigate("/complaints")}>
          ← Back to Complaints
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: 18 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12 }}>Complaint Types</h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input className={styles.searchInput} style={{ marginBottom: 0 }} placeholder="New Complaint Type" value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} />
            <button className={styles.addBtn} onClick={handleAddType}>+ Add</button>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {types.map((t) => (
              <li
                key={t.id}
                onClick={() => setSelectedTypeId(t.id)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                  background: selectedTypeId === t.id ? "var(--color-info-bg)" : "transparent",
                  opacity: (t as any).status === 0 ? 0.5 : 1, marginBottom: 4,
                }}
              >
                <span>{t.label}</span>
                <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  <button className={styles.pageBtn} onClick={() => renameOption(t, false)}>✎</button>
                  <button className={styles.pageBtn} onClick={() => toggleActive(t, false)}>
                    {(t as any).status === 0 ? "Activate" : "Deactivate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: 18 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12 }}>
            Sub-Types {selectedTypeId ? `— ${types.find((t) => t.id === selectedTypeId)?.label ?? ""}` : ""}
          </h2>
          {!selectedTypeId ? (
            <span className={styles.hint}>Select a Complaint Type first.</span>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input className={styles.searchInput} style={{ marginBottom: 0 }} placeholder="New Sub-Type" value={newSubtypeLabel} onChange={(e) => setNewSubtypeLabel(e.target.value)} />
                <button className={styles.addBtn} onClick={handleAddSubtype}>+ Add</button>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {subtypes.map((s) => (
                  <li
                    key={s.id}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 10px", borderRadius: 8, opacity: (s as any).status === 0 ? 0.5 : 1, marginBottom: 4,
                    }}
                  >
                    <span>{s.label}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className={styles.pageBtn} onClick={() => renameOption(s, true, selectedTypeId)}>✎</button>
                      <button className={styles.pageBtn} onClick={() => toggleActive(s, true, selectedTypeId)}>
                        {(s as any).status === 0 ? "Activate" : "Deactivate"}
                      </button>
                    </div>
                  </li>
                ))}
                {subtypes.length === 0 && <span className={styles.hint}>No sub-types yet.</span>}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
