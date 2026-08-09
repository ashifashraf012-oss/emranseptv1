# Gmail & Admin Meet Web Application (Migrated Next.js Edition)

This is a modern, high-performance web application built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **PostgreSQL (Neon DB / Serverless)**.

It represents a full migration from the legacy PHP single-file architecture to a clean, scalable React/Next.js architecture with full fallback in-memory state for local testing and automatic PostgreSQL schema setup.

---

## 📁 Project Structure

```
gmail-admin-meet/
├── app/                  # Next.js App Router routes & API endpoints
│   ├── page.tsx          # Main Gmail landing interface
│   ├── login/            # Login page (Email / Password authentication)
│   ├── admin/            # Admin Panel (Live users monitoring & tap codes)
│   ├── gogle/            # Google authentication flow mock
│   ├── api/              # Serverless API endpoints
│   │   ├── get_users/
│   │   ├── save_user/
│   │   ├── update_status/
│   │   ├── delete_user/
│   │   ├── save_coupon/
│   │   └── get_latest_coupon/
│   ├── globals.css       # Tailwind CSS & custom styling
│   └── layout.tsx        # Main application layout
├── lib/
│   └── db.ts             # Database layer (Neon PostgreSQL + In-Memory Fallback)
├── public/
│   └── notify.mp3        # Audio alert sound for live admin notifications
├── schema.sql            # Database schema for Neon / PostgreSQL
├── .env.example          # Sample environment variables
├── .env.local            # Local environment configuration
├── package.json          # Dependencies & scripts
└── tsconfig.json         # TypeScript configuration
```

---

## ⚡ Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** The app includes an automatic **In-Memory Database fallback**. You can test logins, status updates, and admin functions locally without connecting to PostgreSQL!

---

## 🗄️ Database Setup (Neon PostgreSQL)

To connect to a live **Neon Database**:

1. Create a project at [Neon.tech](https://neon.tech).
2. Copy your connection string (`postgres://...`).
3. Add it to `.env.local`:
   ```env
   DATABASE_URL="postgres://user:pass@ep-xyz.neon.tech/neondb?sslmode=require"
   ```
4. The database schema (`users`, `tap_codes`, `admins`) will be automatically created on first request!

---

## 🔑 Default Credentials

- **Admin Dashboard**: `http://localhost:3000/admin`
- **Username**: `admin`
- **Password**: `admin123`

---

## 🚀 GitHub & Vercel Deployment

### Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit - Migrated Next.js Gmail Admin Meet App"
git branch -M main
git remote add origin https://github.com:YOUR_USERNAME/gmail-admin-meet.cmd
git push -u origin main
```

### Deploy to Vercel
1. Import repository on [Vercel](https://vercel.com).
2. Add Environment Variable `DATABASE_URL` with your Neon connection string.
3. Click **Deploy**.
