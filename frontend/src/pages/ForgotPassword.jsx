import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Home, Eye, EyeOff, Mail, ShieldCheck, KeyRound } from 'lucide-react'
import { API_BASE } from '../lib/api'


export default function ForgotPassword() {
  const navigate = useNavigate()

  // Steps: 'email' → 'reset' → 'success'
  const [step, setStep] = useState('email')

  const [email, setEmail] = useState('')
  const [otpInput, setOtpInput] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  /* ── Helpers ──────────────────────────────────────────── */

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters.'
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number.'
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter.'
    return ''
  }

  /* ── Step 1 – Send OTP ───────────────────────────────── */

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send OTP')
      }
      setStep('reset')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    }

    setLoading(false)
  }

  /* ── Step 2 – Update Password ────────────────────────── */

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setError('')
    setPasswordError('')

    const valErr = validatePassword(newPassword)
    if (valErr) {
      setPasswordError(valErr)
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpInput, newPassword })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update password')
      }
      
      setStep('success')
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update password. It is possible your OTP has expired.')
    }

    setLoading(false)
  }

  /* ── Render helpers ──────────────────────────────────── */

  const renderStepIndicator = () => {
    const steps = [
      { key: 'email', label: 'Email', icon: <Mail size={14} /> },
      { key: 'reset', label: 'Reset', icon: <KeyRound size={14} /> }
    ]
    const currentIdx = steps.findIndex(s => s.key === step)

    return (
      <div className="fp-steps">
        {steps.map((s, i) => (
          <div key={s.key} className={`fp-step-item ${i <= currentIdx ? 'active' : ''} ${i < currentIdx ? 'done' : ''}`}>
            <div className="fp-step-dot">{s.icon}</div>
            <span className="fp-step-label">{s.label}</span>
            {i < steps.length - 1 && <div className="fp-step-line" />}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="auth-page login-page-override">
      {/* Top bar – same as Login */}
      <div className="login-topbar">
        <div className="login-topbar-brand">
          <BookOpen size={24} />
          <span style={{ fontWeight: 600, fontSize: '1.125rem' }}>Science and Society</span>
        </div>
        <Link to="/" aria-label="Home" className="login-topbar-home">
          <Home size={20} />
        </Link>
      </div>

      <div className="auth-wrapper login-wrapper-override">
        <div className="auth-card card">
          <div className="auth-card-header">
            <div className="auth-card-title">
              {step === 'success' ? 'All Done!' : 'Reset Password'}
            </div>
            <div className="auth-card-desc">
              {step === 'email' && 'Enter your email to receive a one-time password.'}
              {step === 'reset' && 'Enter the OTP and your new password.'}
              {step === 'success' && 'Your password has been updated.'}
            </div>

            {step !== 'success' && (
              <div style={{ marginTop: '1.25rem' }}>{renderStepIndicator()}</div>
            )}
          </div>

          <div className="auth-card-body">
            {/* Global error banner */}
            {error && (
              <div className="fp-error-banner">
                {error}
              </div>
            )}

            {/* ── Step: Email ───────────────────────── */}
            {step === 'email' && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="form-group">
                  <label htmlFor="fp-email">Email address</label>
                  <input
                    id="fp-email"
                    type="email"
                    className="input"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>


                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                  {loading ? (
                    <span className="fp-btn-loading"><span className="fp-spinner" /> Sending...</span>
                  ) : (
                    'Send OTP'
                  )}
                </button>
              </form>
            )}

            {/* ── Step: Reset (OTP + New Password) ────────────────── */}
            {step === 'reset' && (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="fp-success-banner">
                  OTP sent! Please check your email inbox and spam folder.
                </div>

                <div className="form-group">
                  <label htmlFor="fp-otp">One-Time Password</label>
                  <input
                    id="fp-otp"
                    type="text"
                    className="input"
                    placeholder="Enter the 6-digit OTP"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    autoComplete="one-time-code"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fp-password">New Password</label>
                  <div className="password-wrapper">
                    <input
                      id="fp-password"
                      type={showPassword ? 'text' : 'password'}
                      className="input"
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPasswordError('') }}
                      style={{ paddingRight: '2.5rem' }}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(v => !v)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {passwordError && (
                    <span className="fp-field-error">{passwordError}</span>
                  )}
                  <ul className="fp-pw-rules">
                    <li className={newPassword.length >= 8 ? 'met' : ''}>At least 8 characters</li>
                    <li className={/[0-9]/.test(newPassword) ? 'met' : ''}>At least one number</li>
                    <li className={/[A-Z]/.test(newPassword) ? 'met' : ''}>At least one uppercase letter</li>
                  </ul>
                </div>

                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                  {loading ? (
                    <span className="fp-btn-loading"><span className="fp-spinner" /> Updating password...</span>
                  ) : (
                    'Verify & Update Password'
                  )}
                </button>
                
                <button
                  type="button"
                  className="btn btn-outline w-full"
                  style={{ marginTop: '0.5rem' }}
                  disabled={loading}
                  onClick={() => { setStep('email'); setError(''); setOtpInput('') }}
                >
                  Resend OTP
                </button>
              </form>
            )}

            {/* ── Step: Success ─────────────────────── */}
            {step === 'success' && (
              <div className="fp-success-final">
                <div className="fp-success-icon">
                  <ShieldCheck size={40} />
                </div>
                <p className="fp-success-text">
                  Password updated successfully! Redirecting to login...
                </p>
                <div className="fp-progress-bar"><div className="fp-progress-fill" /></div>
              </div>
            )}
          </div>

          {step === 'email' && (
            <div className="auth-card-footer">
              Remember your password?{' '}
              <Link to="/login" className="auth-link">Sign in</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
