import { useState, type ReactNode } from "react";
import { useGetNotificationsQuery, type ModuleFilter } from "../api/notificationApi";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getReadIds,
  loadNotificationPreferences,
  markNotificationsRead,
  saveNotificationPreferences,
  type ChannelPrefs,
  type NotificationPreferences,
} from "../utils/notificationPrefs";
import styles from "./NotificationsPage.module.css";

type NotificationSeverity = "critical" | "warning" | "info";

const MODULES: { key: ModuleFilter; label: string; icon: ReactNode }[] = [
  { key: "all", label: "All Notifications", icon: <IconLayers /> },
  { key: "user_management", label: "User Management", icon: <IconUsers /> },
  { key: "vendor_master", label: "Vendor Master", icon: <IconBriefcase /> },
  { key: "complaints", label: "Complaints", icon: <IconAlert /> },
  { key: "penalties", label: "Penalties", icon: <IconPenalty /> },
  { key: "inspections", label: "Inspections", icon: <IconClipboard /> },
];

const BADGE_LABEL: Record<NotificationSeverity, string> = {
  critical: "CRITICAL ALERT",
  warning: "WARNING",
  info: "INFORMATION",
};

const PAGE_SIZE = 6;

export default function NotificationsPage() {
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadIds());

  const { data, error: loadError, isFetching: isLoading } = useGetNotificationsQuery({ module: moduleFilter, limit });
  const error = loadError ? "Unable to load notifications" : null;

  const [prefs, setPrefs] = useState<NotificationPreferences>(() => loadNotificationPreferences());
  const [draft, setDraft] = useState({
    vendorCompliance: prefs.vendorCompliance,
    staffRoles: prefs.staffRoles,
    financialAudits: prefs.financialAudits,
    digest: prefs.digest,
  });
  const [savedNote, setSavedNote] = useState(false);

  function selectModule(key: ModuleFilter) {
    setModuleFilter(key);
    setLimit(PAGE_SIZE);
  }

  function handleMarkAllRead() {
    if (!data) return;
    markNotificationsRead(data.rows.map((r) => r.id));
    setReadIds(getReadIds());
  }

  function handleOpenNotification(id: string) {
    markNotificationsRead([id]);
    setReadIds(getReadIds());
  }

  function updateQuickPref<K extends "emailAlerts" | "smsAlerts" | "pushNotifications">(key: K, value: boolean) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      saveNotificationPreferences(next);
      return next;
    });
  }

  function updateDraftChannel(
    section: "vendorCompliance" | "staffRoles" | "financialAudits",
    channel: keyof ChannelPrefs,
    value: boolean
  ) {
    setDraft((prev) => ({ ...prev, [section]: { ...prev[section], [channel]: value } }));
  }

  function handleSaveChanges() {
    setPrefs((prev) => {
      const next = { ...prev, ...draft };
      saveNotificationPreferences(next);
      return next;
    });
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 2000);
  }

  function handleRestoreDefaults() {
    const defaults = {
      vendorCompliance: DEFAULT_NOTIFICATION_PREFERENCES.vendorCompliance,
      staffRoles: DEFAULT_NOTIFICATION_PREFERENCES.staffRoles,
      financialAudits: DEFAULT_NOTIFICATION_PREFERENCES.financialAudits,
      digest: DEFAULT_NOTIFICATION_PREFERENCES.digest,
    };
    setDraft(defaults);
    setPrefs((prev) => {
      const next = { ...prev, ...defaults };
      saveNotificationPreferences(next);
      return next;
    });
  }

  const unreadVisible = data ? data.rows.some((r) => !readIds.has(r.id)) : false;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Notification Center</h1>
          <p className={styles.subtitle}>Manage administrative alerts, system warnings, and module-specific updates.</p>
        </div>
        <button
          type="button"
          className={styles.markReadBtn}
          onClick={handleMarkAllRead}
          disabled={!unreadVisible}
        >
          Mark all as read
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Modules</h2>
            <div className={styles.moduleList}>
              {MODULES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={moduleFilter === m.key ? styles.moduleItemActive : styles.moduleItem}
                  onClick={() => selectModule(m.key)}
                >
                  {m.icon}
                  <span className={styles.moduleLabel}>{m.label}</span>
                  <span className={styles.moduleCount}>{data ? data.counts[m.key] : "—"}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Preferences</h2>
            <ToggleRow
              label="Email Alerts"
              checked={prefs.emailAlerts}
              onChange={(v) => updateQuickPref("emailAlerts", v)}
            />
            <ToggleRow
              label="SMS Alerts"
              checked={prefs.smsAlerts}
              onChange={(v) => updateQuickPref("smsAlerts", v)}
            />
            <ToggleRow
              label="Push Notifications"
              checked={prefs.pushNotifications}
              onChange={(v) => updateQuickPref("pushNotifications", v)}
            />
          </section>
        </div>

        <div>
          {isLoading && !data ? (
            <p className={styles.emptyState}>Loading notifications…</p>
          ) : data && data.rows.length > 0 ? (
            <>
              <div className={styles.notificationList}>
                {data.rows.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.notificationCard} ${
                      !readIds.has(item.id) ? styles.notificationUnread : ""
                    }`}
                    onClick={() => handleOpenNotification(item.id)}
                  >
                    <span
                      className={`${styles.notifIcon} ${
                        item.severity === "critical"
                          ? styles.notifIconCritical
                          : item.severity === "warning"
                          ? styles.notifIconWarning
                          : styles.notifIconInfo
                      }`}
                    >
                      {item.severity === "critical" ? (
                        <IconTriangle />
                      ) : item.severity === "warning" ? (
                        <IconClock />
                      ) : (
                        <IconInfo />
                      )}
                    </span>
                    <span className={styles.notifBody}>
                      <span className={styles.notifTop}>
                        <span className={styles.notificationTitle}>{item.title}</span>
                        <span
                          className={`${styles.badge} ${
                            item.severity === "critical"
                              ? styles.badgeCritical
                              : item.severity === "warning"
                              ? styles.badgeWarning
                              : styles.badgeInfo
                          }`}
                        >
                          {BADGE_LABEL[item.severity]}
                        </span>
                      </span>
                      <span className={styles.notifDesc}>{item.description}</span>
                      <span className={styles.notifMeta}>
                        <span className={styles.metaItem}>
                          <IconClockSmall /> {item.time}
                        </span>
                        <span className={styles.metaItem}>
                          <IconTagSmall /> {item.moduleLabel}
                        </span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {data.hasMore && (
                <div className={styles.loadMoreRow}>
                  <button
                    type="button"
                    className={styles.loadMoreBtn}
                    onClick={() => setLimit((l) => l + PAGE_SIZE)}
                    disabled={isLoading}
                  >
                    Load Previous Notifications
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className={styles.emptyState}>No notifications in this category.</p>
          )}
        </div>
      </div>

      <section className={styles.settingsPanel}>
        <h2 className={styles.settingsTitle}>Detailed Notification Settings</h2>
        <div className={styles.settingsGrid}>
          <ChannelGroup
            title="Vendor Compliance"
            hint="License expiries, document rejections, and health code violations."
            value={draft.vendorCompliance}
            onChange={(channel, value) => updateDraftChannel("vendorCompliance", channel, value)}
          />
          <ChannelGroup
            title="Staff & Roles"
            hint="New user registration and permission changes."
            value={draft.staffRoles}
            onChange={(channel, value) => updateDraftChannel("staffRoles", channel, value)}
          />
          <ChannelGroup
            title="Financial Audits"
            hint="Payment confirmations and penalty recovery updates."
            value={draft.financialAudits}
            onChange={(channel, value) => updateDraftChannel("financialAudits", channel, value)}
          />
          <div className={styles.digestGroup}>
            <div className={styles.settingsGroupTitle}>Digest Preference</div>
            <select
              className={styles.digestSelect}
              value={draft.digest}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, digest: e.target.value as NotificationPreferences["digest"] }))
              }
            >
              <option value="instant">Instant Alerts (Recommended)</option>
              <option value="daily">Daily Digest</option>
              <option value="weekly">Weekly Digest</option>
            </select>
          </div>
        </div>

        <div className={styles.settingsActions}>
          <button type="button" className={styles.saveBtn} onClick={handleSaveChanges}>
            Save Changes
          </button>
          <button type="button" className={styles.restoreBtn} onClick={handleRestoreDefaults}>
            Restore Defaults
          </button>
          {savedNote && <span className={styles.savedNote}>Preferences saved</span>}
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={styles.toggleRow}>
      <span>{label}</span>
      <label className={styles.switch}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={styles.switchTrack} />
      </label>
    </div>
  );
}

function ChannelGroup({
  title,
  hint,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  value: ChannelPrefs;
  onChange: (channel: keyof ChannelPrefs, value: boolean) => void;
}) {
  return (
    <div className={styles.settingsGroup}>
      <div className={styles.settingsGroupTitle}>{title}</div>
      <p className={styles.settingsGroupHint}>{hint}</p>
      <div className={styles.checkRow}>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={value.email}
            onChange={(e) => onChange("email", e.target.checked)}
          />
          Email
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={value.inApp}
            onChange={(e) => onChange("inApp", e.target.checked)}
          />
          In-App
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={value.sms}
            onChange={(e) => onChange("sms", e.target.checked)}
          />
          SMS
        </label>
      </div>
    </div>
  );
}

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l9 5-9 5-9-5 9-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 8.5a3 3 0 1 1 0-6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15 14.2c2.9.4 5 2.6 5 5.8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M10.3 4.3a2 2 0 0 1 3.4 0l7.4 12.8A2 2 0 0 1 19.4 20H4.6a2 2 0 0 1-1.7-3l7.4-12.7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M12 9.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="16.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

function IconPenalty() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v18M8 6h6.5a2.5 2.5 0 0 1 0 5H8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 13h7a2.5 2.5 0 0 1 0 5H8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 11h7M8.5 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconTriangle() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M10.3 4.3a2 2 0 0 1 3.4 0l7.4 12.8A2 2 0 0 1 19.4 20H4.6a2 2 0 0 1-1.7-3l7.4-12.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M12 9.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.2" r="1" fill="currentColor" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}

function IconClockSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTagSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M12.6 3.6 20 11l-8.4 8.4a2 2 0 0 1-2.8 0L4 14.6V6a2.4 2.4 0 0 1 2.4-2.4H12.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
    </svg>
  );
}
