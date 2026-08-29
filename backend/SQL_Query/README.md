# SQL Migration Guide

## Which file represents the current production schema?

**`safe_update_only.sql`** is the canonical, authoritative, **current** migration file. It contains the complete, idempotent set of all RLS policies, storage bucket configuration, RPCs, triggers, and views that should be applied to any live Supabase project. It uses `DROP POLICY IF EXISTS` + `CREATE POLICY`, `CREATE OR REPLACE FUNCTION`, and `ON CONFLICT DO UPDATE` throughout — it is safe to re-run and will bring any project to the current correct state.

## How to set up a fresh Supabase project

Run **both** files in this order in the Supabase SQL editor:

1. **`schema.sql`** — Creates all tables, enables RLS, and creates the base storage bucket. Run this once on a blank database.
2. **`safe_update_only.sql`** — Applies all security patches, updated RLS policies, RPCs, triggers, views, and the final storage bucket configuration (private, PDF-only, 10 MB limit). Run this immediately after `schema.sql`.

> ⚠️ **Do NOT run `schema.sql` against an existing, live database** — it contains `DROP TABLE ... CASCADE` statements at the top that will destroy all data. It is a bootstrap script only.

## Historical migration files (do not run on existing databases)

These files are kept for audit-trail purposes. Their content has been fully superseded by `safe_update_only.sql`.

| File | Purpose |
|---|---|
| `migration_v2.sql` | Added columns / minor schema additions |
| `migration_v3.sql` | Further column and policy additions |
| `migration_rework.sql` | Restructured the reviewer assignment flow |
| `pass4_security_patch.sql` | Fixed the `approve_reviewer` RPC and added the `published_issues` view |
| `audit_fixes.sql` | Applied security findings from the first audit pass |

## Archive

`archive/supabase_cron_job.deprecated.sql` — **Do not run.** A deprecated pg_cron job superseded by a Supabase Scheduled Edge Function. See `archive/README.md` for details.
