import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useGetReportModulesQuery,
  useGenerateReportMutation,
  useCreateReportTemplateMutation,
  useGetReportTemplateByIdQuery,
  exportGeneratedReport,
  type GenerateReportBody,
} from "../api/reportApi";
import type { ReportFieldMeta, ReportFilter, ReportFilterOperator } from "../types";
import styles from "../styles/listPage.module.css";

const OPERATOR_LABELS: Record<ReportFilterOperator, string> = {
  eq: "Equals",
  neq: "Not Equals",
  like: "Contains",
  gt: "Greater Than",
  gte: "Greater Than or Equal",
  lt: "Less Than",
  lte: "Less Than or Equal",
  between: "Between",
  in: "In (comma-separated)",
};

const OPERATORS_BY_TYPE: Record<ReportFieldMeta["type"], ReportFilterOperator[]> = {
  string: ["eq", "neq", "like", "in"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "in"],
  date: ["eq", "neq", "gt", "gte", "lt", "lte", "between"],
  enum: ["eq", "neq", "in"],
  boolean: ["eq"],
};

interface BuilderFilter extends ReportFilter {
  id: string;
}

export default function ReportBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("template");

  const { data: modules = [] } = useGetReportModulesQuery();
  const { data: template } = useGetReportTemplateByIdQuery(Number(templateId), { skip: !templateId });
  const [generateReport, { isLoading: generating }] = useGenerateReportMutation();
  const [createTemplate, { isLoading: saving }] = useCreateReportTemplateMutation();

  const [moduleKey, setModuleKey] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<BuilderFilter[]>([]);
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [aggregateField, setAggregateField] = useState("");

  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [grouped, setGrouped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showSave, setShowSave] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [isShared, setIsShared] = useState(false);

  const activeModule = useMemo(() => modules.find((m) => m.key === moduleKey), [modules, moduleKey]);

  useEffect(() => {
    if (!template) return;
    setModuleKey(template.module_key);
    try {
      setSelectedFields(JSON.parse(template.fields ?? "[]"));
      const parsedFilters: ReportFilter[] = JSON.parse(template.filters ?? "[]");
      setFilters(parsedFilters.map((f, i) => ({ ...f, id: `${i}` })));
      const parsedSort = template.sort ? JSON.parse(template.sort) : null;
      if (parsedSort) {
        setSortField(parsedSort.field);
        setSortDirection(parsedSort.direction);
      }
      setGroupBy(JSON.parse(template.group_by ?? "[]"));
    } catch {
      // malformed saved JSON — start from a blank builder rather than crash
    }
  }, [template]);

  function handleModuleChange(key: string) {
    setModuleKey(key);
    setSelectedFields([]);
    setFilters([]);
    setSortField("");
    setGroupBy([]);
    setAggregateField("");
    setPreviewRows([]);
  }

  function toggleField(key: string) {
    setSelectedFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleGroupBy(key: string) {
    setGroupBy((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function addFilter() {
    if (!activeModule) return;
    const firstFilterable = activeModule.fields.find((f) => f.filterable);
    if (!firstFilterable) return;
    setFilters((prev) => [
      ...prev,
      { id: `${Date.now()}`, field: firstFilterable.key, operator: OPERATORS_BY_TYPE[firstFilterable.type][0]!, value: "" },
    ]);
  }

  function updateFilter(id: string, patch: Partial<BuilderFilter>) {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeFilter(id: string) {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  }

  function buildRequestBody(): GenerateReportBody {
    return {
      module_key: moduleKey,
      fields: selectedFields,
      filters: filters.map(({ id, ...rest }) => {
        if (rest.operator === "in") {
          return { ...rest, value: String(rest.value ?? "").split(",").map((v) => v.trim()).filter(Boolean) };
        }
        return rest;
      }),
      sort: sortField ? { field: sortField, direction: sortDirection } : undefined,
      group_by: groupBy.length ? groupBy : undefined,
      aggregate_field: aggregateField || undefined,
    };
  }

  async function handlePreview() {
    setError(null);
    if (!moduleKey || (groupBy.length === 0 && selectedFields.length === 0)) {
      setError("Select a module and at least one field (or a Group By column)");
      return;
    }
    try {
      const result = await generateReport({ ...buildRequestBody(), limit: 20 }).unwrap();
      setPreviewRows(result.rows);
      setPreviewTotal(result.total);
      setGrouped(result.grouped);
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to generate report preview");
    }
  }

  async function handleExport(format: "xlsx" | "csv") {
    setError(null);
    try {
      await exportGeneratedReport({ ...buildRequestBody(), format, report_template_id: template?.id });
    } catch (err: any) {
      setError(err?.message ?? "Unable to export report");
    }
  }

  async function handleSaveTemplate() {
    setError(null);
    if (!templateName.trim()) {
      setError("Report name is required");
      return;
    }
    try {
      await createTemplate({
        name: templateName,
        description: templateDescription || undefined,
        module_key: moduleKey,
        fields: selectedFields,
        filters: filters.map(({ id, ...rest }) => rest),
        sort: sortField ? { field: sortField, direction: sortDirection } : undefined,
        group_by: groupBy.length ? groupBy : undefined,
        aggregate_field: aggregateField || undefined,
        is_shared: isShared,
      }).unwrap();
      setShowSave(false);
      navigate("/reports/saved");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to save report template");
    }
  }

  const previewColumns = grouped
    ? [...groupBy, "count", ...(aggregateField ? ["aggregate_sum"] : [])]
    : selectedFields;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Report Builder</h1>
          <p className={styles.subtitle}>Build a custom report from any module — select fields, filter, sort, group, and preview.</p>
        </div>
        <button className={styles.cancelBtn} onClick={() => navigate("/reports")}>
          ← Back to Reports
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
        <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: 18 }}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Data Source (Module)</span>
            <select value={moduleKey} onChange={(e) => handleModuleChange(e.target.value)}>
              <option value="">Select Module</option>
              {modules.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {activeModule && (
            <>
              <div className={styles.fieldLabel} style={{ marginTop: 14, marginBottom: 6 }}>
                Fields
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {activeModule.fields.map((field) => (
                  <label key={field.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                    <input type="checkbox" checked={selectedFields.includes(field.key)} onChange={() => toggleField(field.key)} />
                    {field.label}
                  </label>
                ))}
              </div>

              <div className={styles.fieldLabel} style={{ marginTop: 14, marginBottom: 6 }}>
                Group By (optional)
              </div>
              <div style={{ maxHeight: 150, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {activeModule.fields.filter((f) => f.groupable).map((field) => (
                  <label key={field.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                    <input type="checkbox" checked={groupBy.includes(field.key)} onChange={() => toggleGroupBy(field.key)} />
                    {field.label}
                  </label>
                ))}
              </div>
              {groupBy.length > 0 && (
                <div className={styles.field} style={{ marginTop: 8 }}>
                  <span className={styles.fieldLabel}>Sum Field (optional)</span>
                  <select value={aggregateField} onChange={(e) => setAggregateField(e.target.value)}>
                    <option value="">— None —</option>
                    {activeModule.fields.filter((f) => f.type === "number").map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.fieldLabel} style={{ marginTop: 14, marginBottom: 6 }}>
                Sort
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={sortField} onChange={(e) => setSortField(e.target.value)} style={{ flex: 1 }}>
                  <option value="">— None —</option>
                  {activeModule.fields.filter((f) => f.sortable).map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value as "asc" | "desc")}>
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div>
          {activeModule && (
            <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: 18, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h2 style={{ fontSize: 14, margin: 0 }}>Filters</h2>
                <button className={styles.pageBtn} onClick={addFilter}>
                  + Add Filter
                </button>
              </div>
              {filters.length === 0 ? (
                <span className={styles.hint}>No filters applied — reporting on all records.</span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filters.map((filterRow) => {
                    const fieldMeta = activeModule.fields.find((f) => f.key === filterRow.field);
                    const ops = fieldMeta ? OPERATORS_BY_TYPE[fieldMeta.type] : [];
                    return (
                      <div key={filterRow.id} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <select value={filterRow.field} onChange={(e) => updateFilter(filterRow.id, { field: e.target.value, operator: "eq", value: "" })}>
                          {activeModule.fields.filter((f) => f.filterable).map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                        <select value={filterRow.operator} onChange={(e) => updateFilter(filterRow.id, { operator: e.target.value as ReportFilterOperator })}>
                          {ops.map((op) => (
                            <option key={op} value={op}>
                              {OPERATOR_LABELS[op]}
                            </option>
                          ))}
                        </select>
                        {fieldMeta?.type === "enum" && fieldMeta.enumValues ? (
                          <select value={String(filterRow.value ?? "")} onChange={(e) => updateFilter(filterRow.id, { value: e.target.value })}>
                            <option value="">Select…</option>
                            {fieldMeta.enumValues.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={fieldMeta?.type === "date" ? "date" : fieldMeta?.type === "number" ? "number" : "text"}
                            value={String(filterRow.value ?? "")}
                            onChange={(e) => updateFilter(filterRow.id, { value: e.target.value })}
                            style={{ minWidth: 120 }}
                          />
                        )}
                        {filterRow.operator === "between" && (
                          <input
                            type={fieldMeta?.type === "date" ? "date" : "number"}
                            placeholder="and…"
                            value={String(filterRow.value2 ?? "")}
                            onChange={(e) => updateFilter(filterRow.id, { value2: e.target.value })}
                            style={{ minWidth: 120 }}
                          />
                        )}
                        <button className={styles.pageBtn} onClick={() => removeFilter(filterRow.id)}>
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className={styles.modalActions} style={{ padding: 0, marginTop: 16 }}>
                <button className={styles.cancelBtn} onClick={handlePreview} disabled={generating}>
                  {generating ? "Loading…" : "Preview"}
                </button>
                <button className={styles.cancelBtn} onClick={() => handleExport("csv")}>
                  ⬇ CSV
                </button>
                <button className={styles.cancelBtn} onClick={() => handleExport("xlsx")}>
                  ⬇ Excel
                </button>
                <button className={styles.addBtn} onClick={() => setShowSave(true)}>
                  💾 Save Report
                </button>
              </div>
            </div>
          )}

          {previewRows.length > 0 && (
            <div className={styles.tableWrap}>
              <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-text-muted)" }}>
                Showing {previewRows.length} of {previewTotal} row(s){grouped ? " (grouped summary)" : ""}
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {previewColumns.map((col) => (
                      <th key={col}>{activeModule?.fields.find((f) => f.key === col)?.label ?? col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i}>
                      {previewColumns.map((col) => (
                        <td key={col}>{String((row as any)[col] ?? "—")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showSave && (
        <div className={styles.modalOverlay} onClick={() => setShowSave(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Save Report Template</h2>
            <div className={styles.formGrid}>
              <div className={styles.fieldWide}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Report Name</span>
                  <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                </div>
              </div>
              <div className={styles.fieldWide}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Description</span>
                  <textarea value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
                Share with all users who have Reports access
              </label>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowSave(false)}>
                Cancel
              </button>
              <button className={styles.addBtn} onClick={handleSaveTemplate} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
