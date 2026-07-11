# SERVMS — South Eastern Railway Vendor Management System

A role-based vendor/contractor management dashboard for South Eastern Railway.

- **Frontend:** React + TypeScript + CSS Modules (Vite) — no Tailwind
- **Backend:** Node.js + Express + TypeScript (`mysql2`, JWT auth via Passport)
- **Database:** MySQL

```
servms/
  client/   React + TypeScript frontend (Vite)   → http://localhost:5173
  server/   Express + TypeScript API              → http://localhost:4000
```

This guide sets up all three pieces — database, backend, frontend — from a clean machine.

---

## Prerequisites

- **Node.js 18+** and npm (`node -v`, `npm -v`)
- **MySQL 8+** (MySQL 9 also works). On macOS: `brew install mysql && brew services start mysql`
- A terminal and (optionally) a MySQL client such as `mysql` CLI, TablePlus, or MySQL Workbench

This guide assumes a local MySQL server running on `localhost:3306` with the default `root` user and **no password** (Homebrew's default). Adjust the `.env` values in Step 2 if your setup differs.

---

## 1. Set up the database

The full schema (16 tables) plus demo seed data is provided as a single, self-contained, re-runnable SQL script — no ORM migrations or seed scripts required.

```bash
cd server/database
mysql -u root < setup.sql
```

This will:
- Drop and recreate the `railway_new` database
- Create all tables (zones, divisions, stations, units, contractors, vendors, users, roles, role_permissions, complaints, complaint_evidence, penalties, vendor_id_cards, vendor_renewals, inspections, audit_logs, contractor_documents)
- Seed demo divisions, stations, roles, users, contractors, vendors, complaints, penalties, and inspections

> If your MySQL root user has a password, run `mysql -u root -p < setup.sql` instead and enter it when prompted.

Verify it worked:

```bash
mysql -u root railway_new -e "SELECT COUNT(*) FROM users;"
```

You should see `10`.

---

## 2. Set up the backend

```bash
cd server
npm install
```

Create your local environment file by copying the example:

```bash
cp .env.example .env
```

`server/.env` should look like this (adjust `DB_USER` / `DB_PASSWORD` if your MySQL setup needs credentials):

```
PORT=4000
FE_BASE_URL=http://localhost:5173
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_DATABASE=railway_new
JWT_SECRET=TOP_SECRET

MAIL_USER=
MAIL_PASS=
```

- `JWT_SECRET` can be any string for local dev — just keep it consistent so existing tokens don't get invalidated on restart.
- `MAIL_USER` / `MAIL_PASS` are only used for the password-reset email flow; safe to leave blank for local development.

No build step is needed to run in dev mode (`ts-node` + `nodemon` handle TypeScript directly).

---

## 3. Set up the frontend

```bash
cd client
npm install
```

The client defaults to hitting the API at `http://localhost:4000/api`, which matches the backend's default port — no `.env` file is required for local development. If you need to point it elsewhere, create `client/.env` with:

```
VITE_API_BASE=http://localhost:4000/api
```

---

## 4. Run the application

Start each piece in its own terminal, from the `servms` folder:

```bash
# Terminal 1 — backend
cd server
npm run dev
# → API listening on http://localhost:4000  (routes under /api)
```

```bash
# Terminal 2 — frontend
cd client
npm run dev
# → http://localhost:5173
```

Then open **http://localhost:5173** in your browser. You should land on the login page.

---

## Seeded login accounts

All seeded users share the password shown below. Log in with the **username** (not employee ID) in the "Employee ID / Username" field.

| Role | Username | Password | Scope |
|---|---|---|---|
| Super Admin (HQ) | `superadmin` | `superadmin123` | All divisions |
| Divisional Admin | `admin_kgp` | `admin123` | Kharagpur Division |
| Divisional Admin | `admin_adra` | `admin123` | Adra Division |
| Divisional Admin | `admin_ckp` | `admin123` | Chakradharpur Division |
| Divisional Admin | `admin_rnc` | `admin123` | Ranchi Division |
| Inspector | `kiran_maurya` | `admin123` | Kharagpur Division |
| Inspector | `rina_tiwari` | `admin123` | Kharagpur Division |

---

## Troubleshooting

- **Backend won't start / port already in use:** macOS reserves port `5000` for AirPlay Receiver — this project uses `4000` specifically to avoid that conflict. Make sure `PORT=4000` in `server/.env`.
- **`ECONNREFUSED` / `Access denied` connecting to MySQL:** confirm MySQL is running (`brew services list` on macOS) and that `DB_USER`/`DB_PASSWORD`/`DB_HOST` in `server/.env` match your local MySQL setup.
- **Frontend loads but API calls fail (network errors in browser console):** confirm the backend is running on port 4000, and that `client/.env`'s `VITE_API_BASE` (if set) points to `http://localhost:4000/api`.
- **Want a clean slate?** Re-run `mysql -u root < setup.sql` from `server/database/` at any time — it drops and recreates the database from scratch.

---

## Project structure

```
servms/
  server/
    database/setup.sql       ← run this once to create + seed the DB
    app/api/<domain>/        ← route, controller, service, dto, validation per module
    app/common/               ← middleware, shared services, config
    index.ts                  ← Express app entry point
    .env                      ← local environment config (create from .env.example)
  client/
    src/pages/                ← one file per screen
    src/components/ui/         ← shared components (Field, StatCard, Pagination)
    src/styles/listPage.module.css ← shared CSS Module classes used across list pages
    src/api/client.ts          ← fetch wrapper, unwraps backend's {success, message, data} envelope
```

## What's implemented

- Login (no captcha), JWT auth, 3 roles (Super Admin / Admin / Inspector) scoped by division
- Role-based Dashboard with division-wise performance, inspection summary, recent alerts
- User Management, Role Management + Permission Matrix
- Location Masters (station/unit listing with filters, add/edit/deactivate)
- Vendor Management (multi-step onboarding wizard, filterable listing, Excel export)
- Contractor Management (full registration form, listing)
- ID Card / QR Management (QR code generation, issue/reissue, public verification page)
- Complaints (filterable tracking, multi-section registration form with evidence upload)
- Penalties & Recovery Ledger (filters, CSV export)
- Reports
