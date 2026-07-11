import styles from "../styles/listPage.module.css";

export default function HelpCenterPage() {
  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Help Center</h1>
          <p className={styles.subtitle}>
            Guidance, SOPs, and support contacts for the SERVMS platform.
          </p>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <div style={{ padding: 24, color: "var(--color-text-muted)", fontSize: 13.5 }}>
          For assistance, contact your division administrator or the CRIS support desk.
        </div>
      </div>
    </div>
  );
}
