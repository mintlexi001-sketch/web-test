const { createClient } = require('@supabase/supabase-js');
const { sendMail } = require('../utils/mailer');
const { generateOTPTemplate, generateEmailChangedTemplate } = require('../utils/emailTemplates');
const crypto = require('crypto');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Use cryptographically secure random number generator for OTP
const generateOTP = () => crypto.randomInt(100000, 1000000).toString();
const hashOTP = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

const timingSafeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

const validateEmail = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validateString = (str, maxLen = 100) => typeof str === 'string' && str.trim().length > 0 && str.trim().length <= maxLen;

// SEC-020: Centralize password policy (min 8 chars, 1 uppercase, 1 number)
const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < 8 || password.length > 255) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
};

const validateNotTempEmail = (email) => {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;

  // Strict whitelist of popular allowed providers
  const allowedProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
    'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 'proton.me'
  ];

  // Allow standard academic extensions broadly
  const isAcademic = 
    domain.endsWith('.edu') || 
    domain.includes('.edu.') || 
    domain.endsWith('.ac.in') || 
    domain.endsWith('.ac.uk') || 
    domain.includes('.ac.');

  return allowedProviders.includes(domain) || isAcademic;
};

// SEC-024: Turnstile verification — same pattern as notifyController.js
// Fails closed if secret key is missing or token is absent.
const verifyTurnstile = async (token) => {
  if (!process.env.TURNSTILE_SECRET_KEY) {
    console.error('CRITICAL: TURNSTILE_SECRET_KEY is not set. Blocking CAPTCHA-protected request.');
    return false;
  }
  if (!token) return false;
  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: token }),
    });
    const data = await resp.json();
    return data.success === true;
  } catch (e) {
    console.error('Turnstile verification error:', e);
    return false;
  }
};

exports.sendRegisterOTP = async (req, res) => {
  const { email, role, turnstileToken } = req.body;

  // SEC-024: Require Turnstile CAPTCHA on OTP send — prevents email-flooding abuse
  const captchaOk = await verifyTurnstile(turnstileToken);
  if (!captchaOk) return res.status(400).json({ error: 'CAPTCHA verification failed. Please refresh and try again.' });

  if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (!validateNotTempEmail(email)) return res.status(400).json({ error: 'Please use a standard email provider (Gmail, Outlook, etc.) or a college domain' });
  // Admin accounts are created exclusively via promotion in the Admin Panel — not via public registration
  if (!['student', 'reviewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  // Check 60-second cooldown to prevent spamming OTP requests
  const { data: existingOtp } = await supabase
    .from('custom_otps')
    .select('created_at, expires_at')
    .eq('email', email)
    .single();

  if (existingOtp) {
    const existingExpiry = new Date(existingOtp.expires_at).getTime();
    // Expiry was set for 10 minutes (600,000ms). If more than 9 minutes (540,000ms) remain, it was created < 60s ago.
    if (existingExpiry - Date.now() > 540000) {
      return res.status(429).json({ error: 'Please wait 60 seconds before requesting another OTP.' });
    }
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10 mins

  // Upsert OTP to database
  const hashedOtp = hashOTP(otp);
  const { error } = await supabase
    .from('custom_otps')
    .upsert({ email, otp: hashedOtp, expires_at: expiresAt });

  if (error) {
    console.error('DB Error:', error);
    return res.status(500).json({ error: 'Failed to generate OTP' });
  }

  const html = generateOTPTemplate(otp, 'register');
  const sent = await sendMail(email, 'Verify your email - Science & Society', html);

  if (!sent) return res.status(500).json({ error: 'Failed to send email' });

  res.status(200).json({ message: 'OTP sent successfully' });
};

exports.verifyRegisterOTP = async (req, res) => {
  let { email, otp, password, name, role } = req.body;

  if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (!validateString(otp, 6) || otp.length !== 6) return res.status(400).json({ error: 'Invalid OTP' });
  if (!validatePassword(password)) return res.status(400).json({ error: 'Password must be at least 8 characters, with 1 uppercase letter and 1 number' });
  if (!validateString(name, 100)) return res.status(400).json({ error: 'Invalid name' });
  // Admin accounts are created exclusively via promotion — block any attempt to self-register as admin
  if (!['student', 'reviewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  
  name = name.trim(); // Sanitize name

  const { data, error } = await supabase
    .from('custom_otps')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data || new Date() > new Date(data.expires_at)) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  if (!timingSafeCompare(data.otp, hashOTP(otp))) {
    // Wrong OTP: delete to prevent brute-force iteration
    await supabase.from('custom_otps').delete().eq('email', email);
    // Return same message as expired OTP to avoid distinguishing between the two (timing attack prevention)
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  // Create user securely (bypassing Supabase default email)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true // Auto-confirm
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  // Insert profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      name,
      email,
      role,
      status: role === 'reviewer' ? 'pending' : 'active',
      is_permanent: false
    });

  if (profileError) {
    console.error('Profile creation error:', profileError);
    // Rollback user creation if profile fails with retry to prevent ghost users
    let rollbackSuccess = false;
    for (let i = 0; i < 3; i++) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(authData.user.id);
      if (!delErr) { rollbackSuccess = true; break; }
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!rollbackSuccess) console.error(`CRITICAL: Failed to rollback ghost auth user ${authData.user.id}`);
    
    return res.status(500).json({ error: 'Failed to create profile' });
  }

  // Delete OTP
  await supabase.from('custom_otps').delete().eq('email', email);

  res.status(200).json({ message: 'User created successfully' });
};

exports.sendResetOTP = async (req, res) => {
  const { email, turnstileToken } = req.body;

  // SEC-024: Require Turnstile CAPTCHA on password reset OTP — prevents email-flooding abuse
  const captchaOk = await verifyTurnstile(turnstileToken);
  if (!captchaOk) return res.status(400).json({ error: 'CAPTCHA verification failed. Please refresh and try again.' });

  if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (!validateNotTempEmail(email)) return res.status(400).json({ error: 'Please use a standard email provider or a college domain' });

  // Ensure email exists before sending reset OTP
  const { data: existingUser } = await supabase.from('profiles').select('id').eq('email', email).single();
  // SEC-015: Prevent account enumeration by returning a generic success message
  if (!existingUser) {
    // Deliberate delay to prevent timing attacks, then return fake success
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500));
    return res.status(200).json({ message: 'If this email is registered, a reset code has been sent.' });
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
  const hashedOtp = hashOTP(otp);

  const { error } = await supabase
    .from('custom_otps')
    .upsert({ email, otp: hashedOtp, expires_at: expiresAt });

  if (error) return res.status(500).json({ error: 'Failed to generate OTP' });

  const html = generateOTPTemplate(otp, 'reset');
  const sent = await sendMail(email, 'Password Reset - Science & Society', html);

  if (!sent) return res.status(500).json({ error: 'Failed to send email' });

  res.status(200).json({ message: 'If this email is registered, a reset code has been sent.' });
};

exports.verifyResetOTP = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (!validateString(otp, 6) || otp.length !== 6) return res.status(400).json({ error: 'Invalid OTP' });
  if (!validatePassword(newPassword)) return res.status(400).json({ error: 'Password must be at least 8 characters, with 1 uppercase letter and 1 number' });

  const { data, error } = await supabase
    .from('custom_otps')
    .select('*')
    .eq('email', email)
    .single();

  // CRITICAL: Check for error/missing data BEFORE accessing data fields to prevent TypeError crash
  if (error || !data) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  // Check OTP validity — unified error to prevent distinguishing expired vs. wrong guess
  const isExpired = new Date() > new Date(data.expires_at);
  const isWrongOtp = !timingSafeCompare(data.otp, hashOTP(otp));
  
  if (isExpired || isWrongOtp) {
    // Delete OTP on any failure (matches register flow — prevents brute-force)
    await supabase.from('custom_otps').delete().eq('email', email);
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  // Get user ID by email using the secure RPC
  const { data: userId, error: rpcError } = await supabase.rpc('get_user_id_by_email', { p_email: email });

  if (rpcError || !userId) return res.status(404).json({ error: 'User not found' });

  const { error: updateError } = await supabase.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  );

  if (updateError) return res.status(400).json({ error: updateError.message });

  await supabase.from('custom_otps').delete().eq('email', email);
  res.status(200).json({ message: 'Password updated successfully' });
};

// ---------------- EMAIL CHANGE OTP FLOW ----------------
exports.sendEmailChangeOTP = async (req, res) => {
  const { newEmail } = req.body;
  if (!validateEmail(newEmail)) return res.status(400).json({ error: 'Invalid email format' });
  if (!validateNotTempEmail(newEmail)) return res.status(400).json({ error: 'Please use a standard email provider (Gmail, Outlook, etc.) or a college domain' });

  // Ensure email is not already taken
  const { data: existingUser } = await supabase.from('profiles').select('id').eq('email', newEmail).single();
  if (existingUser) return res.status(400).json({ error: 'Email already in use' });

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
  const hashedOtp = hashOTP(otp);

  const { error } = await supabase.from('custom_otps').upsert({ email: newEmail, otp: hashedOtp, expires_at: expiresAt });
  if (error) return res.status(500).json({ error: 'Failed to generate OTP' });

  const html = generateOTPTemplate(otp, 'email_change');
  const sent = await sendMail(newEmail, 'Verify New Email - Science & Society', html);
  if (!sent) return res.status(500).json({ error: 'Failed to send verification email' });

  res.status(200).json({ message: 'OTP sent to new email' });
};

exports.verifyEmailChangeOTP = async (req, res) => {
  const { newEmail, otp } = req.body;
  const userId = req.user?.id; // from requireAuth middleware

  if (!validateEmail(newEmail) || !validateString(otp, 6)) return res.status(400).json({ error: 'Invalid input' });
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // Get old email to send notification
  const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single();
  const oldEmail = profile?.email;

  const { data, error } = await supabase.from('custom_otps').select('*').eq('email', newEmail).single();

  // Guard: check for missing/errored OTP record BEFORE accessing any fields.
  // This prevents unsafe optional chaining causing isExpired to silently
  // evaluate to false when data is null (new Date(undefined) comparisons always return false).
  if (error || !data) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  // Check OTP validity — unified error to prevent distinguishing expired vs. wrong guess
  const isExpired = new Date() > new Date(data.expires_at);
  const isWrongOtp = !timingSafeCompare(data.otp, hashOTP(otp));

  if (isExpired || isWrongOtp) {
    // Delete OTP on any failure (prevents brute-force)
    await supabase.from('custom_otps').delete().eq('email', newEmail);
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  // Update Auth Email securely (bypassing confirmation link)
  const { error: authError } = await supabase.auth.admin.updateUserById(userId, { email: newEmail, email_confirm: true });
  if (authError) return res.status(400).json({ error: authError.message });

  // Update Profile Email
  await supabase.from('profiles').update({ email: newEmail }).eq('id', userId);
  await supabase.from('custom_otps').delete().eq('email', newEmail);

  // Send notification to old email
  if (oldEmail && oldEmail !== newEmail) {
    const html = generateEmailChangedTemplate();
    await sendMail(oldEmail, 'Security Alert: Email Address Updated - Science & Society', html);
  }

  res.status(200).json({ message: 'Email updated successfully' });
};

// ---------------- GRACE PERIOD DELETION FLOW ----------------
// Route removed, handled by client-side RPC schedule_account_deletion()

exports.cancelDeletion = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { error } = await supabase.from('profiles').update({ deletion_scheduled_at: null }).eq('id', userId);
  if (error) return res.status(500).json({ error: 'Failed to cancel deletion' });

  res.status(200).json({ message: 'Account deletion has been cancelled successfully.' });
};

