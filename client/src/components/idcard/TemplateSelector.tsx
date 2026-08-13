import type { CardTemplate } from "../../types";
import type { IdCardTemplateConfig } from "../../config/idCardTemplates";
import styles from "./TemplateSelector.module.css";

interface TemplateSelectorProps {
  templates: IdCardTemplateConfig[];
  selectedId: CardTemplate;
  onSelect: (id: CardTemplate) => void;
}

export default function TemplateSelector({ templates, selectedId, onSelect }: TemplateSelectorProps) {
  return (
    <div className={styles.grid} role="radiogroup" aria-label="ID card format">
      {templates.map((tpl) => {
        const isSelected = tpl.id === selectedId;
        return (
          <div key={tpl.id} className={isSelected ? styles.cardSelected : styles.card}>
            <label className={styles.radioRow}>
              <input
                type="radio"
                name="id-card-template"
                checked={isSelected}
                onChange={() => onSelect(tpl.id)}
              />
              <span className={styles.name}>{tpl.name}</span>
              {isSelected && <span className={styles.checkmark}>✓ Selected</span>}
            </label>

            <TemplatePreview template={tpl} />

            <p className={styles.description}>{tpl.description}</p>

            <button
              type="button"
              className={isSelected ? styles.selectBtnActive : styles.selectBtn}
              onClick={() => onSelect(tpl.id)}
              aria-pressed={isSelected}
            >
              {isSelected ? "Selected" : "Select Template"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// A lightweight, stylized mock of the front face — not a pixel-accurate render of the
// PDF (that only exists server-side) — just enough to tell formats apart at a glance.
function TemplatePreview({ template }: { template: IdCardTemplateConfig }) {
  return (
    <div className={styles.previewCard}>
      {template.hasSideStrip && <div className={styles.previewStrip}>ON CONTRACT</div>}
      <div className={styles.previewBody}>
        <div className={styles.previewHeaderTitle}>{template.headerTitle}</div>
        <div className={styles.previewHeaderSubtitle}>{template.headerSubtitle}</div>
        <div className={styles.previewPhoto} />
        <div className={styles.previewName}>Name: XXXXX</div>
      </div>
    </div>
  );
}
