# Office Intelligence Admin

A standalone, server-authenticated operations dashboard for Denbegnaye Office Intelligence. It shows platform users, Office Intelligence usage, recent runs, and payment submissions with private receipt links and approve/reject actions.

The dashboard reads and updates the existing Denbegnaye admin API. It does not connect to Supabase from the browser and does not change either existing admin project.

## Requirements

- Node.js 20.9 or later and npm.
- The main Denbegnaye application running at `http://localhost:3000` for local development.
- The Office Intelligence payment and usage/reporting migrations applied to the Supabase project used by Denbegnaye.

## Configure local access

1. Copy `.env.example` to `.env.local`:

   ```powershell
   Copy-Item .env.example .env.local
   ```
2. Set `ADMIN_EMAIL` to the standalone admin sign-in email.
3. Generate an admin password hash and set the printed value as `ADMIN_PASSWORD_HASH`:

   ```powershell
   npm run admin:password
   ```

4. Generate `ADMIN_SESSION_SECRET` and `ADMIN_SERVICE_TOKEN_SECRET` with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

   `ADMIN_SERVICE_TOKEN_SECRET` must exactly match the value on the main Denbegnaye app. `ADMIN_SESSION_SECRET` is private to this dashboard.
5. Set `DENBEGNAYE_API_URL=http://localhost:3000`.
6. Install and start:

   ```powershell
   npm install
   npm run dev
   ```

7. Open `http://127.0.0.1:3003/login`.

The password hash, session secret, and shared API secret are server-only. Never use a `NEXT_PUBLIC_` prefix for these values or commit `.env.local`.

## Dashboard features

- **Overview:** Office user, execution, conversation, and file totals; recent runs; current usage snapshot.
- **Users:** platform accounts joined with per-user Office Intelligence executions, chats, files, and last activity.
- **Payments:** pending or historical receipts; private signed receipt previews; approve to activate one month or reject with an optional note. Decisions and notification emails use the main app's admin API and Resend configuration.

## Database setup

The main app must have the Office Intelligence usage/reporting migrations and `20261107193000_add_office_intelligence_manual_payments.sql` applied to its configured Supabase project. If migrations are missing, the dashboard displays the API error instead of fake or sample data.

## Production

Deploy this project as a separate server-side Next.js service. Configure the admin credentials, both secrets, and the HTTPS origin of the main Denbegnaye app in its deployment environment. Use the same `ADMIN_SERVICE_TOKEN_SECRET` on both services. Keep the main app's Supabase service-role key and Resend credentials on the main app only.
