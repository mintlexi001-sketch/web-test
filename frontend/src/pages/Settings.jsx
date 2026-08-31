import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, CheckCircle2, Circle } from 'lucide-react'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { sendNotification } from '../lib/api'
import { supabase } from '../lib/supabase'
import ConfirmModal from '../components/ConfirmModal'

export default function Settings() {
  const { user, profile } = useAuth()
  const toast = useToast()

  const [email, setEmail] = useState('')
  
  // ── Email Modal State
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [otp, setOtp] = useState('')

  // ── Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // ── Account Deletion State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.email) setEmail(user.email)
  }, [user])

  // Get name fallback (handles admin users or delayed profile loads)
  const displayName = profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Unknown User'

  const PERMANENT_ADMIN_EMAIL = import.meta.env.VITE_PERMANENT_ADMIN_EMAIL || 'nirmala.scienceandsociety@gmail.com'
  const isPermanentAdmin = user?.email === PERMANENT_ADMIN_EMAIL || profile?.is_permanent === true

  // ── Handlers: Email Change ────────────────────────────────────────
  const handleSendEmailOTP = async (e) => {
    e.preventDefault()
    if (!newEmail || newEmail.trim() === email.trim()) return toast.error('Enter a different email address')
    setLoading(true)
    try {
      const res = await sendNotification('/api/auth/email-change-otp', { newEmail: newEmail.trim() })
      if (!res) throw new Error('Network error: Unable to connect to the server')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOtpStep(true)
      toast.success('Verification code sent to your new email!')
    } catch (err) {
      toast.error(err.message || 'Failed to send verification code')
    }
    setLoading(false)
  }

  const handleVerifyEmailOTP = async (e) => {
    e.preventDefault()
    if (!otp || otp.length !== 6) return toast.error('Enter the 6-digit code')
    setLoading(true)
    try {
      const res = await sendNotification('/api/auth/verify-email-change', { newEmail: newEmail.trim(), otp })
      if (!res) throw new Error('Network error: Unable to connect to the server')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEmail(newEmail.trim())
      closeEmailModal()
      toast.success('Email address updated successfully!')
    } catch (err) {
      toast.error(err.message || 'Invalid or expired verification code')
    }
    setLoading(false)
  }

  const closeEmailModal = () => {
    setShowEmailModal(false)
    setOtpStep(false)
    setNewEmail('')
    setOtp('')
  }

  // ── Handlers: Password Change ─────────────────────────────────────
  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (!currentPassword) return toast.error('Please enter your current password')
    if (newPassword.length < 8) return toast.error('Password must be at least 8 characters')
    if (!/[0-9]/.test(newPassword)) return toast.error('Password must include at least one number')
    if (!/[A-Z]/.test(newPassword)) return toast.error('Password must include at least one uppercase letter')
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match')

    setLoading(true)
    try {
      // 1. Verify old password first
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      })
      if (signInError || !data?.user) {
        throw new Error('Incorrect current password')
      }

      // 2. Update to new password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      toast.success('Password updated successfully!')
      closePasswordModal()
    } catch (err) {
      toast.error(err.message || 'Failed to update password')
    }
    setLoading(false)
  }

  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowCurrent(false)
    setShowNew(false)
    setShowConfirm(false)
  }

  // ── Handlers: Account Deletion ────────────────────────────────────
  const handleScheduleDeletion = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.rpc('schedule_account_deletion')
      if (error) throw new Error(error.message)
      
      toast.success('Deletion requested. Sign back in within 15 days to cancel.')
      setTimeout(() => supabase.auth.signOut(), 2500)
    } catch (err) {
      toast.error(err.message || 'Failed to request deletion')
    }
    setLoading(false)
  }

  const pwRules = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'At least one number', met: /[0-9]/.test(newPassword) },
    { label: 'At least one uppercase letter', met: /[A-Z]/.test(newPassword) },
  ]

  // Inline layout styles for a professional look
  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }
  const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }
  const valStyle = { fontSize: '1.125rem', color: 'var(--foreground)', fontWeight: 500 }
  const actionBtnStyle = { fontSize: '0.875rem', padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' }

  return (
    <div className="space-y-6 relative" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account profile and security preferences.</p>
      </div>

      {/* Unified Professional Settings Card */}
      <div className="card" style={{ padding: '2rem' }}>
        
        {/* Username */}
        <div style={rowStyle}>
          <div>
            <p style={labelStyle}>Username</p>
            <p style={valStyle}>{displayName}</p>
          </div>
        </div>

        {/* Email */}
        <div style={rowStyle}>
          <div>
            <p style={labelStyle}>Email Address</p>
            <p style={valStyle}>{email || 'Loading...'}</p>
          </div>
          {!isPermanentAdmin && (
            <button 
              type="button" 
              onClick={() => setShowEmailModal(true)} 
              style={actionBtnStyle}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Change
            </button>
          )}
        </div>

        {/* Password */}
        <div style={rowStyle}>
          <div>
            <p style={labelStyle}>Password</p>
            <p style={{ ...valStyle, letterSpacing: '0.2em', marginTop: '0.25rem' }}>••••••••</p>
          </div>
          <button 
            type="button" 
            onClick={() => setShowPasswordModal(true)} 
            style={actionBtnStyle}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Update
          </button>
        </div>

        {/* Account Deletion */}
        {!isPermanentAdmin && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <div>
              <p style={{ ...labelStyle }}>Account Management</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Permanently deactivate and delete your account. A 15-day recovery window applies.</p>
            </div>
            <button 
              type="button" 
              onClick={() => setDeleteConfirmOpen(true)} 
              disabled={loading}
              style={{ ...actionBtnStyle, color: 'var(--foreground)', borderColor: 'var(--border)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--surface)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              Deactivate Account
            </button>
          </div>
        )}

      </div>

      {/* ── MODALS ─────────────────────────────────────────── */}
      
      {/* Email Modal */}
      {showEmailModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', margin: '1rem', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <button onClick={closeEmailModal} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
              <X size={20} />
            </button>
            <div className="card-header" style={{ paddingBottom: '1rem' }}>
              <div className="card-title">Change Email Address</div>
              <div className="card-description">Enter your new email address to receive a verification code.</div>
            </div>
            <div className="card-content">
              {!otpStep ? (
                <form onSubmit={handleSendEmailOTP} className="space-y-4">
                  <div className="form-group">
                    <label>New Email</label>
                    <input type="email" className="input" placeholder="name@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="off" required />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !newEmail}>
                    {loading ? 'Sending…' : 'Send Verification Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyEmailOTP} className="space-y-4">
                  <div className="form-group">
                    <label>Verification Code</label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>A 6-digit code was sent to <strong>{newEmail}</strong>.</p>
                    <input type="text" className="input" placeholder="000000" maxLength={6} style={{ letterSpacing: '8px', textAlign: 'center', fontWeight: 700, fontSize: '1.5rem' }} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} autoComplete="off" />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || otp.length !== 6}>
                    {loading ? 'Verifying…' : 'Confirm & Update Email'}
                  </button>
                  <button type="button" className="btn btn-outline" style={{ width: '100%' }} onClick={() => setOtpStep(false)} disabled={loading}>
                    Back
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', margin: '1rem', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <button onClick={closePasswordModal} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
              <X size={20} />
            </button>
            <div className="card-header" style={{ paddingBottom: '1rem' }}>
              <div className="card-title">Update Password</div>
              <div className="card-description">Verify your current password to set a new one.</div>
            </div>
            <div className="card-content">
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="form-group">
                  <label>Current Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showCurrent ? 'text' : 'password'} className="input" placeholder="Enter current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" style={{ paddingRight: '2.75rem' }} required />
                    <button type="button" onClick={() => setShowCurrent(v => !v)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center' }}>
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                
                <div className="form-group" style={{ marginTop: '1.5rem' }}>
                  <label>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showNew ? 'text' : 'password'} className="input" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" style={{ paddingRight: '2.75rem' }} required />
                    <button type="button" onClick={() => setShowNew(v => !v)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center' }}>
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {newPassword.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {pwRules.map(r => (
                        <li key={r.label} style={{ fontSize: '0.75rem', color: r.met ? '#22c55e' : 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                            {r.met ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                          </span> {r.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showConfirm ? 'text' : 'password'} className="input" placeholder="Repeat new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" style={{ paddingRight: '2.75rem' }} required />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center' }}>
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.35rem' }}>Passwords do not match</p>
                  )}
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}>
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Request account deletion?"
        message="You will be signed out immediately. You have 15 days to cancel by simply signing back in. After 15 days, your account is permanently removed. Published journals are preserved."
        confirmText="Yes, deactivate account"
        cancelText="Cancel"
        onConfirm={() => {
          setDeleteConfirmOpen(false)
          handleScheduleDeletion()
        }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  )
}
