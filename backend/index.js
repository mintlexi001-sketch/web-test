require('dotenv').config();
const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
}

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const { sendRegisterOTP, verifyRegisterOTP, sendResetOTP, verifyResetOTP, sendEmailChangeOTP, verifyEmailChangeOTP, cancelDeletion } = require('./controllers/authController');
const { notifyUpload, notifyAssign, notifyReview, notifyDecision, notifyBan, notifyUnban, notifyAccountDeleted, notifyReviewerApproved, notifyReviewerRejected, notifySentForReview, notifyRework, notifyResubmit, notifyPublish, notifyPaperRequest, notifyPaperRequestRejected, notifyPaperDelivery, notifyPaperDeleted, notifyContact, replyContact } = require('./controllers/notifyController');
const { resubmitJournal } = require('./controllers/resubmitController');
const { requireAuth, requireAdmin } = require('./middleware/requireAuth');
// node-cron removed: does not work on Vercel serverless. The account deletion cron
// is replaced by a Supabase Scheduled Edge Function (see HOSTING.md for setup).
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Shared Storage Helpers ──────────────────────────────────────────
// Extract a bare storage path from either a full Supabase URL or an already-bare path.
// Returns null if the URL is falsy or does not contain a recognisable /journals/ segment.
function extractStoragePath(url) {
  if (!url) return null;
  // New records store a bare path (e.g. uuid/timestamp_file.pdf)
  if (!url.startsWith('http')) return url.split('?')[0];
  // Legacy records stored full Supabase URLs — strip down to just the path
  try {
    const parts = url.split('/journals/');
    if (parts.length > 1) return parts[1].split('?')[0];
    return null;
  } catch { return null; }
}

// Remove an array of storage paths from the 'journals' bucket.
// Logs but does NOT throw on storage failure — a missing file is an orphan,
// not a reason to surface a 500 to the caller when the DB record is already gone.
async function removeStorageFiles(paths) {
  if (!paths || paths.length === 0) return;
  const { error } = await supabase.storage.from('journals').remove(paths);
  if (error) console.error('Storage Deletion Error (Orphaned File):', error);
}


const app = express();

// Secure HTTP Headers with explicit Content Security Policy (U-7 fix)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'none'"],
      imgSrc: ["'none'"],
      connectSrc: ["'self'"],
      fontSrc: ["'none'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'none'"],
    },
  },
  // Prevent browsers from sniffing MIME type
  noSniff: true,
  // Enforce HTTPS for 1 year
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  // Disable X-Powered-By
  hidePoweredBy: true,
}));

// Secure CORS: In production (FRONTEND_URL is set), only allow that origin.
// In development (no FRONTEND_URL), allow localhost as usual.
// API-003: Removing hardcoded localhost from production CORS prevents
// a deployed user's browser from being able to hit a rogue localhost service.
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Vercel internal calls)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Return a plain false (not an Error) so cors() will NOT pass to Express error handler.
    // We also attach a marker so we can send a clean 403 via the corsBlocker middleware below.
    const err = new Error('CORS Policy: Origin not allowed');
    err.status = 403;
    return callback(err, false);
  },
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// CORS error handler — must come immediately after the cors() middleware.
// Without this, Express' generic handler would return 500 for rejected origins.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.status === 403) {
    return res.status(403).json({ error: 'CORS: Origin not allowed' });
  }
  next(err);
});

app.use(express.json({ limit: '1mb' }));

// Health Check Endpoint (Required for Railway/Render/Vercel)
// API-005: Do not expose internal timing (uptime) in the response.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Rate limiter for OTP & public endpoints to prevent brute force & spam
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15, // Limit each IP to 15 requests per 10-minute window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter to prevent bot floods on authenticated routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // Limit each IP to 150 requests per 15-minute window
  message: { error: 'Too many API requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiters
app.use('/api', apiLimiter);
app.use('/api/auth', otpLimiter);

// Auth Routes (Custom OTP via Nodemailer)
app.post('/api/auth/register-otp', sendRegisterOTP);
app.post('/api/auth/verify-register', verifyRegisterOTP);
app.post('/api/auth/reset-otp', sendResetOTP);
app.post('/api/auth/verify-reset', verifyResetOTP);
// Protected Auth Routes
app.post('/api/auth/email-change-otp', requireAuth, sendEmailChangeOTP);
app.post('/api/auth/verify-email-change', requireAuth, verifyEmailChangeOTP);
app.post('/api/auth/cancel-deletion', requireAuth, cancelDeletion);

// Public Notification Routes (Rate limited)
app.post('/api/notify/paper-request', otpLimiter, notifyPaperRequest);
app.post('/api/notify/contact', otpLimiter, notifyContact);

// Notification Routes (Protected)
app.use('/api/notify', requireAuth);

// Admin-only notification routes
app.post('/api/notify/assign', requireAdmin, notifyAssign);
app.post('/api/notify/decision', requireAdmin, notifyDecision);
app.post('/api/notify/ban', requireAdmin, notifyBan);
app.post('/api/notify/unban', requireAdmin, notifyUnban);
app.post('/api/notify/reviewer-approved', requireAdmin, notifyReviewerApproved);
app.post('/api/notify/reviewer-rejected', requireAdmin, notifyReviewerRejected);
app.post('/api/notify/sent-for-review', requireAdmin, notifySentForReview);
app.post('/api/notify/rework', requireAdmin, notifyRework);
app.post('/api/notify/publish', requireAdmin, notifyPublish);
app.post('/api/notify/paper-request-rejected', requireAdmin, notifyPaperRequestRejected);
app.post('/api/notify/paper-delivery', requireAdmin, notifyPaperDelivery);
app.post('/api/notify/paper-deleted', requireAdmin, notifyPaperDeleted);
// delete-account moved here: admin-only because only admin triggers this notification
app.post('/api/notify/delete-account', requireAdmin, notifyAccountDeleted);
app.post('/api/notify/reply-contact', requireAdmin, replyContact);

// Authenticated-user notification routes (auth + rate-limited to prevent email spam)
app.post('/api/notify/upload', requireAuth, otpLimiter, notifyUpload);
app.post('/api/notify/review', requireAuth, otpLimiter, notifyReview);
app.post('/api/notify/resubmit', requireAuth, otpLimiter, notifyResubmit);

// Secure Student Actions (require auth but performed by the student themselves)
app.post('/api/student/resubmit', requireAuth, resubmitJournal);

// Secure Admin Deletion Route
app.post('/api/admin/journals/:id/delete', requireAuth, requireAdmin, async (req, res) => {
  try {
    const journalId = req.params.id;

    // 1. Fetch only the actual storage-path columns — NOT abstract (which is plain text, not a file path)
    const { data: journal } = await supabase
      .from('journals')
      .select('file_url, revision_report_url, approval_proof_url')
      .eq('id', journalId)
      .single();
    if (!journal) {
      return res.status(404).json({ error: 'Journal not found' });
    }

    // 2. Extract and validate storage paths — only storage paths, never plain-text fields
    const filesToRemove = [
      extractStoragePath(journal.file_url),
      extractStoragePath(journal.revision_report_url),
      extractStoragePath(journal.approval_proof_url),
    ].filter(Boolean);

    // 3. Delete the Database Record (Service Role bypasses RLS)
    // SECURITY/DATA-CONSISTENCY: Delete DB record FIRST. If this fails, the file remains intact.
    // If DB deletion succeeds but storage fails, we leave an orphaned file (which is harmless)
    // rather than breaking the UI with a ghost database record pointing to a missing file.
    const { error: dbError } = await supabase.from('journals').delete().eq('id', journalId);
    if (dbError) throw dbError;

    await removeStorageFiles(filesToRemove);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Secure Delete Journal Error:', err);
    res.status(500).json({ error: 'Failed to delete journal' });
  }
});

// Secure Student Deletion Route
app.post('/api/student/journals/:id/delete', requireAuth, async (req, res) => {
  try {
    const journalId = req.params.id;
    const userId = req.user.id;

    // 1. Fetch only the actual storage-path columns — NOT abstract (which is plain text, not a file path)
    const { data: journal, error: fetchError } = await supabase
      .from('journals')
      .select('student_id, status, file_url')
      .eq('id', journalId)
      .single();

    if (fetchError || !journal) {
      return res.status(404).json({ error: 'Journal not found' });
    }

    if (journal.student_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this paper' });
    }

    if (journal.status !== 'pending' && journal.status !== 'submitted') {
      return res.status(400).json({ error: 'Cannot delete paper after it has been sent for review' });
    }

    // 2. Extract storage path and enforce strict ownership boundary.
    // Students may ONLY delete files inside their own UID folder.
    // This prevents the service-role from being weaponised against other users' files
    // even if file_url were somehow forged in the DB prior to the trigger fix.
    const filePath = extractStoragePath(journal.file_url);
    const filesToRemove = [];

    // SECURITY: Only delete if the path provably belongs to this user.
    // If the path doesn't start with the user's UID, refuse and log — do NOT delete.
    if (filePath) {
      if (!filePath.startsWith(userId + '/')) {
        console.error(`SECURITY: student ${userId} attempted to delete out-of-bound path: ${filePath}`);
        return res.status(403).json({ error: 'Forbidden: file path does not belong to you' });
      }
      filesToRemove.push(filePath);
    }

    // 3. Delete the Database Record (Service Role bypasses RLS)
    // SECURITY/DATA-CONSISTENCY: Delete DB record FIRST.
    const { error: dbError } = await supabase.from('journals').delete().eq('id', journalId);
    if (dbError) throw dbError;

    await removeStorageFiles(filesToRemove);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Secure Student Delete Journal Error:', err);
    res.status(500).json({ error: 'Failed to delete journal' });
  }
});

// Global Error Handler to prevent stack trace leaks
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Export app so Supertest (vitest) can import it without starting a server
module.exports = app;

// Start Express server on Render (persistent host — bind 0.0.0.0 for external traffic).
// Skip listen() during test runs so the test suite doesn't occupy a port.
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Email & Auth Server running on port ${PORT}`);
  });
}
