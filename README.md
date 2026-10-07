# Budget My House

A private, multi-house construction tracker built with Next.js and Supabase, ready for Vercel.

## Features

- Create multiple house projects and switch between their separate budgets, spending and plans.
- Every new house starts with 20 construction stages and 42 budgetable/payable material and service items. Estimates are blank, and no existing payments are copied.
- Add/edit/remove stages, items, payments and tasks. Search, filters, SN columns, per-house CSV exports and mobile layout.
- Invite equal co-owners using email-bound links you copy and send yourself. Owners share the same records and can manage membership. A house always retains at least one owner.
- Archive houses to pause editing while retaining read access; restore them when needed.
- Each house has its own name and currency. Item estimates are breakdowns, not extra stage budgets. Unknown budgets remain blank; negative balances show overspending. Amounts use whole units. Currency changes do not convert stored amounts.

The application name is **Budget My House**. **Mabena House** remains the name of your existing house project.

## Local preview

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Without Supabase configuration, development mode previews the original Mabena House records and supports multiple houses saved in browser storage. Original records include 14 payments totalling 59,100,000 and a fence balance of 6,000,000. Previous preview edits are migrated from the old local-storage key. Shared ownership requires Supabase; preview changes do not sync automatically to it.

Production without database configuration displays setup instructions and does not publish workbook records. Clear `budget-my-house-preview-v3` and `budget-my-house-selected` in browser storage to reset the preview. The original key is retained as a recovery copy.

## Fresh Supabase setup

1. Create a Supabase project and run **supabase/schema.sql** once in SQL Editor. This is for a fresh database only.
2. In Authentication, enable email/password signups and **Confirm email**. New accounts can create their own houses without an administrator approval list.
3. Copy `.env.example` to `.env.local`. Set the Supabase Project URL and publishable key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

A legacy anon key also works. Do not use a secret or service-role key in public environment variables.

4. In Authentication → URL Configuration, set Site URL to your deployed app URL. Add these Redirect URLs, replacing the example hostname:

```text
http://localhost:3000
http://localhost:3000/invite/**
https://your-app.vercel.app
https://your-app.vercel.app/invite/**
```

Add trusted preview origins if needed. Invitation registration and email confirmation return to the invitation page. Configure SMTP for reliable confirmation/password-reset email delivery. The app does not send invitation emails.

5. Restart the local server, create an account, confirm its email, then create a house project. Another verified account can accept an owner-generated invitation.

### Import your original workbook privately

For a fresh database, sign up and confirm your own email first. In **supabase/import-mabena.sql**, replace `OWNER_EMAIL` with that email and run the script as administrator in SQL Editor. It assigns the original records only to that user, imports them once, and does not expose them to other new accounts. The house can then be shared through Ownership.

## Upgrade the original single-house app

Use **supabase/migrate-v2.sql** instead of the fresh schema. Do not run both scripts.

1. Take a database backup and pause writes from the old app.
2. Run `supabase/migrate-v2.sql` as administrator in Supabase SQL Editor. It locks the old tables during a single transaction, converts each legacy user’s records into one owned house, preserves record IDs/values/dates, reconciles record counts and payment totals, then removes the old access model. A failure rolls back the transaction.
3. Deploy this version and reload open browser tabs. Old clients use incompatible table names, so migrate the database and update the application together.
4. Ensure email confirmation and the redirect URLs above are configured. Legacy accounts keep membership and must have verified email to access records.
5. Confirm Mabena House shows 59,100,000 paid and the fence shows 6,000,000 remaining. Existing separate user copies remain separate houses; the migration does not merge them.

The migration also marks the workbook as already imported so the optional import will not duplicate it for existing owners. Browser-preview edits are migrated locally, not uploaded into a database. Restoring the old version requires restoring the backup; deploying old code alone is insufficient.

## Deploy on Vercel

1. Push the project to a **private repository** because the seed, import SQL and legacy test fixture contain your original house records.
2. Import it in Vercel using the Next.js preset, this folder as Root Directory, and Node.js 22.x or newer.
3. Add both Supabase environment variables to Production and any trusted Preview environments.
4. Deploy with `npm ci` and `npm run build`. Redeploy after changing either public environment variable, since they are embedded at build time.
5. Apply the appropriate database setup/upgrade above and configure the production auth redirect URLs.

No service key, invitation email provider, custom API server or Vercel filesystem database is required. Supabase auth supplies sessions and PostgreSQL membership policies authorize data access.

## Sharing and daily use

- **All house projects:** create a house or open an existing one. Use the sidebar house selector to switch.
- **Stages & budgets:** set overall construction estimates, dates and status.
- **Budget items:** enter material/service estimates and click Pay to record a linked payment.
- **Payments:** record each payment once, linked to a stage and optionally an item, with supplier/date/receipt details.
- **Project plan:** add tasks, due dates and notes and mark work done.
- **Ownership:** create an invitation for an email address, copy its link and send it yourself. Links are single-use, expire after seven days, and can be revoked. Creating a replacement revokes the old pending link for that email. Recipients sign in with the matching verified email and explicitly accept.
- Co-owners have equal access to records/settings/membership. They can remove another owner or leave, but cannot remove the final owner. Recorded payments remain after membership removal. Archived houses must be restored before record or membership changes.
- CSV exports include the house name and reflect current filters. Totals never combine different houses or currencies. Shared data refreshes after saves, on window focus and through Refresh.

## Verification

```sh
npm test
npm run typecheck
npm run build
npm run test:browser
```

Unit/database tests verify source reconciliation, unknown/zero estimates, validation, invitations, approved email matching, verification requirements, shared edits, owner isolation, cross-house relationships, archive restrictions, last-owner protection, migration and import idempotence. Embedded PostgreSQL serializes sessions: the simultaneous-removal test checks serialized contenders and the SQL locking invariant, rather than a hosted multi-connection stress test.

Browser checks cover budgets/payments/tasks, persistence, mobile layout, multiple houses, switching, archive/restore and exports. They use Google Chrome and the local development preview.

The connected ownership UI test uses dummy credentials and a mocked Supabase API. In another terminal, run:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-test-public NEXT_DIST_DIR=.next-connected npm run dev -- --hostname 127.0.0.1 --port 3002
```

Then:

```sh
npx playwright test --config playwright.connected.config.ts
```

It checks member display, invitation creation/revocation and acceptance navigation without sending email or contacting a real account. Verify hosted auth delivery and database connectivity after configuring your Supabase project.

## Implementation

- `components/workspace.tsx`: authentication, house list/switching, creation and invitation acceptance.
- `components/tracker.tsx`: house-scoped stages, items, payments, tasks and settings.
- `components/ownership.tsx`: owners, invitations and archive/restore.
- `supabase/schema.sql`: fresh schema and generic templates.
- `supabase/migrate-v2.sql`: transactional legacy conversion.
- `supabase/import-mabena.sql`: private administrator-run workbook import.
- `scripts/build-multi-house.mjs`: regenerates those SQL files and safe starter templates from the canonical seed and `supabase/multi-house.sql`.

The browser never needs a service key. Membership and archive checks run in PostgreSQL. House locks serialize invitation acceptance/revocation, member changes and archiving; record triggers recheck permissions after locking. Composite foreign keys prevent cross-house stage/item payments. Creator attribution is separate from ownership; removing an owner does not cascade-delete their records. No permanent house deletion is exposed.

Official references: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase auth redirects](https://supabase.com/docs/guides/auth/redirect-urls).

## Current Vercel deployment

Production: https://budget-my-house.vercel.app

Project: `daud-mabenas-projects/budget-my-house`. Production initially displays setup instructions until Supabase environment variables and database setup are completed. `.vercelignore` excludes local builds, test artifacts and administrator SQL from uploads.
