// server/utils/emailTemplates.js

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const YEAR = new Date().getFullYear();

/**
 * HTML-escapes a string for safe interpolation into email template HTML.
 * This is the canonical escaping function for the entire backend email layer.
 * Import and use this in every controller rather than defining a local copy.
 * Future template functions must ALWAYS wrap caller-supplied strings with this
 * before interpolating them — the template layer enforces safety, not just callers.
 */
const escHtml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

exports.escHtml = escHtml;

/**
 * The single, reusable master HTML email template.
 * Uses a robust table-based layout for maximum client compatibility (Gmail, Outlook, Mobile).
 */
const renderMasterTemplate = ({ title, greeting, intro, detailsHTML, actionText, actionUrl, customContent }) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title || 'Science & Society'}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Inter', Helvetica, Arial, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 40px 20px;">
      <tr>
        <td align="center">
          <!-- Main Card -->
          <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); max-width: 600px; width: 100%;">
            
            <!-- Header (Navy & Gold Academic Theme) -->
            <tr>
              <td align="center" style="background-color: #0f172a; border-bottom: 4px solid #c9a84c; padding: 35px 20px;">
                <h1 style="margin: 0; color: #ffffff; font-family: Georgia, 'Times New Roman', serif; font-size: 26px; font-weight: normal; letter-spacing: 0.5px;">
                  Science <span style="color: #c9a84c;">&amp;</span> Society
                </h1>
                <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 12px; font-family: 'Inter', Helvetica, Arial, sans-serif; text-transform: uppercase; letter-spacing: 1.5px;">
                  Nirmala College Research Archive
                </p>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td style="padding: 40px 35px; color: #334155; font-size: 15px; line-height: 1.6; font-family: 'Inter', Helvetica, Arial, sans-serif;">
                
                ${title ? `<h2 style="margin: 0 0 20px 0; color: #0f172a; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: normal;">${title}</h2>` : ''}
                
                ${greeting ? `<p style="margin: 0 0 16px 0; font-size: 16px;">${greeting},</p>` : ''}
                
                ${intro ? `<p style="margin: 0 0 24px 0;">${intro}</p>` : ''}

                ${detailsHTML ? `
                  <div style="background-color: #f8fafc; border-left: 4px solid #c9a84c; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                    ${detailsHTML}
                  </div>
                ` : ''}
                
                ${customContent || ''}

                ${(actionText && actionUrl) ? `
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 10px;">
                    <tr>
                      <td align="center">
                        <a href="${actionUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; border-bottom: 2px solid #020617;">
                          ${actionText}
                        </a>
                      </td>
                    </tr>
                  </table>
                ` : ''}

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 35px; font-size: 12px; color: #64748b; line-height: 1.5; font-family: 'Inter', Helvetica, Arial, sans-serif;">
                <p style="margin: 0 0 8px 0;">&copy; ${YEAR} Nirmala College. All rights reserved.</p>
                <p style="margin: 0 0 8px 0;">This is an automated message from the Science and Society Journal Platform. Please do not reply directly to this email.</p>
                <p style="margin: 0;"><a href="mailto:contact@nirmalacollege.edu" style="color: #2563eb; text-decoration: none;">contact@nirmalacollege.edu</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};

// --- Exported Template Generators ---

exports.generateEmailChangedTemplate = () => renderMasterTemplate({
  title: 'Email Address Updated',
  intro: 'Your email address for your Science & Society account has been successfully updated.',
  customContent: `
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 500;">
        If you did not make this change, please visit the website immediately and send a request to the admin to secure your account.
      </p>
    </div>
  `
});

exports.generateOTPTemplate = (otp, purpose) => {
  const isReset = purpose === 'reset';
  const isEmail = purpose === 'email_change';
  return renderMasterTemplate({
    title: isReset ? 'Password Reset Code' : isEmail ? 'Verify New Email Address' : 'Verify Your Email',
    intro: isReset 
      ? 'You requested a password reset. Please use the verification code below to reset your password:'
      : isEmail 
        ? 'You requested to update your account email. Please use the verification code below to confirm this new email address:'
        : 'Thank you for registering with Science & Society! Please use the verification code below to complete your registration:',
    customContent: `
      <div style="text-align: center; margin: 32px 0;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 4px; color: #2563eb; background: #eff6ff; padding: 12px 24px; border-radius: 8px;">
          ${otp}
        </span>
      </div>
      <p style="font-size: 14px; color: #64748b;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
    `
  });
};

exports.generateUploadNotification = (studentName, journalTitle) => renderMasterTemplate({
  title: 'New Journal Submission',
  greeting: 'Hello Admin',
  intro: 'A new journal has been uploaded to the system and is awaiting your review.',
  detailsHTML: `
    <p style="margin: 0 0 8px 0;"><strong>Author:</strong> ${studentName}</p>
    <p style="margin: 0;"><strong>Title:</strong> ${journalTitle}</p>
  `,
  actionText: 'Go to Dashboard',
  actionUrl: `${APP_URL}/admin/dashboard`
});

exports.generateUploadConfirmationStudent = (studentName, journalTitle) => renderMasterTemplate({
  title: 'Journal Submission Received',
  greeting: `Hello ${studentName}`,
  intro: 'Thank you for submitting your manuscript to <strong>Science & Society</strong>. Your submission has been received and is now queued for editorial review.',
  detailsHTML: `
    <p style="margin: 0;"><strong>Title:</strong> ${journalTitle}</p>
  `,
  actionText: 'View My Submissions',
  actionUrl: `${APP_URL}/student/journals`
});

exports.generateAssignNotification = (reviewerName, journalTitle, isRework) => renderMasterTemplate({
  title: isRework ? 'Reworked Paper Review Assignment' : 'New Review Assignment',
  greeting: `Hello ${reviewerName}`,
  intro: isRework
    ? 'You have been assigned to review a reworked journal submission on the Science & Society platform.'
    : 'You have been assigned to review a new journal submission on the Science & Society platform.',
  detailsHTML: `
    <p style="margin: 0;"><strong>Title:</strong> ${journalTitle}</p>
    ${isRework ? '<p style="margin: 8px 0 0 0; color: #6d28d9; font-weight: bold;">This is a resubmitted/reworked paper.</p>' : ''}
  `,
  actionText: 'Go to Dashboard',
  actionUrl: `${APP_URL}/reviewer/assigned`
});


exports.generateReviewCompleteNotification = (role, journalTitle, decision, reviewerName) => renderMasterTemplate({
  title: role === 'admin' ? 'Reviewer Report Submitted' : 'Review Completed',
  greeting: `Hello ${role === 'student' ? 'Author' : 'Admin'}`,
  intro: role === 'admin' 
    ? `Reviewer <strong>${reviewerName || 'An assigned reviewer'}</strong> has submitted a review report for the following journal:`
    : 'A review has just been completed for your journal submission:',
  detailsHTML: `
    <p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${journalTitle}</p>
    ${decision ? `<p style="margin: 0;"><strong>Recommendation:</strong> <span style="text-transform: capitalize; font-weight: 600;">${decision}</span></p>` : ''}
  `,
  actionText: role === 'admin' ? 'View Review Reports' : 'View Submission',
  actionUrl: role === 'admin' ? `${APP_URL}/admin/reports` : `${APP_URL}/student/journals`
});

exports.generateReworkResubmittedNotification = (studentName, journalTitle) => renderMasterTemplate({
  title: 'Reworked Paper Resubmitted',
  greeting: 'Hello Admin',
  intro: `Author <strong>${studentName}</strong> has submitted a revised manuscript for their paper assigned for rework.`,
  detailsHTML: `
    <p style="margin: 0 0 8px 0;"><strong>Author:</strong> ${studentName}</p>
    <p style="margin: 0;"><strong>Title:</strong> ${journalTitle}</p>
  `,
  customContent: '<p>This paper has returned to the queue as a <strong>Reworked Paper</strong>. You can view the previous reviewer details and assign it for second-round review.</p>',
  actionText: 'Assign Reviewer',
  actionUrl: `${APP_URL}/admin/reviewers`
});

exports.generateDecisionNotification = (studentName, journalTitle, status) => {
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';
  const statusColor = isApproved ? '#16a34a' : isRejected ? '#dc2626' : '#ea580c';
  
  return renderMasterTemplate({
    title: 'Editorial Decision Reached',
    greeting: `Dear ${studentName}`,
    intro: 'The editorial board has reached a decision regarding your submission.',
    detailsHTML: `
      <p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${journalTitle}</p>
      <p style="margin: 0;"><strong>Status:</strong> <span style="text-transform: capitalize; font-weight: 600; color: ${statusColor};">${status.replace('_', ' ')}</span></p>
    `
  });
};

exports.generateBanNotification = (userName, reason) => renderMasterTemplate({
  title: 'Account Suspended',
  greeting: `Dear ${userName}`,
  intro: 'Your account on the <strong>Science & Society Journal Platform</strong> has been <strong style="color:#dc2626;">suspended</strong> by the administration.',
  customContent: reason ? `
    <div style="background:#fef2f2;padding:14px;border-radius:8px;border-left:4px solid #dc2626;margin:16px 0;">
      <p style="margin:0;"><strong>Reason:</strong> ${reason}</p>
    </div>
  ` : '',
  detailsHTML: '<p style="margin:0;">You will not be able to log in until the suspension is lifted. If you believe this was a mistake, please contact the editorial board.</p>'
});

exports.generateUnbanNotification = (userName) => renderMasterTemplate({
  title: 'Account Reinstated',
  greeting: `Dear ${userName}`,
  intro: 'Your account on the <strong>Science & Society Journal Platform</strong> has been <strong style="color:#16a34a;">reinstated</strong>. You can now log in and continue using the platform normally.'
});

exports.generateAccountDeletedNotification = (userName, role) => renderMasterTemplate({
  title: 'Account Deletion Requested',
  greeting: `Dear ${userName}`,
  intro: `Your <strong>${role}</strong> account on the <strong>Science & Society Journal Platform</strong> has been permanently removed by the administration.`,
  customContent: '<p>All associated records (submissions, reviews, assignments) have been deleted. If you believe this was done in error, please contact the editorial board directly.</p>'
});

exports.generateReviewerApprovalNotification = (userName) => renderMasterTemplate({
  title: 'Reviewer Application Approved',
  greeting: `Dear ${userName}`,
  intro: 'Congratulations! Your application to become a reviewer for the <strong>Science & Society Journal Platform</strong> has been <strong style="color:#16a34a;">approved</strong> by the administration.',
  customContent: '<p>You can now log in to your dashboard to view and evaluate assigned journals. We look forward to your valuable contributions.</p>'
});

exports.generateReviewerRejectionNotification = (userName) => renderMasterTemplate({
  title: 'Reviewer Application Declined',
  greeting: `Dear ${userName}`,
  intro: 'Thank you for your interest in joining the <strong>Science & Society Journal Platform</strong> as a reviewer. Unfortunately, after careful consideration, the administration has <strong style="color:#dc2626;">declined</strong> your application at this time.',
  customContent: '<p>If you have any questions or feel this was a mistake, please contact our support team.</p>'
});

exports.generateSentForReviewNotification = (studentName, journalTitle) => renderMasterTemplate({
  title: 'Your Paper Has Been Sent for Review',
  greeting: `Hello ${studentName}`,
  intro: 'Great news! Your submitted paper has been assigned to a reviewer and is now under evaluation.',
  detailsHTML: `
    <p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${journalTitle}</p>
    <p style="margin: 0;"><strong>Status:</strong> Under Review</p>
  `,
  actionText: 'View My Submissions',
  actionUrl: `${APP_URL}/student/journals`
});

exports.generateReworkNotification = (studentName, journalTitle, adminComments) => renderMasterTemplate({
  title: 'Revision Requested for Your Paper',
  greeting: `Hello ${studentName}`,
  intro: 'After careful review, the editorial board has requested revisions to your submitted paper before it can be considered for acceptance.',
  detailsHTML: `
    <p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${journalTitle}</p>
    ${adminComments ? `<p style="margin: 0;"><strong>Editor Comments:</strong> ${adminComments}</p>` : ''}
  `,
  actionText: 'View Feedback & Resubmit',
  actionUrl: `${APP_URL}/student/journals`
});

exports.generatePublishedNotification = (studentName, journalTitle, paperLink) => renderMasterTemplate({
  title: 'Your Paper Has Been Published!',
  greeting: `Hello ${studentName}`,
  intro: 'Congratulations! Your research paper has been accepted and is now officially published on the Science & Society platform.',
  detailsHTML: `<p style="margin: 0;"><strong>Title:</strong> ${journalTitle}</p>`,
  customContent: '<p>Your work is now publicly accessible and can be discovered by researchers, students, and reviewers worldwide.</p>',
  actionText: 'View Your Published Paper',
  actionUrl: paperLink
});

exports.generatePaperDeletedNotification = (studentName, journalTitle) => renderMasterTemplate({
  title: 'Notice: Your Published Paper Has Been Removed',
  greeting: `Hello ${studentName}`,
  intro: 'We regret to inform you that your published paper has been permanently removed by the administration.',
  detailsHTML: `<p style="margin: 0;"><strong>Title:</strong> ${journalTitle}</p>`,
  customContent: '<p>If you believe this was done in error or have any questions, please contact the editorial board directly.</p>'
});

exports.generatePaperRequestAdminNotification = (requesterName, requesterEmail, journalTitle, affiliation, reason) => renderMasterTemplate({
  title: 'New Full Paper Request',
  greeting: 'Hello Admin',
  intro: 'A visitor has submitted a request for the full PDF of a published paper. Please review and respond.',
  detailsHTML: `
    <p style="margin: 0 0 8px 0;"><strong>Paper:</strong> ${journalTitle}</p>
    <p style="margin: 0 0 8px 0;"><strong>Requester:</strong> ${requesterName}</p>
    <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${requesterEmail}</p>
    ${affiliation ? `<p style="margin: 0 0 8px 0;"><strong>Affiliation:</strong> ${affiliation}</p>` : ''}
    ${reason ? `<p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
  `,
  customContent: '<p>Log in to the admin dashboard to approve or reject this request. If approved, please manually email the PDF to the requester.</p>',
  actionText: 'Manage Requests',
  actionUrl: `${APP_URL}/admin/paper-requests`
});

exports.generatePaperRequestRejectedNotification = (requesterName, journalTitle) => renderMasterTemplate({
  title: 'Your Full Paper Request',
  greeting: `Hello ${requesterName}`,
  intro: 'Thank you for your interest in our research. We have reviewed your request for the full paper below:',
  detailsHTML: `<p style="margin: 0;"><strong>Paper:</strong> ${journalTitle}</p>`,
  customContent: '<p>Unfortunately, we are unable to fulfill your request at this time. If you have questions, please contact the editorial board directly.</p>'
});

module.exports.generateContactNotification = (name, email, subject, message) => {
  return renderMasterTemplate({
    title: `Contact Form: ${subject}`,
    greeting: `New message from ${name}`,
    intro: `You have received a new message via the contact form.`,
    detailsHTML: `
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 15px 0;">
        <p style="margin: 0 0 10px 0;"><strong>From:</strong> ${name} (<a href="mailto:${email}" style="color: #2563eb;">${email}</a>)</p>
        <p style="margin: 0 0 10px 0;"><strong>Subject:</strong> ${subject}</p>
        <div style="margin-top: 15px; white-space: pre-wrap; color: #1e293b;">${message}</div>
      </div>
    `,
    customContent: '<p>You can reply directly to the user by clicking the Reply button in your Admin Notifications panel, or by replying directly to their email address.</p>'
  });
};

module.exports.generateContactReply = (originalSubject, originalMessage, replyMessage) => {
  return renderMasterTemplate({
    title: `Re: ${originalSubject}`,
    greeting: `Hello,`,
    intro: `Thank you for contacting Science & Society. Please see our reply below:`,
    detailsHTML: `
      <div style="background: #ffffff; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; margin: 15px 0; border: 1px solid #e2e8f0; border-left-width: 4px;">
        <div style="white-space: pre-wrap; color: #1e293b;">${replyMessage}</div>
      </div>
      <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        <p style="margin: 0 0 10px 0; font-size: 0.85em; color: #64748b;">On ${new Date().toLocaleDateString()}, you wrote:</p>
        <div style="padding-left: 15px; border-left: 2px solid #cbd5e1; color: #64748b; font-size: 0.9em; white-space: pre-wrap;">${originalMessage}</div>
      </div>
    `,
    customContent: ''
  });
};
