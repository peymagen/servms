import styles from "../styles/listPage.module.css";

export default function SettingsPage() {
  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Manage your SERVMS account and system preferences.</p>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <div style={{ padding: 24, color: "var(--color-text-muted)", fontSize: 13.5 }}>
          Account and system configuration options will appear here.
        </div>
      </div>
    </div>
  );
}
