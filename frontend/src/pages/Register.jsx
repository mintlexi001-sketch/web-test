import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Turnstile } from '@marsidev/react-turnstile';
import { AuthLayout } from '../components/layout/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', role: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);

  const { signIn, requestRegisterOTP, verifyRegisterOTP } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const border = '1px solid #ef4444';

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters.';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number.';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (otpStep) {
      if (!otpValue.trim()) return toast.error('Please enter the OTP');
      setLoading(true);
      try {
        await verifyRegisterOTP(form.email, otpValue, form.password, form.name, form.role);
        if (form.role !== 'reviewer') {
          await signIn(form.email, form.password);
        }
        toast.success(form.role === 'reviewer'
          ? 'Submitted! Pending admin approval before you can log in.'
          : 'Account created and verified!');
        navigate('/login', { replace: true });
      } catch (err) {
        toast.error(err.message || 'OTP verification failed.');
      }
      setLoading(false);
      return;
    }

    const newErrors = {};
    if (!form.name.trim()) newErrors.name = true;
    if (!form.email.trim()) newErrors.email = true;
    if (!form.role) newErrors.role = true;

    const pwdErr = validatePassword(form.password);
    if (pwdErr) { newErrors.password = true; toast.error(pwdErr); }
    if (form.password !== form.confirmPassword) { newErrors.confirmPassword = true; if (!pwdErr) toast.error('Passwords do not match'); }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.name || newErrors.email || newErrors.role) toast.error('Please fill out all required fields');
      return;
    }

    setLoading(true);
    try {
      await requestRegisterOTP(form.email, form.role, undefined, turnstileToken);
      toast.success('OTP sent to your email!');
      setOtpStep(true);
    } catch (err) {
      toast.error(err.message || 'Failed to send OTP. Please try again.');
    }
    setLoading(false);
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--foreground)', letterSpacing: '-0.02em' }}>Join us</h2>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '1rem' }}>Create your academic account</p>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {otpStep ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem 0' }}>
              <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '1rem' }}>
                Enter the 6-digit code sent to <br /><strong style={{ color: 'var(--foreground)' }}>{form.email}</strong>
              </p>
              <div className="form-group">
                <input 
                  className="input" autoComplete="off" placeholder="000000" 
                  style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.75rem', padding: '1.25rem', fontWeight: 600, borderRadius: 'calc(var(--radius) * 0.75)' }} 
                  value={otpValue} onChange={e => setOtpValue(e.target.value)} maxLength={6} 
                />
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="reg-name" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Full Name</label>
                  <input 
                    id="reg-name" autoComplete="off" className="input" placeholder="Jane Doe" 
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} 
                    style={{ padding: '0.875rem 1rem', fontSize: '0.95rem', borderRadius: 'calc(var(--radius) * 0.75)', ...(errors.name ? { border } : {}) }} 
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.1rem' }}>Username is locked after registration</p>
                </div>
                <div className="form-group">
                  <label htmlFor="reg-role" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Role</label>
                  <select 
                    id="reg-role" className="select" 
                    value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} 
                    style={{ padding: '0.875rem 1rem', fontSize: '0.95rem', borderRadius: 'calc(var(--radius) * 0.75)', ...(errors.role ? { border } : {}) }}
                  >
                    <option value="" disabled hidden>Select Role</option>
                    <option value="student">Author</option>
                    <option value="reviewer">Reviewer</option>
                  </select>
                </div>
              </div>

              <AnimatePresence>
                {/* Admin registration is completely hidden from the public UI */}
              </AnimatePresence>

              <div className="form-group">
                <label htmlFor="reg-email" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Email address</label>
                <input 
                  id="reg-email" type="email" autoComplete="off" className="input" placeholder="name@example.com" 
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} 
                  style={{ padding: '0.875rem 1rem', fontSize: '0.95rem', borderRadius: 'calc(var(--radius) * 0.75)', ...(errors.email ? { border } : {}) }} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="reg-password" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      id="reg-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="input" placeholder="••••••••" 
                      value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} 
                      style={{ padding: '0.875rem 3rem 0.875rem 1rem', fontSize: '0.95rem', borderRadius: 'calc(var(--radius) * 0.75)', ...(errors.password ? { border } : {}) }} 
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex' }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {form.password.length > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: form.password.length >= 8 ? '#10b981' : 'var(--muted-foreground)' }}>
                        {form.password.length >= 8 ? <Check size={14} /> : <X size={14} style={{ opacity: 0.5 }} />} At least 8 characters
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: /[0-9]/.test(form.password) ? '#10b981' : 'var(--muted-foreground)' }}>
                        {/[0-9]/.test(form.password) ? <Check size={14} /> : <X size={14} style={{ opacity: 0.5 }} />} Contains a number
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: /[A-Z]/.test(form.password) ? '#10b981' : 'var(--muted-foreground)' }}>
                        {/[A-Z]/.test(form.password) ? <Check size={14} /> : <X size={14} style={{ opacity: 0.5 }} />} Contains uppercase
                      </span>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="reg-confirm" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      id="reg-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="input" placeholder="••••••••" 
                      value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} 
                      style={{ padding: '0.875rem 3rem 0.875rem 1rem', fontSize: '0.95rem', borderRadius: 'calc(var(--radius) * 0.75)', ...(errors.confirmPassword ? { border } : {}) }} 
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex' }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {form.confirmPassword.length > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                      {form.password === form.confirmPassword ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10b981' }}><Check size={14} /> Passwords match</span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#ef4444' }}><X size={14} /> Passwords do not match</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Turnstile CAPTCHA — shown only on the initial form step, not the OTP entry step */}
          {!otpStep && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.25rem' }}>
              <Turnstile
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                onSuccess={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
                onError={() => setTurnstileToken(null)}
                options={{ theme: 'auto' }}
              />
            </div>
          )}

          <motion.button
            type="submit" disabled={loading}
            whileHover={!loading ? { scale: 1.01 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
            className="btn"
            style={{ 
              marginTop: '1rem',
              width: '100%', padding: '0.875rem', fontWeight: 600, fontSize: '1rem', 
              background: 'linear-gradient(135deg, var(--gold), var(--primary))', 
              color: '#fff', border: 'none', 
              boxShadow: '0 8px 24px rgba(29, 78, 216, 0.25), inset 0 1px 1px rgba(255,255,255,0.2)', 
              borderRadius: 'calc(var(--radius) * 0.75)' 
            }}
          >
            {loading ? <><div className="spinner-sm" /> Processing…</> : (otpStep ? 'Verify OTP' : 'Create Account')}
          </motion.button>
        </form>

        <div style={{ marginTop: '2.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--muted-foreground)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </div>
      </motion.div>
    </AuthLayout>
  );
}
