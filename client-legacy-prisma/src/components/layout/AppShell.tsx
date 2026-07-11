import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { DIVISION_LABELS, ROLE_LABELS } from "../../types";
import styles from "./AppShell.module.css";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: Array<"SUPER_ADMIN" | "ADMIN" | "DIVISION_ADDITIONAL_ADMIN">;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: <IconGrid /> },
  { to: "/users", label: "User Management", icon: <IconUsers /> },
  { to: "/locations", label: "Location Masters", icon: <IconPin /> },
  { to: "/vendors", label: "Vendor Management", icon: <IconBriefcase /> },
  { to: "/id-cards", label: "ID Card / QR", icon: <IconIdCard /> },
  { to: "/complaints", label: "Complaints", icon: <IconAlert /> },
  { to: "/penalties", label: "Penalties", icon: <IconPenalty /> },
  { to: "/reports", label: "Reports", icon: <IconReport /> },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarLogo}>
            <IconTrain />
          </div>
          <div>
            <div className={styles.sidebarTitle}>SERVMS Admin</div>
            <div className={styles.sidebarSubtitle}>South Eastern Railway</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button className={styles.logoutBtn} onClick={logout}>
          <IconLogout /> Logout
        </button>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <input className={styles.search} placeholder="Search across SERVMS…" />
          <div className={styles.userBadge}>
            <div className={styles.avatar}>{user.fullName.charAt(0)}</div>
            <div>
              <div className={styles.userName}>{user.fullName}</div>
              <div className={styles.userRole}>
                {ROLE_LABELS[user.role]}
                {user.division ? ` · ${DIVISION_LABELS[user.division]}` : ""}
              </div>
            </div>
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

function IconTrain() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="13" rx="4" stroke="white" strokeWidth="1.6" />
      <path d="M4 11h16" stroke="white" strokeWidth="1.6" />
      <path d="M8 20l2-3M16 20l-2-3" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 8.5a3 3 0 1 1 0-6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15 14.2c2.9.4 5 2.6 5 5.8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M21 12H9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconIdCard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 16c.5-1.6 1.8-2.4 3-2.4s2.5.8 3 2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 10h4M14 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v18M8 6h6.5a2.5 2.5 0 0 1 0 5H8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 13h7a2.5 2.5 0 0 1 0 5H8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconReport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 12h6M9 16h6M9 9h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
