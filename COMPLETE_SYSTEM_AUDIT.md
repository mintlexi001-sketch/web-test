# Science and Society — Complete System Audit

**Date:** 9 September 2026  
**Scope:** Full frontend, Express backend, Supabase schema/RLS/RPCs, auth, storage, email, and security.  
**Code path:** `science and society/`  
**Canonical DB migration:** `backend/SQL_Query/safe_update_only.sql` (after one-time `schema.sql` on a blank project).

This document is a system map plus an issue list. Severity:

| Level | Meaning |
|---|---|
| **Critical** | Broken core flow or likely data/account compromise |
| **High** | Confidentiality/integrity failure or serious abuse |
| **Medium** | Real risk, needs a planned fix |
| **Low** | Small bugs, UX, hygiene, defense-in-depth |
| **Info** | Architecture notes, drift, residual risk |

---

## 1. What this product is

**Science and Society** (also branded Gyan Samavesh 2026 in SQL comments) is a journal platform:

- Public site for about, editorial board, archive, paper pages, contact, and full-text *requests*.
- **Author** accounts (`role = student` in code).
- **Reviewer** accounts (register as pending until an admin approves).
- **Admin** accounts (not self-registered; promotion only, with one permanent admin).

Most data access is **direct from the browser to Supabase** (anon key + user JWT + RLS).  
The **Node/Express** server handles OTP email, password/email change, notifications/email, paper PDF delivery, and privileged delete/resubmit.

---

## 2. Architecture

```
Browser (Vite/React, Vercel)
  ├─ Supabase Auth (email/password)
  ├─ Supabase PostgREST (tables, views, RPCs)  ← RLS is the real authorization layer
  └─ Express API (Render/Vercel)                ← service-role key; JWT checked in middleware
       ├─ Nodemailer (Gmail SMTP)
       └─ Supabase service role (bypass RLS)
```

| Layer | Stack |
|---|---|
| Frontend | React 18, React Router 7, Vite 8, Framer Motion, Lucide, Supabase JS, Sentry |
| Backend | Express 5, Helmet, CORS, express-rate-limit, Nodemailer, Sentry |
| Database | Supabase Postgres + RLS, Storage bucket `journals` (private, PDF, 10 MB) |
| Hosting | Frontend: Vercel SPA rewrites. Backend: Express (`backend/index.js`); `backend/api/index.js` re-exports the app for Vercel |

**Roles in code vs UI**

| DB `profiles.role` | UI label |
|---|---|
| `student` | Author |
| `reviewer` | Reviewer |
| `admin` | Admin |

**Account status:** `active` · `pending` (reviewers waiting approval) · `inactive` (banned / scheduled deletion).

---

## 3. Auth and session workflow

### 3.1 Login (`/login`)

1. Email + password → `supabase.auth.signInWithPassword`.
2. Load `profiles` for `role` and `status`.
3. `pending` → sign out → `/pending-approval`.
4. `inactive` → sign out + toast.
5. Else navigate to `/admin/dashboard`, `/reviewer/dashboard`, or `/student/dashboard`.
6. Show/hide password; link to forgot password and register.

`GuestRoute` sends already-logged-in *active* users to their dashboard. Pending/inactive users still see the login page.

### 3.2 Register (`/register`)

1. Name, role (Author or Reviewer only), email, password (min 8, 1 uppercase, 1 digit), confirm.
2. `POST /api/auth/register-otp` (unauthenticated).
3. OTP step → `POST /api/auth/verify-register`.
4. Backend creates Auth user (`email_confirm: true`), then `profiles` row. Reviewer status = `pending`; author = `active`.
5. Authors are signed in then sent to login; reviewers stay logged out until approved.
6. Admin cannot be chosen in UI or API (`role` whitelist).

### 3.3 Forgot password (`/forgot-password`)

1. Email → `POST /api/auth/reset-otp` (generic success to reduce enumeration).
2. OTP + new password → `POST /api/auth/verify-reset`.  
   **This second step is currently broken** (see Critical issue C-1).

Not wrapped in `GuestRoute`.

### 3.4 Frontend guards (`App.jsx`)

- **ProtectedRoute:** no session → `/login`. Profile fetch failure → sign out. `pending` → sign out + pending page. `inactive` → login. Wrong `allowedRoles` → that user’s dashboard.
- **Notifications** (`/notifications`): any authenticated active role.
- Settings live under `/student/settings`, `/reviewer/settings`, `/admin/settings` (same `Settings.jsx`).

### 3.5 Backend auth (`requireAuth.js`)

- Bearer JWT via `supabase.auth.getUser(token)` (not a local decode).
- Inactive / missing profile → 403.
- Pending → 403.
- `requireAdmin`: `role === 'admin'` and `status === 'active'`.

### 3.6 Settings (all roles)

- View locked username; change email (OTP to new address); change password (re-auth with current password then `updateUser`).
- Schedule account deletion via RPC `schedule_account_deletion` (15-day grace); login auto-calls `/api/auth/cancel-deletion`.
- Permanent admin: email from `VITE_PERMANENT_ADMIN_EMAIL` **or** `is_permanent`; deletion UI hidden.

---

## 4. Page-by-page inventory

### 4.1 Public site (Navbar + Footer)

Navbar: Home, About Us, Editorial Board, Publication Archive, hash links (Guidelines, Submission Procedure, Contact), theme toggle, Login/Register or Dashboard + bell + Logout.

| Route | Page | What it does |
|---|---|---|
| `/` | `Home.jsx` | Intro animation (once per session), hero, current-issue carousel from `published_issues`, guidelines/workflow/contact. Contact → `POST /api/notify/contact` (honeypot not on this form). |
| `/about` | `About.jsx` | Static about. |
| `/editorial-board` | `EditorialBoard.jsx` | Static board. |
| `/published-papers` | `PublishedPapers.jsx` | Archive: volumes/issues from `published_issues`, search, pagination. |
| `/published-issues` | `PublishedIssues.jsx` | Alternate listing + paper request (`/api/notify/paper-request`). |
| `/future-issues` | `FutureIssues.jsx` | Upcoming/issue messaging + published query. |
| `/paper/:id` | `PaperDetail.jsx` | One published paper from the view (no manuscript PDF). Full-text request form → notify API. |
| `/login` | `Login.jsx` | See §3.1. |
| `/register` | `Register.jsx` | See §3.2. |
| `/forgot-password` | `ForgotPassword.jsx` | See §3.3. |
| `/pending-approval` | `PendingApproval.jsx` | Reviewer waiting message. |
| `*` | `NotFound.jsx` | 404. |

Public papers **never** expose `file_url`. Full PDFs go out only after admin approval + emailed attachment (signed URL).

### 4.2 Shared authenticated

| Route | Page | Buttons / actions |
|---|---|---|
| `/notifications` | `NotificationsPage.jsx` | List (limit 100), date filter, tabs (all / messages / paper requests / system), mark read, delete one, clear all. **Admins** can reply to contact metadata via `/api/notify/reply-contact`. Realtime unread badge on Navbar. |

Sidebar (dashboards): Home, role links, Settings, Logout. Admin badges: reports, assign queue, pending users, accepted, paper requests, assigned papers.

### 4.3 Author (`student`)

| Route | Page | Workflow |
|---|---|---|
| `/student/dashboard` | `StudentDashboard.jsx` | Counts: total, under review, accepted/published, rejected. Latest 3 papers. Retry. |
| `/student/upload` | `UploadJournal.jsx` | Draft in `localStorage`. Checks `current_issue.is_open`. Title, abstract, keywords, authors, PDF (magic-byte `%PDF-`). Upload to `{uid}/{timestamp}_file.pdf`, insert `journals`. Notify `/api/notify/upload`. Closed window → block UI. |
| `/student/journals` | `StudentJournals` | List + status filters. Delete only `pending`/`submitted` via `/api/student/journals/:id/delete`. |
| `/student/journals/:id` | `StudentJournalDetail` | Full record, signed PDF, reviews after decision, resubmit when `rework`/`revision_required`: new PDF + `/api/student/resubmit`. |
| `/student/guidelines` | `Guidelines.jsx` | Static editorial rules. |
| `/student/settings` | `Settings.jsx` | See §3.6. |

**Author journal lifecycle:** `submitted` → (admin assigns) `under_review` → admin RPC `accepted` / `rejected` / `rework` → optional resubmit back to `submitted` → later `publish_pre_compile` → `published` (Articles in Press) → `admin_compile_issue` sets volume/issue.

### 4.4 Reviewer

| Route | Page | Workflow |
|---|---|---|
| `/reviewer/dashboard` | `ReviewerDashboard.jsx` | Assigned journals + reviewed vs pending. **Loads `journals(..., profiles(name))` — author names.** |
| `/reviewer/assigned` | `AssignedJournals` | Filter list, open review. |
| `/reviewer/review/:id` | `ReviewJournal` | Scores (1–5), comments, optional revision PDF under `reviewer/{uid}/...`. Insert/update `reviews`. Notify `/api/notify/review`. |
| `/reviewer/settings` | `Settings.jsx` | Same as author. |

Reviewers cannot register as active; admin **Approve** / reject-delete.

### 4.5 Admin

| Route | Page | Workflow |
|---|---|---|
| `/admin/dashboard` | `AdminDashboard.jsx` | Totals, under review, approved/published, recent journals/users, pending paper requests. Retry. |
| `/admin/journals` | `AdminJournals.jsx` | All manuscripts, filters. Open report. Unpublish RPC. Delete published via `/api/admin/journals/:id/delete` + notify. |
| `/admin/reports` | `AdminReports.jsx` | Journals with reviews. |
| `/admin/reports/:id` | `ReviewReportDetail` | Reviews, scores, PDFs. Decision: accept / reject / rework via `admin_make_decision`. Optional proof/revision uploads under `admin/{uid}/`. Email notify. Can edit decision later (RPC allows any unpublished). |
| `/admin/reviewers` | `AssignReviewers.jsx` | Unassigned / reworks / assigned. `assign_reviewer_to_journal` / `unassign_reviewer_from_journal`. Emails assign, sent-for-review, unassign. |
| `/admin/assigned-papers` | `AssignedPapers.jsx` | Under-review list, expand, signed manuscript, unassign. |
| `/admin/accepted-papers` | `AcceptedPapers.jsx` | Accepted list. `publish_pre_compile` (Articles in Press). Delete. |
| `/admin/compile-issue` | `AdminCompileIssue.jsx` | Select in-press papers, volume/issue, `admin_compile_issue`. Reads `current_issue`. |
| `/admin/publish-legacy` | `PublishLegacy.jsx` | Admin inserts a journal (legacy/manual), not a student submission. |
| `/admin/paper-requests` | `PaperRequests.jsx` | Approve / reject (email on reject). Send PDF → `/api/notify/paper-delivery`. |
| `/admin/users` | `AdminUsers.jsx` | Approve reviewer, reject (delete), ban/unban, delete, promote/demote (permanent admin only). Permanent email hardcoded fallback. |
| `/admin/settings` | `Settings.jsx` | Same settings. |

---

## 5. Backend API catalog

**Security middleware:** Helmet (strict CSP on API — API is JSON-only), CORS (`FRONTEND_URL` or localhost in dev; **requests with no `Origin` are allowed**), JSON 1 MB, `/api` 150 req/15 min/IP, `/api/auth` 15/10 min, health `GET /health` → `{ status: 'ok' }`.

### Auth (OTP)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register-otp` | — | Send register OTP |
| POST | `/api/auth/verify-register` | — | Create user |
| POST | `/api/auth/reset-otp` | — | Reset OTP |
| POST | `/api/auth/verify-reset` | — | Set new password (**broken**, C-1) |
| POST | `/api/auth/email-change-otp` | JWT | OTP to new email |
| POST | `/api/auth/verify-email-change` | JWT | Apply email change |
| POST | `/api/auth/cancel-deletion` | JWT | Clear deletion schedule |

OTP: 6 digits, `crypto.randomInt`, SHA-256 store, 10 min expiry, ~60s resend, 3 attempts on verify (email-change path; reset path never reaches this). Email domain allowlist + `.edu` / `.ac.*`.

### Notify / email

Public: `paper-request`, `contact` (OTP limiter).  
Then `app.use('/api/notify', requireAuth)`.  
Admin-only: assign, unassign, decision, ban/unban, reviewer approve/reject, sent-for-review, rework, publish, paper-request-rejected, paper-delivery, paper-deleted, delete-account, reply-contact.  
Any logged-in user: upload, review, resubmit (extra OTP limiter).

### Privileged file/DB

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/student/resubmit` | JWT | Ownership, status, file path `{uid}/...`; wipe reviews/assignments; reset to submitted |
| POST | `/api/student/journals/:id/delete` | JWT | Own paper, status submitted/pending, path prefix |
| POST | `/api/admin/journals/:id/delete` | JWT+admin | Delete row then storage files |

---

## 6. Database, RLS, RPCs, storage

**Tables:** `profiles`, `journals`, `assignments`, `reviews`, `paper_requests`, `notifications`, `current_issue`, `custom_otps` (service role only).

**Public read:** view `published_issues` (`security_invoker = false`) — published rows only; authors JSON with `email` stripped; **no** `file_url` / comments / student_id.

**Journals SELECT:** owner, admin, or assigned reviewer.  
**Journals INSERT:** student + `is_open` + active; or admin.  
**Journals UPDATE:** admin only (students cannot patch status). Resubmit is Express + service role.

**Storage:** private bucket; SELECT for owner, admin, assigned reviewer (manuscript + revision report), student own files including approval proof. Upload path isolation: `{uid}/`, `reviewer/{uid}/`, `admin/{uid}/`. MIME PDF, 10 MB.

**Important RPCs (SECURITY DEFINER, admin check inside unless noted):**  
`assign_reviewer_to_journal`, `unassign_reviewer_from_journal`, `admin_make_decision`, `unpublish_journal`, `admin_compile_issue`, `publish_pre_compile`, `approve_reviewer`, `ban_user`, `unban_user`, `delete_user`, `promote_to_admin` / `demote_from_admin` (permanent admin only), `schedule_account_deletion`, `cancel_account_deletion`.  
`get_assigned_journals_for_reviewer()` exists and **omits author names** — the UI does **not** use it.

**Triggers:** freeze `is_permanent`; non-admins cannot change role/status; journal insert strips publication/review fields; file_url ownership; reviews cannot retarget journal; notifications immutable except `is_read`; protect permanent admin.

---

## 7. Frontend ↔ backend workflows (happy paths)

1. **Submit:** UI closed-check + RLS `is_open` → storage upload → insert (status forced `submitted`) → email admins + author.
2. **Assign:** RPC inserts assignment + `under_review` → emails reviewer + author.
3. **Review:** reviewer writes `reviews` (must be assigned) → emails admin; optional author email; in-app.
4. **Decision:** RPC sets status + comments/URLs → emails author.
5. **Rework:** author new PDF → Express resubmit (server-side count/history) → queue again.
6. **Publish:** accepted → `publish_pre_compile` (in press) → compile volume → public view.
7. **Full text request:** public form → service-role insert + admin email → admin approve/reject → attach PDF via signed URL.

---

## 8. Issues (all severities)

### Critical

**C-1. Password reset verification always crashes**  
`backend/controllers/authController.js` `verifyResetOTP` uses `isExpired` and `isWrongOtp` **without defining them**. Email-change in the same file defines them correctly. In Node this is `ReferenceError` → 500. Users who receive a reset OTP **cannot set a new password**. Forgot-password UI will show a generic failure.

**C-2. Service-role paper request can target unpublished journals**  
RLS allows anon insert only if `journal_id` is in `published_issues`. `notifyPaperRequest` uses the **service role**, checks `journals` by id (any status), then inserts. Anyone who can guess/leak a UUID can request (and after admin send-PDF, receive) an unpublished manuscript. Fix: require `status = 'published'` (or query the view) in Express.

### High

**H-1. Double-blind broken in reviewer UI**  
`ReviewerDashboard.jsx` and `AssignedJournals.jsx` select `profiles(name)` on journals. Assigned reviewers see author identity. RPC `get_assigned_journals_for_reviewer()` was added to hide this and is unused. Student detail also selects `reviews(..., profiles(name))` after a decision.

**H-2. `notifyReview` trusts client `studentId`**  
Assignment is checked; then email/in-app go to whatever `studentId` the reviewer posts. A reviewer can spam any user id. Resolve `student_id` from the journal row.

**H-3. `notifyUpload` is not tied to a real insert**  
Any authenticated user (reviewer/admin too) can hit `/api/notify/upload` and spam editor email/in-app if `is_open`. Rate-limited but not bound to a journal they own.

**H-4. Production CSP still allows localhost and `unsafe-inline`**  
`frontend/vercel.json` CSP: `script-src 'self' 'unsafe-inline'`; `connect-src` includes `http://localhost:*` and `ws://localhost:*` on the **production** site. XSS can talk to localhost; inline script weakens XSS defense. `object-src` includes `blob:` (needed for PDFs) — keep but tighten scripts/connect.

**H-5. Schema bootstrap vs live policies**  
`schema.sql` still creates storage policy **"Anyone can read journal files"** and weaker profile/review policies. If someone deploys **only** `schema.sql` (or forgets `safe_update_only.sql`), all manuscript PDFs are world-readable. README warns; this is still an operational landmine.

### Medium

**M-1. Register email enumeration**  
Existing email → `400` + “If this email is not registered, an OTP will be sent.” New email → `200` + OTP sent. Different status codes enumerate accounts. Reset-otp uses a consistent 200.

**M-2. OTP strength**  
6-digit numeric, SHA-256 **without pepper**, 3 tries (when the check actually runs). Mitigated by rate limit and hashing vs plaintext. Prefer 8-digit or longer, HMAC with server secret, lockout per email+IP.

**M-3. `admin_make_decision` has a weak state machine**  
Any unpublished journal can be accepted/rejected/reworked, including never-reviewed `submitted` papers. Product may want that; it is also a foot-gun and a confused-deputy if an admin token is stolen.

**H/M `assign_reviewer_to_journal`** does not require status `submitted`/`rework`; it can assign a reviewer to a published/accepted paper if no assignment row exists.

**M-4. Paper delivery matching is fragile**  
Lookup by `requester_email` + `journal_title` + pending/approved, `maybeSingle()`. Duplicate requests → error or wrong row. Does not use `paper_requests.id`. Delivery does not set status to `responded`. Client `fileUrl` is ignored (good) after U-8.

**M-5. CORS allows missing Origin**  
Intended for curl/mobile; browsers with Bearer tokens are less CSRF-sensitive. Still allows non-browser clients from any host if they steal a JWT.

**M-6. Rate limit + serverless**  
No `trust proxy`. On Vercel/Render, limits may apply to a proxy IP (over-blocking) or be split per instance (under-blocking). OTP 15/10 min is relatively high.

**M-7. Sentry backend `tracesSampleRate: 1.0` and `profilesSampleRate: 1.0`**  
Full traces in production: cost and possible PII in spans (emails, titles). Frontend tracing is 0.1 (better).

**M-8. Permanent admin email in frontend**  
`VITE_PERMANENT_ADMIN_EMAIL || 'nirmala.scienceandsociety@gmail.com'` in `AdminUsers.jsx` and `Settings.jsx`. Reveals privileged mailbox; UI-only (RPCs use `is_permanent`).

**M-9. `enforce_profile_role_integrity` treats `service_role` like a client on UPDATE for role freeze?**  
On UPDATE, role/status freeze applies unless `auth.uid()` is admin. Service role has no `auth.uid()` — so **service-role profile updates cannot change role/status** except via SECURITY DEFINER RPCs (those run as definer and still see `auth.uid()` of the JWT user when called from the client). Express `supabase` service client updates might be blocked unexpectedly, or `auth.uid()` null might freeze always — worth verifying `ban_user` etc. (they are definer RPCs from the **browser**, so uid is admin). Express-only profile writes should be tested.

**M-10. Student `select('*')` on own journal**  
Includes `prev_reviewer_name`, admin comments, storage paths. After rework, previous reviewer name may show in the author UI (integrity / double-blind).

**M-11. Contact form has no honeypot** (paper request does). Spam to editor inbox; only rate limit.

**M-12. `replyContact`**  
Admin can email any address that ever appeared as `metadata.sender_email` on a notification, with arbitrary subject/body. Trusted-admin assumption.

**M-13. Helmet HSTS on the API**  
Fine on HTTPS; awkward if the API is ever served on HTTP.

**M-14. Login auto-cancel deletion**  
Any successful login cancels deletion without extra confirm. Stolen password restores a doomed account (may be intended).

### Low

**L-1. `notifyDecision` does not insert an in-app notification** (other flows do). Authors may only get email.

**L-2. Sidebar admin counts** load **all** `journals` with nested `reviews(id)` then filter in JS. Slow and heavy as the archive grows.

**L-3. Admin dashboard “Approved” counts `approved` + `published`**, not `accepted`. Cards/labels disagree with Accepted Papers.

**L-4. Status vocabulary drift**  
UI/filters mention `pending` journals; constraint allows `pending` and `review_complete`; student delete allows `pending` **or** `submitted`. Easy to miss rows.

**L-5. Forgot-password not a guest route**; logged-in users can open it.

**L-6. `GuestRoute` + pending users** still render Login.

**L-7. Journal draft in `localStorage`** (title/authors/emails) on shared computers.

**L-8. Password change uses `signInWithPassword` again** (new session/refresh) — can surprise other tabs.

**L-9. `sendNotification` returns `null` on network error**; callers sometimes throw “Failed…” which is OK, but easy to miss `!res`.

**L-10. `test_blank.js`** leftover Playwright-style script in frontend.

**L-11. `PublishedIssues` vs `/published-papers`** overlapping archive UX.

**L-12. Email HTML `esc()`** used in many templates; in-app notification strings often **not** escaped (React texts them — OK). `notifyContact` stores `esc(subject)` in title but raw `full_message` in metadata.

**L-13. Gmail SMTP** single mailbox, app password in env; no queue; failures return 500 after DB writes in some paths (paper request can be saved even if mail fails — actually it returns 500 after insert if mail fails, leaving a request without email).

**L-14. Student delete vs admin delete** student path does not delete revision/approval files (usually none at submitted).

**L-15. `getSignedUrl` 1 hour**; leaked signed URLs work until expiry. Delivery uses 10 minutes.

**L-16. Realtime notifications** filter `user_id=eq.{id}` — relies on Supabase realtime authorization.

**L-17. No CSRF cookies** (Bearer) — good. Tokens in `localStorage` via supabase-js default persist — XSS = account takeover.

**L-18. Frontend lint `max-warnings 0`** is good; no frontend automated tests of routes.

**L-19. Backend tests** (`tests/security.test.js`) mock/guard delete and resubmit — they will not catch C-1.

**L-20. `verifyRegisterOTP` OTP compared after expiry check**; reset path never compares OTP (C-1).

**L-21. Account enumeration via timing** on register (delay only when email exists).

**L-22. `custom_otps` keyed by email** — register OTP and reset OTP share one row; overlapping flows can clobber each other.

**M/L. `unban_user` sets reviewers to `pending`** — they must be re-approved (product choice).

**L-23. Compile issue updates `current_issue` volume/issue** but there is **no admin UI** in this repo to toggle `is_open` except compile writing volume fields. Closing submissions may require SQL or a missing screen.

**L-24. Intro animation + heavy 3D** on Home: performance on low-end devices.

**L-25. `ProtectedRoute` `allowedRoles` with `profile` still null and `profileError` false** is a narrow race; SEC-021 mostly covers it.

**L-26. `.env` files exist locally** and are gitignored. Confirm they are not on the remote. Never commit service role / SMTP / anon keys.

**L-27. Known live-DB drift** (`SQL_Query/README.md`): `verification_tokens` / `generate_verification_token` may exist only in production.

**L-28. `publish_pre_compile` comment says approved→published; code allows `approved` or `accepted`.** UI uses accepted. Fine if both exist.

**L-29. Duplicate resubmit emails** if UI called `/api/notify/resubmit` *and* Express resubmit also emails (student Journals uses `/api/student/resubmit` which already mails). Check Journals does not also call notify/resubmit — grep showed resubmit goes to `/api/student/resubmit` only. Good.

**L-30. Assign flow emails even if RPC succeeded and notify fails** — assignment exists, reviewer not emailed.

### Info / residual

- **Authorization model is RLS-first.** Frontend role checks are UX only. This is correct if `safe_update_only.sql` is applied.
- **Service role on Express** is a full DB break-glass; protect host env, rotate keys, never put it in Vite.
- **No object-level antivirus** on PDFs (magic bytes + MIME only).
- **No 2FA** for admin.
- **Supabase Auth** password policy may be weaker than app policy if users are created only via admin API (register goes through your validator). Password change in Settings is enforced in UI + same rules.
- **Health endpoint** is public (intentional).
- **Double-blind** is documented as a goal in SQL comments; UI undoes it (H-1).

---

## 9. What is already solid

- JWT verification via `getUser`, not trusting `req.body` for identity on delete/resubmit.
- Students cannot UPDATE journals via RLS; resubmit is server-side.
- File path prefix checks on student delete/resubmit.
- OTPs hashed; timing-safe compare on register/email-change.
- Permanent admin promote/demote/delete/ban guards.
- Private storage + signed URLs (when `safe_update_only` is applied).
- `published_issues` column allowlist + strip author emails.
- Paper-request honeypot; contact length limits; PDF magic-byte check on upload.
- Production `VITE_API_URL` fail-closed (no localhost fallback).
- Review retarget trigger; notification immutability; profile role freeze for self-update.
- Vercel security headers (CSP exists, but see H-4).
- Security tests for delete/resubmit guards.

---

## 10. Suggested fix order

1. **C-1:** In `verifyResetOTP`, set `isExpired` / `isWrongOtp` the same way as email-change (and add a test that a valid OTP changes the password).
2. **C-2:** Paper-request handler: journal must be `published`.
3. **H-1:** Use `get_assigned_journals_for_reviewer()`; drop `profiles(name)` from reviewer queries; strip reviewer names from author review SELECT.
4. **H-2 / H-3:** Bind notify payloads to DB rows; restrict upload notify to `role = student`.
5. **H-4:** Remove localhost from production CSP; avoid `unsafe-inline` (nonces/hashes).
6. **H-5:** Make `schema.sql` storage policies match production, or fail CI if bootstrap policies differ.
7. Unify register-otp responses; strengthen OTP; bind paper-delivery to `request id`; add `is_open` admin control if missing; fix dashboard counts.

---

## 11. File map (for maintainers)

| Area | Files |
|---|---|
| Routes / guards | `frontend/src/App.jsx` |
| Auth client | `frontend/src/context/AuthContext.jsx`, `pages/Login.jsx`, `Register.jsx`, `ForgotPassword.jsx` |
| API helper | `frontend/src/lib/api.js`, `storage.js`, `supabase.js` |
| Express | `backend/index.js`, `middleware/requireAuth.js` |
| OTP | `backend/controllers/authController.js` |
| Email | `backend/controllers/notifyController.js`, `utils/mailer.js`, `utils/emailTemplates.js` |
| Resubmit | `backend/controllers/resubmitController.js` |
| Schema | `backend/SQL_Query/schema.sql`, `safe_update_only.sql` |

---

*End of report. No secrets from `.env` are included. Re-run this audit after applying `safe_update_only.sql` on production and after fixing C-1/C-2.*
