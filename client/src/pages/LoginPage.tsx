import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to sign in");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.brandBlock}>
        <div className={styles.logo}>
          <TrainIcon />
        </div>
        <h1 className={styles.brandName}>SERVMS</h1>
        <p className={styles.brandSubtitle}>South Eastern Railway</p>
        <span className={styles.intranetBadge}>
          <LockIcon /> Internal Intranet Access Only
        </span>
      </div>

      <form className={styles.card} onSubmit={handleSubmit}>
        <h2 className={styles.cardTitle}>Secure Sign In</h2>
        <p className={styles.cardSubtitle}>
          Access the Vendor Management System dashboard
        </p>

        <label className={styles.label} htmlFor="username">
          Employee ID / Username
        </label>
        <div className={styles.inputWrap}>
          <UserIcon />
          <input
            id="username"
            className={styles.input}
            placeholder="Enter your credentials"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <div className={styles.passwordRow}>
          <label className={styles.label} htmlFor="password">
            Password
          </label>
          <a className={styles.forgotLink} href="#forgot">
            Forgot Password?
          </a>
        </div>
        <div className={styles.inputWrap}>
          <LockIcon />
          <input
            id="password"
            className={styles.input}
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className={styles.showPasswordBtn}
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <EyeIcon crossed={showPassword} />
          </button>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <button className={styles.submitBtn} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Secure Login →"}
        </button>

        <div className={styles.trustRow}>
          <span>
            <ShieldIcon /> 256-bit SSL Secure
          </span>
          <span>
            <BadgeIcon /> IT Policy Compliant
          </span>
        </div>
      </form>

      <p className={styles.disclaimer}>
        Unauthorized access to this system is strictly prohibited. All
        activities are monitored and logged for security purposes.
      </p>
      <p className={styles.copyright}>
        © 2026 Centre for Railway Information Systems (CRIS)
      </p>
    </div>
  );
}

function TrainIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="13" rx="4" stroke="white" strokeWidth="1.6" />
      <path d="M4 11h16" stroke="white" strokeWidth="1.6" />
      <path d="M8 20l2-3M16 20l-2-3" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8.5" cy="13.5" r="1" fill="white" />
      <circle cx="15.5" cy="13.5" r="1" fill="white" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      {crossed && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6" />}
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function BadgeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="9" r="5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 14l-2 7 6-3 6 3-2-7" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
