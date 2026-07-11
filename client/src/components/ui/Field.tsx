import type { ReactNode } from "react";
import styles from "../../styles/listPage.module.css";

export default function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={wide ? `${styles.field} ${styles.fieldWide}` : styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
