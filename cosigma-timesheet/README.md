# Cosigma Timesheet

Premium time-tracking & onsite-compliance platform. Next.js 16 (App Router) ·
React 19 · Prisma 6 (MySQL) · Tailwind v4 · Framer Motion.

## Features

- **Premium dark UI** — glassmorphism panels, indigo/violet & emerald/rose
  gradient accents, animated radial compliance gauge, Framer Motion page
  transitions, staggered lists, collapsible glowing sidebar.
- **Dashboard** — onsite-compliance radial gauge, KPI cards (compliance, hours
  logged vs target, pending drafts, remaining leave), missing-timesheet alerts.
- **Smart Timesheet** — month calendar with color-coded day status, auto-filling
  entry form (8h / default mode / last project), animated HYBRID onsite+remote
  split with live reconciliation, project autocomplete.
- **Manager Approvals** — filterable team list, batch approve/reject with
  animations, detail + rejection-note modals.
- **Reports & Export** — customer/project/user/period filters, data table, and a
  branded PDF export with entry log + compliance summary.

## Business rules

- **Payroll period** runs 25th → 24th (`src/lib/payroll-period.ts`).
- **Compliance** (`src/lib/compliance.ts`): a day counts onsite when onsite
  hours ≥ 4; `requiredOnsiteDays = ceil(workingDays × 0.5)`.
- **Validation** (`src/lib/timesheet-validation.ts`): blocks weekends unless
  overtime, requires an active project assignment on the date, integrates leave
  (full-day blocks, half-day caps at 4h), enforces onsite + remote = total.

## Getting started

A MySQL 8 instance is expected (see `DATABASE_URL` in `.env`). For local dev:

```bash
docker run --name cosigma-mysql -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=cosigma_timesheet -p 3307:3306 -d mysql:8

npm install
npm run db:migrate      # apply migrations
npm run db:seed         # load demo data
npm run dev             # http://localhost:3000
```

## Demo accounts

| Role     | Email                | Password       |
| -------- | -------------------- | -------------- |
| Admin    | admin@cosigma.com    | `Password123!` |
| Manager  | manager@cosigma.com  | `Password123!` |
| Employee | employee@cosigma.com | `Password123!` |

The employee account is seeded **non-compliant** (with missing days & drafts);
the manager account is **compliant** — useful for comparing dashboard states.

## Scripts

- `npm run dev` / `build` / `start`
- `npm run db:migrate` — `prisma migrate dev`
- `npm run db:seed` — load seed data
- `npm run db:reset` — drop, re-migrate and re-seed
