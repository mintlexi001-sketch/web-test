# SQL Migration Guide

## Which file represents the current production schema?

**`safe_update_only.sql`** is the canonical, authoritative, **current** migration file. It contains the complete, idempotent set of all RLS policies, storage bucket configuration, RPCs, triggers, and views that should be applied to any live Supabase project. It uses `DROP POLICY IF EXISTS` + `CREATE POLICY`, `CREATE OR REPLACE FUNCTION`, and `ON CONFLICT DO UPDATE` throughout — it is safe to re-run and will bring any project to the current correct state.

## How to set up a fresh Supabase project

Run **both** files in this order in the Supabase SQL editor:

1. **`schema.sql`** — Creates all tables (including the `authors`, `volume_number`, `issue_number`, and `published_at` columns on `journals`), enables RLS, and creates the base storage bucket. Run this once on a blank database.
2. **`safe_update_only.sql`** — Applies all security patches, updated RLS policies, RPCs, triggers, views, and the final storage bucket configuration (private, PDF-only, 10 MB limit). Also defines the 5 core editorial RPCs (`assign_reviewer_to_journal`, `admin_make_decision`, `unassign_reviewer_from_journal`, `unpublish_journal`, `admin_compile_issue`) required for the full editorial pipeline. Run this immediately after `schema.sql`.

> ⚠️ **Do NOT run `schema.sql` against an existing, live database** — it contains `DROP TABLE ... CASCADE` statements at the top that will destroy all data. It is a bootstrap script only.

## Historical migration files (do not run on existing databases)

These files are kept for audit-trail purposes only. Their content has been fully superseded and merged into `safe_update_only.sql`.

| File | Purpose | Status |
|---|---|---|
| `migration_v2.sql` | Added columns / minor schema additions | ✅ Superseded by `safe_update_only.sql` |
| `migration_v3.sql` | Further column and policy additions | ✅ Superseded by `safe_update_only.sql` |
| `migration_rework.sql` | Restructured the reviewer assignment flow | ✅ Superseded by `safe_update_only.sql` |
| `pass4_security_patch.sql` | Fixed the `approve_reviewer` RPC and added the `published_issues` view | ✅ Superseded by `safe_update_only.sql` |
| `audit_fixes.sql` | Applied security findings from the first audit pass; defined core editorial RPCs | ✅ All RPCs merged into `safe_update_only.sql` §16 (as of this update). This file is fully retired. |

## Known Live-DB Drift

A `verification_tokens` table and a `generate_verification_token()` function may exist in the live Supabase project (referenced in cleanup/REVOKE statements in `safe_update_only.sql` §11). Neither is defined in any version-controlled schema file — they are undocumented legacy objects. A fresh deployment from this repo will silently skip those guards (they are wrapped in `IF EXISTS` checks), while the live production DB retains the objects. This is safe but worth investigating during the next live DB diff audit.

## Archive

`archive/supabase_cron_job.deprecated.sql` — **Do not run.** A deprecated pg_cron job superseded by a Supabase Scheduled Edge Function.

