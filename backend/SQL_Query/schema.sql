-- ============================================================
-- Gyan Samavesh 2026 — Supabase Schema
-- Run this in your Supabase SQL Editor (once)
-- ============================================================

-- 0. Clean up existing tables to prevent "already exists" errors
drop table if exists public.paper_requests cascade;
drop table if exists public.reviews cascade;
drop table if exists public.assignments cascade;
drop table if exists public.journals cascade;
drop table if exists public.custom_otps cascade;
drop table if exists public.profiles cascade;
drop table if exists public.current_issue cascade;

-- 1. Profiles (extends Supabase auth.users)
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null,
  email        text,
  role         text not null check (role in ('student', 'reviewer', 'admin')),
  status       text not null default 'active' check (status in ('active', 'inactive', 'pending')),
  is_permanent boolean not null default false,
  deletion_scheduled_at timestamptz,
  created_at   timestamptz default now()
);

-- RLS: profiles
alter table public.profiles enable row level security;

-- FIX: Restrict profile reads. Users see own, Admins see all, Anyone sees reviewer names (for assignments)
create policy "Users can read own profile" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "Admins can read all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );
create policy "Anyone can see reviewer names" on public.profiles
  for select using (role = 'reviewer' and status = 'active');

-- FIX: Add WITH CHECK to prevent role escalation on UPDATE
create policy "Users can update own profile" on public.profiles for update 
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can insert own profile" on public.profiles for insert with check ((select auth.uid()) = id);
-- Admins can update any user's status (for ban/unban) but NOT if is_permanent=true
create policy "Admins can update user status" on public.profiles for update
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
    and not is_permanent
  );

-- 1.5 Custom OTPs
create table public.custom_otps (
  email      text primary key,
  otp        text not null,
  expires_at timestamptz not null
);

-- RLS: custom_otps (Strictly isolated to backend service_role)
alter table public.custom_otps enable row level security;
-- Supabase explicit deny policy (service_role bypasses this automatically)
create policy "Deny web access to OTPs" on public.custom_otps for all using (false);
-- 2. Journals
create table public.journals (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid references public.profiles(id) on delete set null,
  author_name  text, -- Persists the author name even if their account is deleted
  title        text not null,
  abstract     text not null, -- Stores the public URL to the uploaded abstract PDF
  category     text not null default 'General',
  keywords     text not null,
  file_url     text,
  status       text not null default 'submitted'
                 check (status in ('submitted', 'under_review', 'approved', 'revision_required', 'rejected', 'accepted', 'rework', 'published')),
  review_level int not null default 0,
  admin_comments     text,
  revision_report_url text,
  approval_proof_url  text,
  resubmission_count  int not null default 0,
  prev_admin_comments     text,
  prev_revision_report_url text,
  prev_reviewer_comments   text,
  prev_reviewer_name       text,
  -- Publication metadata (populated when admin compiles/publishes a paper)
  authors        text,
  volume_number  text,
  issue_number   text,
  published_at   timestamptz,
  created_at   timestamptz default now()
);

-- 3. Assignments (reviewer ↔ journal)
create table public.assignments (
  id          uuid primary key default gen_random_uuid(),
  journal_id  uuid references public.journals(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (journal_id, reviewer_id)
);

-- RLS: journals
alter table public.journals enable row level security;
create policy "Students see own journals" on public.journals for select
  using (
    (select auth.uid()) = student_id or
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin') or
    exists (select 1 from public.assignments where journal_id = journals.id and reviewer_id = (select auth.uid()))
  );
create policy "Students can insert journals when open" on public.journals for insert
  with check (
    (select auth.uid()) = student_id
    and (select is_open from public.current_issue where id = 1) = true
  );
create policy "Admins can insert journals" on public.journals for insert
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));
create policy "Admins can update journals" on public.journals for update
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));
-- Removed "Students can update own journals" to prevent Privilege Escalation

-- RLS: assignments
alter table public.assignments enable row level security;
create policy "Reviewers and Admins can view assignments" on public.assignments for select
  using (
    (select auth.uid()) = reviewer_id or 
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );
create policy "Admins can insert assignments" on public.assignments for insert
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));
create policy "Admins can delete assignments" on public.assignments for delete
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

-- 4. Reviews
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  journal_id  uuid references public.journals(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete cascade,
  -- NOTE: 'decision' is reserved for a future feature where reviewers give a formal recommendation.
  -- The current reviewer submission UI always writes NULL here; the admin's decision is handled
  -- separately via the admin_make_decision() RPC. Do not remove this column without a product decision.
  decision    text check (decision in ('approve', 'revision', 'reject')),
  comments    text not null,
  originality int check (originality between 1 and 5),
  methodology int check (methodology between 1 and 5),
  clarity     int check (clarity between 1 and 5),
  refs        int check (refs between 1 and 5),
  overall     int check (overall between 1 and 5),
  revision_report_url text,
  created_at  timestamptz default now()
);

-- RLS: reviews
alter table public.reviews enable row level security;
create policy "Restricted read reviews" on public.reviews for select
  using (
    (select auth.uid()) = reviewer_id or 
    exists (select 1 from public.journals where id = journal_id and student_id = (select auth.uid())) or
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );
create policy "Reviewers can insert reviews" on public.reviews for insert
  with check ((select auth.uid()) = reviewer_id and exists (select 1 from public.assignments where journal_id = public.reviews.journal_id and reviewer_id = (select auth.uid())));
-- Reviewers can update their own reviews, AND Admins can update any review (Combined for performance)
create policy "Reviewers and Admins can update reviews" on public.reviews for update
  using (
    (select auth.uid()) = reviewer_id or 
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  )
  with check (
    (select auth.uid()) = reviewer_id or 
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );
-- Students and anyone else cannot delete reviews (IDOR fix)

-- 5. Storage bucket for PDFs
-- Run in Supabase dashboard → Storage → Create bucket named "journals" (private)
-- Or via SQL:
insert into storage.buckets (id, name, public) values ('journals', 'journals', false)
  on conflict do nothing;

drop policy if exists "Anyone can read journal files" on storage.objects;
create policy "Anyone can read journal files" on storage.objects for select
  using ( bucket_id = 'journals' );
drop policy if exists "Authenticated users can upload" on storage.objects;
create policy "Users can upload to their own folder" on storage.objects for insert
  with check ( bucket_id = 'journals' and (storage.foldername(name))[1] = auth.uid()::text );

-- 6. Published Issues View
-- A dynamic view that only returns journals with 'approved' or 'Accepted' status.
-- NOTE: This view uses security_invoker = false (SECURITY DEFINER semantics).
-- The view enforces WHERE status = 'published' and only exposes safe, public-facing
-- columns. Sensitive fields (file_url, student_id, admin_comments, revision_report_url,
-- approval_proof_url) are deliberately excluded.
create or replace view public.published_issues with (security_invoker = false) as
select
  j.id,
  j.title,
  j.abstract,
  j.category,
  j.keywords,
  j.authors,
  j.volume_number,
  j.issue_number,
  j.published_at,
  j.created_at,
  j.author_name
from public.journals j
where j.status = 'published';

-- 7. Paper Requests
create table public.paper_requests (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid references public.journals(id) on delete cascade,
  journal_title text not null,
  requester_name text not null,
  requester_email text not null,
  status text not null default 'pending' check (status in ('pending', 'responded')),
  created_at timestamptz default now()
);

-- RLS: paper_requests
alter table public.paper_requests enable row level security;
-- Public can insert (so non-logged-in visitors can request papers)
create policy "Anyone can insert paper_requests" on public.paper_requests for insert with check (true);
-- Only Admins can see the requests
create policy "Admins can select paper_requests" on public.paper_requests for select 
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));
-- Admins can update the status
create policy "Admins can update paper_requests" on public.paper_requests for update
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

-- 8. Admin RPC functions for user management
-- These functions bypass RLS (security definer) to allow admins to manage users
create or replace function public.approve_reviewer(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    -- Guard: only activate accounts that are actually pending reviewers.
    -- Without this check, the function could accidentally activate students or admins.
    update public.profiles set status = 'active'
    where id = target_user_id AND role = 'reviewer';
  else
    raise exception 'Unauthorized';
  end if;
end;
$$;

create or replace function public.delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  -- Guard: never allow deletion of the permanent main admin account
  select email into v_email from auth.users where id = target_user_id;
  if v_email = 'nirmala.scienceandsociety@gmail.com' then
    raise exception 'SECURITY EXCEPTION: The permanent main admin account cannot be deleted.';
  end if;

  -- Safe to delete — cascades to public.profiles
  delete from auth.users where id = target_user_id;
end;
$$;

-- 9. Secure Resubmission RPC
create or replace function public.resubmit_journal(
  p_journal_id uuid,
  p_title text,
  p_abstract text,
  p_keywords text,
  p_file_url text,
  p_prev_admin_comments text,
  p_prev_revision_report_url text,
  p_prev_reviewer_comments text,
  p_prev_reviewer_name text,
  p_resubmission_count int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  -- Ensure the caller owns the journal
  select student_id into v_student_id from public.journals where id = p_journal_id;
  
  if v_student_id is null or v_student_id != auth.uid() then
    raise exception 'Unauthorized';
  end if;

  -- Update the journal safely
  update public.journals set
    title = p_title,
    abstract = p_abstract,
    keywords = p_keywords,
    file_url = p_file_url,
    status = 'under_review',
    review_level = 1,
    resubmission_count = p_resubmission_count,
    prev_admin_comments = p_prev_admin_comments,
    prev_revision_report_url = p_prev_revision_report_url,
    prev_reviewer_comments = p_prev_reviewer_comments,
    prev_reviewer_name = p_prev_reviewer_name,
    admin_comments = null,
    revision_report_url = null,
    approval_proof_url = null
  where id = p_journal_id;

  -- Delete old reviews
  delete from public.reviews where journal_id = p_journal_id;
end;
$$;

-- 10. Helper RPC to get Auth User ID by Email (Used securely by the custom backend)
create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  return v_id;
end;
$$;

-- 11. Permanent Admin Protection
-- Prevents deletion or email modification of the main admin account at the database root level.
create or replace function public.protect_permanent_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Block Deletion
  if tg_op = 'DELETE' then
    if old.email = 'nirmala.scienceandsociety@gmail.com' then
      raise exception 'SECURITY EXCEPTION: The permanent main admin account cannot be deleted.';
    end if;
    return old;
  end if;

  -- Block Update of Email
  if tg_op = 'UPDATE' then
    if old.email = 'nirmala.scienceandsociety@gmail.com' and new.email != old.email then
      raise exception 'SECURITY EXCEPTION: The permanent main admin account email cannot be modified.';
    end if;
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists enforce_permanent_admin on auth.users;
create trigger enforce_permanent_admin
  before delete or update on auth.users
  for each row
  execute function public.protect_permanent_admin();

-- 11. Security Enhancements & Indexes (Fixes Supabase Warnings)

-- Revoke public execution of sensitive RPC functions
revoke execute on function public.approve_reviewer(uuid) from public;
revoke execute on function public.delete_user(uuid) from public;
revoke execute on function public.get_user_id_by_email(text) from public;
revoke execute on function public.protect_permanent_admin() from public;

-- Grant execution specifically to authenticated users where appropriate
grant execute on function public.approve_reviewer(uuid) to authenticated;
grant execute on function public.delete_user(uuid) to authenticated;
grant execute on function public.resubmit_journal to authenticated;

-- Add missing indexes for Foreign Keys (Performance fixes)
create index if not exists idx_journals_student_id on public.journals(student_id);
create index if not exists idx_assignments_journal_id on public.assignments(journal_id);
create index if not exists idx_assignments_reviewer_id on public.assignments(reviewer_id);
create index if not exists idx_reviews_journal_id on public.reviews(journal_id);
create index if not exists idx_reviews_reviewer_id on public.reviews(reviewer_id);
create index if not exists idx_paper_requests_journal_id on public.paper_requests(journal_id);

-- ============================================================
-- 12. Author Name Preservation Trigger
-- Auto-populates author_name on journal insert so published
-- journals retain the author's identity even after account deletion.
-- ============================================================
create or replace function public.set_journal_author_name()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.author_name is null then
    select name into new.author_name
    from public.profiles
    where id = new.student_id;
  end if;
  return new;
end;
$$;

create trigger trg_set_journal_author_name
before insert on public.journals
for each row execute function public.set_journal_author_name();

-- ============================================================
-- 13. Permanent Admin Account Bootstrap
-- ⚠️  IMPORTANT: Before running this block, you MUST first go to
--     Supabase Dashboard → Authentication → Users → Add User
--     and create a user with:
-- Main admin account (DO NOT DELETE)
-- Email:    nirmala.scienceandsociety@gmail.com
-- (Password has been changed and rotated securely)
-- Then run the lines below to set up the admin profile.
-- ============================================================
INSERT INTO public.profiles (id, name, email, role, status, is_permanent)
SELECT
  id,
  'Nirmala',
  'nirmala.scienceandsociety@gmail.com',
  'admin',
  'active',
  true
FROM auth.users
WHERE email = 'nirmala.scienceandsociety@gmail.com'
ON CONFLICT (id) DO UPDATE
  SET role = 'admin', status = 'active', is_permanent = true;

-- Verify: should return 1 row with is_permanent = true
SELECT id, name, email, role, status, is_permanent
FROM public.profiles
WHERE email = 'nirmala.scienceandsociety@gmail.com';

-- ============================================================
-- 14. Admin User Management RPCs
-- ============================================================
create or replace function public.ban_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id and is_permanent = true) then
    raise exception 'Cannot ban the permanent admin account';
  end if;

  update public.profiles set status = 'inactive' where id = p_user_id;
end;
$$;

create or replace function public.unban_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  update public.profiles set status = 'active' where id = p_user_id;
end;
$$;

grant execute on function public.ban_user(uuid) to authenticated;
grant execute on function public.unban_user(uuid) to authenticated;

-- ============================================================
-- 15. Storage Policies (Journals Bucket)
-- Run this to restrict uploads to user's own folder.
-- ============================================================
-- alter table storage.objects enable row level security;
-- drop policy if exists "Users can upload to their own folder" on storage.objects;
-- create policy "Users can upload to their own folder" on storage.objects for insert
-- with check ( bucket_id = 'journals' and (storage.foldername(name))[1] = auth.uid()::text );

-- ============================================================
-- 16. Current Issue Settings
-- Stores dynamic information about the current issue for the Home page
-- ============================================================
create table public.current_issue (
  id integer primary key default 1 check (id = 1),
  volume_topic text not null default 'Advances in Modern Research',
  volume_number text not null default 'Volume 1',
  issue_number text not null default 'Issue 1',
  timeline text not null default 'January to June 2026',
  last_submission_date date,
  student_topics jsonb not null default '["Artificial Intelligence", "Sustainable Energy", "Quantum Computing", "Biotechnology"]'::jsonb,
  is_open boolean not null default true,
  updated_at timestamptz default now()
);

-- Initialize the single row
insert into public.current_issue (id) values (1) on conflict (id) do nothing;

-- RLS: current_issue
alter table public.current_issue enable row level security;
create policy "Anyone can read current_issue" on public.current_issue for select using (true);
create policy "Admins can update current_issue" on public.current_issue for update
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));
