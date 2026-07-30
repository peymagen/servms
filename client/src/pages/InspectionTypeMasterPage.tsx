import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGetInspectionCategoriesQuery,
  useGetInspectionTypesQuery,
  useCreateInspectionCategoryMutation,
  useCreateInspectionTypeMutation,
  useEditInspectionTypeOptionMutation,
  useDeleteInspectionTypeOptionMutation,
  useActivateInspectionTypeOptionMutation,
} from "../api/inspectionApi";
import type { DropdownOption } from "../types";
import styles from "../styles/listPage.module.css";

function slugify(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export default function InspectionTypeMasterPage() {
  const navigate = useNavigate();
  const { data: categories = [] } = useGetInspectionCategoriesQuery({ includeInactive: true });
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(categories[0]?.id ?? null);
  const { data: types = [] } = useGetInspectionTypesQuery(
    { categoryId: selectedCategoryId ?? 0, includeInactive: true },
    { skip: !selectedCategoryId }
  );

  const [createCategory] = useCreateInspectionCategoryMutation();
  const [createType] = useCreateInspectionTypeMutation();
  const [editOption] = useEditInspectionTypeOptionMutation();
  const [deleteOption] = useDeleteInspectionTypeOptionMutation();
  const [activateOption] = useActivateInspectionTypeOptionMutation();

  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeCategory = selectedCategoryId ?? categories[0]?.id ?? null;
  if (activeCategory !== selectedCategoryId && activeCategory) setSelectedCategoryId(activeCategory);

  async function handleAddCategory() {
    setError(null);
    if (!newCategoryLabel.trim()) return;
    try {
      await createCategory({ value: slugify(newCategoryLabel), label: newCategoryLabel.trim() }).unwrap();
      setNewCategoryLabel("");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to create Inspection Category");
    }
  }

  async function handleAddType() {
    setError(null);
    if (!newTypeLabel.trim() || !selectedCategoryId) return;
    try {
      await createType({ parent_id: selectedCategoryId, value: slugify(newTypeLabel), label: newTypeLabel.trim() }).unwrap();
      setNewTypeLabel("");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to create Inspection Type");
    }
  }

  async function toggleActive(option: DropdownOption, isType: boolean, parentId?: number) {
    setError(null);
    try {
      if (option.status === 0) {
        await activateOption({ id: option.id, isType, parentId }).unwrap();
      } else {
        await deleteOption({ id: option.id, isType, parentId }).unwrap();
      }
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to update status");
    }
  }

  async function renameOption(option: DropdownOption, isType: boolean, parentId?: number) {
    const label = window.prompt("New label", option.label);
    if (!label || label === option.label) return;
    setError(null);
    try {
      await editOption({ id: option.id, isType, parentId, label }).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to rename");
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Inspection Category / Type Master</h1>
          <p className={styles.subtitle}>Manage the dropdown values used when filing inspections.</p>
        </div>
        <button className={styles.cancelBtn} onClick={() => navigate("/inspections")}>
          ← Back to Inspections
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: 18 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12 }}>Inspection Categories</h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input className={styles.searchInput} style={{ marginBottom: 0 }} placeholder="New Inspection Category" value={newCategoryLabel} onChange={(e) => setNewCategoryLabel(e.target.value)} />
            <button className={styles.addBtn} onClick={handleAddCategory}>+ Add</button>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {categories.map((c) => (
              <li
                key={c.id}
                onClick={() => setSelectedCategoryId(c.id)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                  background: selectedCategoryId === c.id ? "var(--color-info-bg)" : "transparent",
                  opacity: c.status === 0 ? 0.5 : 1, marginBottom: 4,
                }}
              >
                <span>{c.label}</span>
                <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  <button className={styles.pageBtn} onClick={() => renameOption(c, false)}>✎</button>
                  <button className={styles.pageBtn} onClick={() => toggleActive(c, false)}>
                    {c.status === 0 ? "Activate" : "Deactivate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: 18 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12 }}>
            Types {selectedCategoryId ? `— ${categories.find((c) => c.id === selectedCategoryId)?.label ?? ""}` : ""}
          </h2>
          {!selectedCategoryId ? (
            <span className={styles.hint}>Select an Inspection Category first.</span>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input className={styles.searchInput} style={{ marginBottom: 0 }} placeholder="New Inspection Type" value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} />
                <button className={styles.addBtn} onClick={handleAddType}>+ Add</button>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {types.map((t) => (
                  <li
                    key={t.id}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 10px", borderRadius: 8, opacity: t.status === 0 ? 0.5 : 1, marginBottom: 4,
                    }}
                  >
                    <span>{t.label}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className={styles.pageBtn} onClick={() => renameOption(t, true, selectedCategoryId)}>✎</button>
                      <button className={styles.pageBtn} onClick={() => toggleActive(t, true, selectedCategoryId)}>
                        {t.status === 0 ? "Activate" : "Deactivate"}
                      </button>
                    </div>
                  </li>
                ))}
                {types.length === 0 && <span className={styles.hint}>No types yet.</span>}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
