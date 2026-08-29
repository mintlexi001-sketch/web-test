/**
 * Integration tests for the security-critical backend paths.
 * Uses Vitest (ESM) + Supertest + vi.mock for Supabase.
 *
 * Targeted paths (highest regression risk per audit):
 *   1. POST /api/student/journals/:id/delete — ownership + status + filepath guards
 *   2. POST /api/admin/journals/:id/delete   — admin role + status guard
 *   3. POST /api/student/resubmit            — ownership, state-machine, filepath, length guards
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// ── Constants ──────────────────────────────────────────────────────────────
const STUDENT_ID = 'student-uuid-111';
const ADMIN_ID   = 'admin-uuid-999';
const JOURNAL_ID = 'journal-uuid-abc';

// ── Build a fluent Supabase query-chain mock ───────────────────────────────
function buildChain(resolvedValue) {
  const eqDelete = vi.fn().mockResolvedValue({ data: null, error: null });
  const chain = {
    select:      vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    neq:         vi.fn().mockReturnThis(),
    order:       vi.fn().mockReturnThis(),
    limit:       vi.fn().mockReturnThis(),
    in:          vi.fn().mockReturnThis(),
    single:      vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
    insert:      vi.fn().mockResolvedValue({ data: null, error: null }),
    update:      vi.fn().mockReturnThis(),
    delete:      vi.fn().mockReturnValue({ eq: eqDelete }),
  };
  return chain;
}

// ── Shared mock Supabase client ────────────────────────────────────────────
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser:      vi.fn(),
    admin: { getUserById: vi.fn() },
  },
  storage: {
    from: vi.fn().mockReturnValue({
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
};

// ── Mock @supabase/supabase-js ─────────────────────────────────────────────
// Mutate the CJS module directly so all subsequent requires get the mock.
const supabaseJs = require('@supabase/supabase-js');
supabaseJs.createClient = vi.fn(() => mockSupabase);

// ── Stub env vars BEFORE app import ───────────────────────────────────────
process.env.SUPABASE_URL              = 'https://placeholder.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'placeholder';
process.env.EMAIL_USER                = 'test@example.com';
process.env.EMAIL_PASS                = 'test_pass';
process.env.FRONTEND_URL              = 'http://localhost:5173';

const app = require('../index.js');

// ── Helpers ────────────────────────────────────────────────────────────────
const AUTH_HEADER = { Authorization: 'Bearer fake-jwt-token' };

function setupAuth(userId) {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
  mockSupabase.auth.admin.getUserById.mockResolvedValue({
    data: { user: { id: userId, email: `${userId}@test.com` } },
    error: null,
  });
}

function setupFrom(scenarioMap) {
  mockSupabase.from.mockImplementation((table) => {
    if (scenarioMap[table]) return scenarioMap[table]();
    return buildChain({ data: null, error: null });
  });
}


// ══════════════════════════════════════════════════════════════════════════
// 1. Student Delete
// ══════════════════════════════════════════════════════════════════════════
describe('POST /api/student/journals/:id/delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 — unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'No user' } });
    const res = await request(app).post(`/api/student/journals/${JOURNAL_ID}/delete`).set(AUTH_HEADER);
    expect(res.status).toBe(401);
  });

  it('403 — student does not own the journal (IDOR guard)', async () => {
    setupAuth(STUDENT_ID);
    setupFrom({
      profiles: () => buildChain({ data: { role: 'student', status: 'active' }, error: null }),
      journals: () => buildChain({ data: { student_id: 'other-user', status: 'pending', file_url: 'other/file.pdf' }, error: null }),
    });
    const res = await request(app).post(`/api/student/journals/${JOURNAL_ID}/delete`).set(AUTH_HEADER);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/);
  });

  it('400 — journal already sent for review (status guard)', async () => {
    setupAuth(STUDENT_ID);
    setupFrom({
      profiles: () => buildChain({ data: { role: 'student', status: 'active' }, error: null }),
      journals: () => buildChain({ data: { student_id: STUDENT_ID, status: 'under_review', file_url: STUDENT_ID + '/f.pdf' }, error: null }),
    });
    const res = await request(app).post(`/api/student/journals/${JOURNAL_ID}/delete`).set(AUTH_HEADER);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot delete/);
  });

  it('CRITICAL 403 — file path does not belong to student (filepath guard)', async () => {
    // Regression test: weakening the startsWith(userId+'/') check would silently
    // let a student delete another user's file via a forged DB record.
    setupAuth(STUDENT_ID);
    setupFrom({
      profiles: () => buildChain({ data: { role: 'student', status: 'active' }, error: null }),
      journals: () => buildChain({ data: { student_id: STUDENT_ID, status: 'pending', file_url: 'other-user/malicious.pdf' }, error: null }),
    });
    const res = await request(app).post(`/api/student/journals/${JOURNAL_ID}/delete`).set(AUTH_HEADER);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/file path/);
  });

  it('200 — valid owned pending journal', async () => {
    setupAuth(STUDENT_ID);
    setupFrom({
      profiles: () => buildChain({ data: { role: 'student', status: 'active' }, error: null }),
      journals: () => buildChain({ data: { student_id: STUDENT_ID, status: 'pending', file_url: STUDENT_ID + '/paper.pdf' }, error: null }),
    });
    const res = await request(app).post(`/api/student/journals/${JOURNAL_ID}/delete`).set(AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});


// ══════════════════════════════════════════════════════════════════════════
// 2. Admin Delete
// ══════════════════════════════════════════════════════════════════════════
describe('POST /api/admin/journals/:id/delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403 — non-admin authenticated user', async () => {
    setupAuth(STUDENT_ID);
    setupFrom({ profiles: () => buildChain({ data: { role: 'student', status: 'active' }, error: null }) });
    const res = await request(app).post(`/api/admin/journals/${JOURNAL_ID}/delete`).set(AUTH_HEADER);
    expect(res.status).toBe(403);
  });

  it('403 — admin with inactive (banned) status', async () => {
    setupAuth(ADMIN_ID);
    setupFrom({ profiles: () => buildChain({ data: { role: 'admin', status: 'inactive' }, error: null }) });
    const res = await request(app).post(`/api/admin/journals/${JOURNAL_ID}/delete`).set(AUTH_HEADER);
    expect(res.status).toBe(403);
  });

  it('200 — valid active admin', async () => {
    setupAuth(ADMIN_ID);
    setupFrom({
      profiles: () => buildChain({ data: { role: 'admin', status: 'active' }, error: null }),
      journals: () => buildChain({ data: { file_url: ADMIN_ID + '/paper.pdf', revision_report_url: null, approval_proof_url: null }, error: null }),
    });
    const res = await request(app).post(`/api/admin/journals/${JOURNAL_ID}/delete`).set(AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});


// ══════════════════════════════════════════════════════════════════════════
// 3. Resubmit
// ══════════════════════════════════════════════════════════════════════════
describe('POST /api/student/resubmit', () => {
  beforeEach(() => vi.clearAllMocks());

  const BASE = {
    journalId: JOURNAL_ID,
    title: 'Revised Paper Title',
    abstract: 'Updated abstract text.',
    keywords: 'science, society',
    fileUrl: `${STUDENT_ID}/revised.pdf`,
    studentName: 'Test Student',
  };

  it('401 — unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'No user' } });
    const res = await request(app).post('/api/student/resubmit').set(AUTH_HEADER).send(BASE);
    expect(res.status).toBe(401);
  });

  it('403 — student does not own the journal (IDOR guard)', async () => {
    setupAuth(STUDENT_ID);
    setupFrom({
      profiles: () => buildChain({ data: { role: 'student', status: 'active' }, error: null }),
      journals: () => buildChain({ data: { id: JOURNAL_ID, student_id: 'someone-else', status: 'revision_required', resubmission_count: 0 }, error: null }),
    });
    const res = await request(app).post('/api/student/resubmit').set(AUTH_HEADER).send(BASE);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/do not own/);
  });

  it('400 — journal not in resubmittable state', async () => {
    setupAuth(STUDENT_ID);
    setupFrom({
      profiles: () => buildChain({ data: { role: 'student', status: 'active' }, error: null }),
      journals: () => buildChain({ data: { id: JOURNAL_ID, student_id: STUDENT_ID, status: 'pending', resubmission_count: 0 }, error: null }),
    });
    const res = await request(app).post('/api/student/resubmit').set(AUTH_HEADER).send(BASE);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not in a resubmittable state/);
  });

  it('CRITICAL 403 — fileUrl does not belong to student (filepath guard)', async () => {
    setupAuth(STUDENT_ID);
    setupFrom({
      profiles: () => buildChain({ data: { role: 'student', status: 'active' }, error: null }),
      journals: () => buildChain({ data: { id: JOURNAL_ID, student_id: STUDENT_ID, status: 'revision_required', resubmission_count: 0 }, error: null }),
    });
    const res = await request(app).post('/api/student/resubmit').set(AUTH_HEADER)
      .send({ ...BASE, fileUrl: 'other-student/hijacked.pdf' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/fileUrl must be in your own/);
  });

  it('400 — title exceeds 255 characters (length guard)', async () => {
    setupAuth(STUDENT_ID);
    setupFrom({
      profiles: () => buildChain({ data: { role: 'student', status: 'active' }, error: null }),
      journals: () => buildChain({ data: { id: JOURNAL_ID, student_id: STUDENT_ID, status: 'revision_required', resubmission_count: 0 }, error: null }),
    });
    const res = await request(app).post('/api/student/resubmit').set(AUTH_HEADER)
      .send({ ...BASE, title: 'T'.repeat(256) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too long/);
  });

  it('400 — abstract exceeds 5000 characters (length guard)', async () => {
    setupAuth(STUDENT_ID);
    setupFrom({
      profiles: () => buildChain({ data: { role: 'student', status: 'active' }, error: null }),
      journals: () => buildChain({ data: { id: JOURNAL_ID, student_id: STUDENT_ID, status: 'revision_required', resubmission_count: 0 }, error: null }),
    });
    const res = await request(app).post('/api/student/resubmit').set(AUTH_HEADER)
      .send({ ...BASE, abstract: 'A'.repeat(5001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too long/);
  });
});
