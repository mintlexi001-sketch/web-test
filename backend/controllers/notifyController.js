const { sendMail } = require('../utils/mailer');
const { createClient } = require('@supabase/supabase-js');
const { 
  generateUploadNotification,
  generateUploadConfirmationStudent,
  generateAssignNotification,
  generateReviewCompleteNotification,
  generateReworkResubmittedNotification,
  generateDecisionNotification,
  generateBanNotification,
  generateUnbanNotification,
  generateAccountDeletedNotification,
  generateReviewerApprovalNotification,
  generateReviewerRejectionNotification,
  generateSentForReviewNotification,
  generateReworkNotification,
  generatePublishedNotification,
  generatePaperRequestAdminNotification,
  generatePaperRequestRejectedNotification,
  generatePaperDeletedNotification,
  generateContactNotification,
  generateContactReply,
  escHtml
} = require('../utils/emailTemplates');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const getEmailForUser = async (userId) => {
  if (!userId) return null;
  // Try auth user first
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (!error && data?.user?.email) return data.user.email;
  // Fallback to profiles table
  const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single();
  return profile?.email || null;
};

// esc is the canonical HTML-escape helper. Imported from emailTemplates.js
// so all backend email code shares a single source of truth.
const esc = escHtml;


const checkAdmin = async (userId) => {
  if (!userId) return false;
  // Check both role AND status — banned admins must not be able to act
  const { data } = await supabase.from('profiles').select('role, status').eq('id', userId).single();
  return data?.role === 'admin' && data?.status === 'active';
};

// Input validation helpers
const validateEmail = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validateString = (str, maxLen = 200) => typeof str === 'string' && str.trim().length > 0 && str.trim().length <= maxLen;

// Turnstile verification helper
const verifyTurnstile = async (token) => {
  if (!process.env.TURNSTILE_SECRET_KEY) {
    // SEC-003: Fail closed — a missing secret key means CAPTCHA is misconfigured.
    // Silently allowing requests here would disable CAPTCHA in production without operators knowing.
    console.error('CRITICAL: TURNSTILE_SECRET_KEY is not set. Blocking CAPTCHA-protected request.');
    return false;
  }
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token
      })
    });
    const data = await res.json();
    return data.success;
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return false;
  }
};

// ── Helper: insert in-app notification ────────────────────────────────
const insertNotification = async (userId, title, message, link) => {
  if (!userId) return;
  await supabase.from('notifications').insert({ user_id: userId, title, message, link });
};

// Helper: notify all admin profiles via in-app notification
const notifyAdminsInApp = async (title, message, link) => {
  const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
  if (admins && admins.length > 0) {
    const records = admins.map(a => ({ user_id: a.id, title, message, link }));
    await supabase.from('notifications').insert(records);
  }
};

exports.notifyUpload = async (req, res) => {
  const { studentName, journalTitle } = req.body;
  if (!validateString(journalTitle, 500)) return res.status(400).json({ error: 'Invalid journal title' });
  
  // SEC: Check if submissions are open before accepting notification
  const { data: issue } = await supabase.from('current_issue').select('is_open').eq('id', 1).single();
  if (!issue || !issue.is_open) {
    return res.status(403).json({ error: 'Paper submissions are currently closed.' });
  }

  const studentEmail = req.user?.email || (req.user?.id ? await getEmailForUser(req.user.id) : null);

  // 1. Notify Admin
  const htmlAdmin = generateUploadNotification(esc(studentName), esc(journalTitle));
  const adminSent = await sendMail(process.env.EMAIL_USER, 'New Journal Submission', htmlAdmin);

  // 2. Notify Student Confirmation (if email available)
  if (studentEmail) {
    const htmlStudent = generateUploadConfirmationStudent(esc(studentName), esc(journalTitle));
    await sendMail(studentEmail, 'Submission Received - Science & Society', htmlStudent);
  }

  // 3. In-app notification for student
  if (req.user?.id) {
    await insertNotification(req.user.id, 'Paper Submitted', `Your paper "${journalTitle}" has been submitted for editorial review.`, '/student/journals');
  }
  await notifyAdminsInApp('New Paper Submission', `A new paper "${journalTitle}" was submitted by ${studentName}.`, '/admin/reviewers');

  res.status(200).json({ success: true, adminSent });
};

exports.notifyAssign = async (req, res) => {
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { reviewerId, reviewerName, journalTitle, isRework } = req.body;
  const reviewerEmail = await getEmailForUser(reviewerId);
  if (!reviewerEmail) return res.status(404).json({ error: 'Reviewer not found' });
  
  const html = generateAssignNotification(esc(reviewerName), esc(journalTitle), isRework);
  const sent = await sendMail(reviewerEmail, isRework ? 'Reworked Paper Review Assignment' : 'New Review Assignment', html);
  
  const inAppTitle = isRework ? 'Reworked Paper Review Assignment' : 'New Review Assignment';
  const inAppMessage = isRework ? `You have been assigned to review the reworked paper "${journalTitle}".` : `You have been assigned to review "${journalTitle}".`;
  await insertNotification(reviewerId, inAppTitle, inAppMessage, '/reviewer/assigned');
  res.status(sent ? 200 : 500).json({ success: sent });
};

exports.notifyReview = async (req, res) => {
  const { journalId, studentId, reviewerName, journalTitle, decision } = req.body;

  // Security: journalId is mandatory — reject calls that omit it to prevent ownership bypass
  if (!journalId) {
    return res.status(400).json({ error: 'journalId is required' });
  }

  // Verify the caller is the reviewer actually assigned to this journal
  const { data: assignment } = await supabase
    .from('assignments')
    .select('id')
    .eq('journal_id', journalId)
    .eq('reviewer_id', req.user.id)
    .single();
  if (!assignment) {
    return res.status(403).json({ error: 'Forbidden: you are not assigned to this journal' });
  }

  // 1. Notify Admin/Chief that reviewer has submitted review report
  const htmlAdmin = generateReviewCompleteNotification('admin', esc(journalTitle), esc(decision), esc(reviewerName));
  const sent = await sendMail(process.env.EMAIL_USER, `Review Report Submitted for "${esc(journalTitle)}"`, htmlAdmin);

  // 2. Send in-app notification to all admins
  await notifyAdminsInApp('Review Report Submitted', `Reviewer ${reviewerName || 'assigned'} submitted a report for "${journalTitle}".`, '/admin/reports');

  // 3. Notify Author that their paper has been reviewed and is pending editorial decision
  if (studentId) {
    const studentEmail = await getEmailForUser(studentId);
    if (studentEmail) {
      const htmlAuthor = generateReviewCompleteNotification('student', esc(journalTitle), null, esc(reviewerName));
      await sendMail(studentEmail, `Your Paper Has Been Reviewed — "${esc(journalTitle)}"`, htmlAuthor);
    }
    // In-app notification for the author
    await insertNotification(
      studentId,
      'Paper Review Completed',
      `Your paper "${journalTitle}" has been reviewed. The editorial board will now make a final decision.`,
      '/student/journals'
    );
  }

  res.status(200).json({ success: true, sent });
};

exports.notifyResubmit = async (req, res) => {
  const { journalId, studentName, journalTitle } = req.body;

  // Security: journalId is mandatory — reject calls that omit it to prevent ownership bypass
  if (!journalId) {
    return res.status(400).json({ error: 'journalId is required' });
  }

  // Verify the caller actually owns the journal they claim to have resubmitted
  const { data: journal } = await supabase
    .from('journals')
    .select('student_id')
    .eq('id', journalId)
    .single();
  if (!journal || journal.student_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden: you do not own this journal' });
  }

  // Notify Admin/Chief that paper assigned for rework was resubmitted
  const htmlAdmin = generateReworkResubmittedNotification(esc(studentName), esc(journalTitle));
  const sent = await sendMail(process.env.EMAIL_USER, `Reworked Paper Resubmitted: "${esc(journalTitle)}"`, htmlAdmin);

  // Send in-app notification to all admins
  await notifyAdminsInApp(
    'Reworked Paper Resubmitted',
    `Author ${studentName || 'Author'} resubmitted the reworked paper "${journalTitle}". Please assign a reviewer.`,
    '/admin/reviewers'
  );

  res.status(200).json({ success: true, sent });
};

exports.notifyDecision = async (req, res) => {
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { studentId, studentName, journalTitle, status } = req.body;
  const studentEmail = await getEmailForUser(studentId);
  if (!studentEmail) return res.status(404).json({ error: 'Author not found' });
  
  const html = generateDecisionNotification(esc(studentName), esc(journalTitle), esc(status));
  const sent = await sendMail(studentEmail, 'Editorial Decision Reached', html);
  res.status(sent ? 200 : 500).json({ success: sent });
};

exports.notifyBan = async (req, res) => {
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { userId, userName, reason } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  // Security: Resolve email server-side — never trust caller-supplied email.
  // This matches the notifyAccountDeleted pattern and prevents a compromised
  // admin session from redirecting ban notifications to arbitrary addresses.
  const resolvedEmail = await getEmailForUser(userId);
  if (!resolvedEmail) return res.status(404).json({ error: 'Could not resolve user email' });

  const html = generateBanNotification(esc(userName), esc(reason));
  const sent = await sendMail(resolvedEmail, 'Your Account Has Been Suspended', html);
  // Also notify main admin
  await sendMail(process.env.EMAIL_USER, `User Suspended: ${esc(userName)}`, html);
  res.status(sent ? 200 : 500).json({ success: sent });
};

exports.notifyUnban = async (req, res) => {
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { userId, userName } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  // Security: Resolve email server-side — same rationale as notifyBan above.
  const resolvedEmail = await getEmailForUser(userId);
  if (!resolvedEmail) return res.status(404).json({ error: 'Could not resolve user email' });

  const html = generateUnbanNotification(esc(userName));
  const sent = await sendMail(resolvedEmail, 'Your Account Has Been Reinstated', html);
  res.status(sent ? 200 : 500).json({ success: sent });
};

exports.notifyAccountDeleted = async (req, res) => {
  // requireAdmin middleware already verified this, but double-check for defense-in-depth
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { userId, userName, role } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  // Security: Resolve email from DB using userId — never trust caller-provided email
  // This prevents a malicious admin from sending deletion notices to arbitrary addresses
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, name')
    .eq('id', userId)
    .single();
  
  // Fall back to caller-provided data only for the already-deleted user
  // (profile may no longer exist if deletion already happened)
  const resolvedEmail = profile?.email;
  const resolvedName = profile?.name || userName;
  
  if (!resolvedEmail) {
    // User is already deleted, just notify admin
    const html = generateAccountDeletedNotification(esc(resolvedName), esc(role));
    await sendMail(process.env.EMAIL_USER, `Account Deleted: ${esc(resolvedName)} (${esc(role)})`, html);
    return res.status(200).json({ success: true });
  }
  
  const html = generateAccountDeletedNotification(esc(resolvedName), esc(role));
  await sendMail(resolvedEmail, 'Your Account Has Been Removed', html);
  await sendMail(process.env.EMAIL_USER, `Account Deleted: ${esc(resolvedName)} (${esc(role)})`, html);
  res.status(200).json({ success: true });
};

exports.notifyReviewerApproved = async (req, res) => {
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { userId, userName } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  const resolvedEmail = await getEmailForUser(userId);
  if (!resolvedEmail) return res.status(404).json({ error: 'Could not resolve user email' });

  const html = generateReviewerApprovalNotification(esc(userName));
  const sent = await sendMail(resolvedEmail, 'Reviewer Application Approved', html);
  res.status(sent ? 200 : 500).json({ success: sent });
};

exports.notifyReviewerRejected = async (req, res) => {
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { userId, userName } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  const resolvedEmail = await getEmailForUser(userId);
  if (!resolvedEmail) return res.status(404).json({ error: 'Could not resolve user email' });

  const html = generateReviewerRejectionNotification(esc(userName));
  const sent = await sendMail(resolvedEmail, 'Reviewer Application Status', html);
  res.status(sent ? 200 : 500).json({ success: sent });
};



// ── Notify student: paper has been sent to reviewer ───────────────────
exports.notifySentForReview = async (req, res) => {
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { studentId, studentName, journalTitle } = req.body;
  const studentEmail = await getEmailForUser(studentId);
  if (!studentEmail) return res.status(404).json({ error: 'Author not found' });

  const html = generateSentForReviewNotification(esc(studentName), esc(journalTitle));
  await sendMail(studentEmail, 'Your Paper Has Been Sent for Review', html);
  await insertNotification(studentId, 'Paper Sent for Review', `Your paper "${journalTitle}" has been assigned to a reviewer.`, '/student/journals');
  res.status(200).json({ success: true });
};

// ── Notify student: rework/revision requested ─────────────────────────
exports.notifyRework = async (req, res) => {
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { studentId, studentName, journalTitle, adminComments } = req.body;
  const studentEmail = await getEmailForUser(studentId);
  if (!studentEmail) return res.status(404).json({ error: 'Author not found' });

  const html = generateReworkNotification(esc(studentName), esc(journalTitle), esc(adminComments));
  await sendMail(studentEmail, 'Revision Requested for Your Paper', html);
  await insertNotification(studentId, 'Revision Requested', `Please revise your paper "${journalTitle}" and resubmit.`, '/student/journals');
  res.status(200).json({ success: true });
};

// ── Notify student: paper published ───────────────────────────────────
exports.notifyPublish = async (req, res) => {
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { studentId, studentName, journalTitle, paperId } = req.body;
  const studentEmail = await getEmailForUser(studentId);
  if (!studentEmail) return res.status(404).json({ error: 'Author not found' });

  const APP_URL = process.env.APP_URL || 'http://localhost:5173';
  const paperLink = `${APP_URL}/paper/${paperId}`;
  const html = generatePublishedNotification(esc(studentName), esc(journalTitle), paperLink);
  await sendMail(studentEmail, 'Your Paper Has Been Published!', html);
  await insertNotification(studentId, 'Paper Published!', `Your paper "${journalTitle}" is now live on the platform.`, `/paper/${paperId}`);
  res.status(200).json({ success: true });
};

// ── Notify student: paper deleted ─────────────────────────────────────
exports.notifyPaperDeleted = async (req, res) => {
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { studentId, studentName, journalTitle } = req.body;
  const studentEmail = await getEmailForUser(studentId);
  if (!studentEmail) return res.status(404).json({ error: 'Author not found' });

  const html = generatePaperDeletedNotification(esc(studentName), esc(journalTitle));
  await sendMail(studentEmail, 'Notice: Your Published Paper Has Been Removed', html);
  // Also send an in-app notification
  await insertNotification(studentId, 'Paper Removed', `Your published paper "${journalTitle}" has been permanently removed by the administration.`, '/student/journals');
  res.status(200).json({ success: true });
};

// ── Notify admin: new full-paper request ──────────────────────────────
exports.notifyPaperRequest = async (req, res) => {
  const { requesterName, requesterEmail, journalTitle, journalId, affiliation, reason, website_url, turnstileToken } = req.body;
  
  // HONEYPOT: If the hidden website_url field is filled out, this is a spam bot.
  // Silently drop the request but return success so the bot doesn't retry.
  if (website_url) {
    console.log(`Blocked spam request from bot for paper: ${journalTitle}`);
    return res.status(200).json({ success: true, honeypot: true });
  }

  // Verify CAPTCHA (Turnstile) — SEC-002: CAPTCHA must gate the DB insert, not just the email
  const isHuman = await verifyTurnstile(turnstileToken);
  if (!isHuman) {
    return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
  }

  // Input validation — prevent bots from sending oversized strings or malformed emails
  if (!validateEmail(requesterEmail)) return res.status(400).json({ error: 'Invalid email address' });
  if (!validateString(requesterName, 100)) return res.status(400).json({ error: 'Invalid requester name (max 100 chars)' });
  if (!validateString(journalTitle, 300)) return res.status(400).json({ error: 'Invalid journal title (max 300 chars)' });
  if (affiliation && typeof affiliation === 'string' && affiliation.length > 200) return res.status(400).json({ error: 'Affiliation too long (max 200 chars)' });
  if (reason && typeof reason === 'string' && reason.length > 1000) return res.status(400).json({ error: 'Reason too long (max 1000 chars)' });

  // SEC-002: Insert the paper_requests row server-side AFTER CAPTCHA passes.
  // The frontend no longer inserts directly into Supabase, so CAPTCHA now gates
  // the database write — bots cannot create rows without passing Turnstile.
  if (journalId) {
    const { error: insertError } = await supabase.from('paper_requests').insert({
      journal_id: journalId,
      journal_title: journalTitle.trim(),
      requester_name: requesterName.trim(),
      requester_email: requesterEmail.trim(),
      affiliation: affiliation?.trim() || null,
      reason: reason?.trim() || null,
      status: 'pending',
    });
    if (insertError) {
      console.error('paper_requests insert error:', insertError);
      return res.status(500).json({ error: 'Failed to save paper request. Please try again.' });
    }
  }
  
  const html = generatePaperRequestAdminNotification(
    esc(requesterName), esc(requesterEmail), esc(journalTitle), esc(affiliation), esc(reason)
  );
  
  // Find all admins and store in-app notifications
  await notifyAdminsInApp(
    'New Paper Request',
    `${requesterName} requested the full PDF of "${journalTitle}".`,
    '/admin/paper-requests'
  );

  const sent = await sendMail(process.env.EMAIL_USER, 'New Full Paper Request', html);
  res.status(sent ? 200 : 500).json({ success: sent });
};


// ── Notify requester: paper request rejected ───────────────────────────
exports.notifyPaperRequestRejected = async (req, res) => {
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { requesterName, requesterEmail, journalTitle } = req.body;
  if (!requesterEmail) return res.status(400).json({ error: 'Requester email required' });
  const html = generatePaperRequestRejectedNotification(esc(requesterName), esc(journalTitle));
  const sent = await sendMail(requesterEmail, 'Your Paper Request — Science & Society', html);
  res.status(sent ? 200 : 500).json({ success: sent });
};

// ── Notify requester: paper delivered ───────────────────────────
exports.notifyPaperDelivery = async (req, res) => {
  // requireAdmin middleware already verified this
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { requesterName, requesterEmail, journalTitle, fileUrl } = req.body;
  if (!requesterEmail || !fileUrl) return res.status(400).json({ error: 'Missing data' });

  // U-8 FIX: Cross-check that the fileUrl belongs to the journal the requester
  // actually requested. Prevents a rogue admin from delivering an arbitrary file
  // to an arbitrary email address by constructing a crafted POST body.
  const { data: requestRecord, error: reqErr } = await supabase
    .from('paper_requests')
    .select('id, journals(file_url)')
    .eq('requester_email', requesterEmail)
    .eq('journal_title', journalTitle)
    .in('status', ['pending', 'approved'])
    .maybeSingle();

  if (reqErr || !requestRecord) {
    return res.status(403).json({ error: 'No matching approved paper request found for this requester.' });
  }

  const expectedFileUrl = requestRecord.journals?.file_url;
  if (!expectedFileUrl) {
    return res.status(404).json({ error: 'No file associated with this paper in the database.' });
  }

  // Extract the storage path from either a full URL or a bare path.
  // Old records: "https://xxx.supabase.co/storage/v1/object/public/journals/uuid/file.pdf"
  // New records: "uuid/file.pdf"
  const getStoragePath = (url) => {
    const marker = '/journals/';
    const idx = url.indexOf(marker);
    if (idx !== -1) return url.slice(idx + marker.length).split('?')[0];
    return url;
  };

  const expectedPath = getStoragePath(expectedFileUrl);

  // Generate a signed URL server-side using the service-role key (bypasses bucket public flag).
  // Signed URL is valid for 10 minutes — enough to fetch and attach in the email.
  const { data: signedData, error: signErr } = await supabase.storage
    .from('journals')
    .createSignedUrl(expectedPath, 600);

  if (signErr || !signedData?.signedUrl) {
    console.error('Failed to generate signed URL for paper delivery:', signErr);
    return res.status(500).json({ error: 'Could not access the requested file.' });
  }

  const html = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #0A192F;">
      <h2 style="color: #1D4ED8;">Science &amp; Society</h2>
      <p>Dear ${esc(requesterName)},</p>
      <p>Your request for the full paper <strong>"${esc(journalTitle)}"</strong> has been approved by the editorial board.</p>
      <p>Please find the requested PDF attached to this email.</p>
      <p>Thank you for your interest in our journal.</p>
      <br/>
      <p style="color: #475569; font-size: 0.9em;">Regards,<br/>Editorial Board</p>
    </div>
  `;

  // Attach the file using the signed URL (valid for 10 minutes — plenty of time for Nodemailer)
  const attachments = [
    {
      filename: `${journalTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      path: signedData.signedUrl
    }
  ];

  const sent = await sendMail(requesterEmail, 'Full Paper Delivery — Science & Society', html, attachments);
  res.status(sent ? 200 : 500).json({ success: sent });
};

// ── Contact Form (Public) ───────────────────────────────────────────────
exports.notifyContact = async (req, res) => {
  const { name, email, subject, message, turnstileToken } = req.body;
  
  // Verify CAPTCHA (Turnstile)
  const isHuman = await verifyTurnstile(turnstileToken);
  if (!isHuman) {
    return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
  }

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (!validateString(name, 100)) return res.status(400).json({ error: 'Name must be 1-100 characters' });
  if (!validateString(subject, 200)) return res.status(400).json({ error: 'Subject must be 1-200 characters' });
  if (!validateString(message, 5000)) return res.status(400).json({ error: 'Message must be 1-5000 characters' });

  // 1. Send email to admin
  const htmlAdmin = generateContactNotification(esc(name), esc(email), esc(subject), esc(message));
  const emailSent = await sendMail(process.env.EMAIL_USER, `Contact Form: ${esc(subject)}`, htmlAdmin);

  // 2. Insert notification for admins
  const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
  if (admins && admins.length > 0) {
    const records = admins.map(a => ({
      user_id: a.id,
      title: `New Message: ${esc(subject)}`,
      message: esc(message).substring(0, 100) + (message.length > 100 ? '...' : ''),
      metadata: { type: 'contact', sender_name: name, sender_email: email, subject: subject, full_message: message }
    }));
    await supabase.from('notifications').insert(records);
  }

  res.status(emailSent ? 200 : 500).json({ success: emailSent });
};

// ── Admin Reply to Contact Form ─────────────────────────────────────────
exports.replyContact = async (req, res) => {
  if (!await checkAdmin(req.user?.id)) return res.status(403).json({ error: 'Forbidden' });
  const { recipientEmail, originalSubject, originalMessage, replyMessage } = req.body;

  if (!recipientEmail || !replyMessage) {
    return res.status(400).json({ error: 'Missing recipient email or reply message' });
  }

  const { data: matchingNotif } = await supabase
    .from('notifications')
    .select('id')
    .eq('metadata->>sender_email', recipientEmail)
    .limit(1)
    .maybeSingle();
  if (!matchingNotif) {
    return res.status(403).json({ error: 'No contact message found for this recipient.' });
  }
  
  const html = generateContactReply(esc(originalSubject), esc(originalMessage), esc(replyMessage));
  const emailSent = await sendMail(recipientEmail, `Re: ${esc(originalSubject || 'Your Message to Science & Society')}`, html);
  
  res.status(emailSent ? 200 : 500).json({ success: emailSent });
};
