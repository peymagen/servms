const READ_KEY = "servms_notifications_read";
const PREF_KEY = "servms_notification_prefs";

export function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markNotificationsRead(ids: string[]) {
  const current = getReadIds();
  ids.forEach((id) => current.add(id));
  localStorage.setItem(READ_KEY, JSON.stringify([...current]));
}

export interface ChannelPrefs {
  email: boolean;
  inApp: boolean;
  sms: boolean;
}

export interface NotificationPreferences {
  emailAlerts: boolean;
  smsAlerts: boolean;
  pushNotifications: boolean;
  vendorCompliance: ChannelPrefs;
  staffRoles: ChannelPrefs;
  financialAudits: ChannelPrefs;
  digest: "instant" | "daily" | "weekly";
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailAlerts: true,
  smsAlerts: false,
  pushNotifications: true,
  vendorCompliance: { email: true, inApp: true, sms: false },
  staffRoles: { email: true, inApp: false, sms: false },
  financialAudits: { email: true, inApp: true, sms: true },
  digest: "instant",
};

export function loadNotificationPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(JSON.parse(raw) as Partial<NotificationPreferences>) };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export function saveNotificationPreferences(prefs: NotificationPreferences) {
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}
