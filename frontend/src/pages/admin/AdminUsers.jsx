import { useEffect, useState } from 'react'
import { Search, Trash2, RefreshCw, CheckCircle2, XCircle, Clock, ShieldCheck, ShieldOff, ShieldAlert } from 'lucide-react'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../../components/ConfirmModal'
import { useAuth } from '../../context/AuthContext'
import { sendNotification } from '../../lib/api'

// The main permanent admin email — used as a UI safety guard
const PERMANENT_ADMIN_EMAIL = import.meta.env.VITE_PERMANENT_ADMIN_EMAIL || 'nirmala.scienceandsociety@gmail.com'

export default function AdminUsers() {
  const toast = useToast()
  const { profile: currentUserProfile } = useAuth()
  const [users,         setUsers]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [roleFilter,    setRoleFilter]    = useState('student')
  const [actionLoading, setActionLoading] = useState(null)

  // Confirmation modal state
  const [confirmOpen,    setConfirmOpen]    = useState(false)
  const [confirmData,    setConfirmData]    = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Is the currently logged-in admin the permanent one?
  const isPermanentAdmin = currentUserProfile?.is_permanent === true ||
                           currentUserProfile?.email === PERMANENT_ADMIN_EMAIL

  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchUsers is stable and intentionally mount-only
  useEffect(() => { fetchUsers() }, [])


  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) { toast.error('Failed to load users'); setLoading(false); return }
    setUsers(data ?? [])
    setLoading(false)
  }

  async function approveUser(user) {
    setActionLoading(user.id)
    const { error } = await supabase.rpc('approve_reviewer', { p_user_id: user.id })
    if (error) {
      toast.error('Failed to approve user: ' + error.message)
    } else {
      // Send approval email securely
      const res = await sendNotification('/api/notify/reviewer-approved', { userId: user.id, userName: user.name });
      if (!res || !res.ok) {
        toast.error('Reviewer approved, but failed to send email notification.', { duration: 5000 });
      } else {
        toast.success('Reviewer approved successfully!')
      }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: 'active' } : u))
      window.dispatchEvent(new Event('users-updated'))
    }
    setActionLoading(null)
  }

  async function rejectUser(user) {
    setActionLoading(user.id)
    const { error } = await supabase.rpc('delete_user', { target_user_id: user.id })
    if (error) {
      toast.error('Failed to reject user: ' + error.message)
    } else {
      const res = await sendNotification('/api/notify/reviewer-rejected', { userId: user.id, userName: user.name });
      const emailFailed = !res || !res.ok;
      if (emailFailed) {
        toast.error('Reviewer rejected, but failed to send email notification.', { duration: 5000 });
      } else {
        toast.success('Reviewer application rejected and notified.')
      }
      setUsers(prev => prev.filter(u => u.id !== user.id))
      window.dispatchEvent(new Event('users-updated'))
    }
    setActionLoading(null)
  }

  async function banUser(user) {
    setActionLoading(user.id)
    const { error } = await supabase.rpc('ban_user', { p_user_id: user.id })
    if (error) {
      toast.error('Failed to ban user: ' + error.message)
    } else {
      // Send email notification securely
      let emailFailed = false;
      const res = await sendNotification('/api/notify/ban', { userId: user.id, userName: user.name, reason: '' });
      if (!res || !res.ok) emailFailed = true;

      if (emailFailed) {
        toast.error('User suspended, but failed to send email notification.', { duration: 5000 });
      } else {
        toast.success(`${user.name} has been suspended.`)
      }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: 'inactive' } : u))
      window.dispatchEvent(new Event('users-updated'))
    }
    setActionLoading(null)
  }

  async function unbanUser(user) {
    setActionLoading(user.id)
    const { error } = await supabase.rpc('unban_user', { p_user_id: user.id })
    if (error) {
      toast.error('Failed to reinstate user: ' + error.message)
    } else {
      // Send email notification securely
      let emailFailed = false;
      const res = await sendNotification('/api/notify/unban', { userId: user.id, userName: user.name });
      if (!res || !res.ok) emailFailed = true;

      if (emailFailed) {
        toast.error('User reinstated, but failed to send email notification.', { duration: 5000 });
      } else {
        toast.success(`${user.name} has been reinstated.`)
      }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: 'active' } : u))
      window.dispatchEvent(new Event('users-updated'))
    }
    setActionLoading(null)
  }

  async function deleteUser(user) {
    setActionLoading(user.id)
    const { error } = await supabase.rpc('delete_user', { target_user_id: user.id })
    if (error) {
      toast.error('Failed to delete user: ' + error.message)
    } else {
      const res = await sendNotification('/api/notify/delete-account', { userId: user.id, userName: user.name, role: user.role });
      const emailFailed = !res || !res.ok;
      if (emailFailed) {
        toast.error('User deleted, but failed to send email notification.', { duration: 5000 });
      } else {
        toast.success('User deleted and notified by email.')
      }
      setUsers(prev => prev.filter(u => u.id !== user.id))
      window.dispatchEvent(new Event('users-updated'))
    }
    setActionLoading(null)
  }

  function triggerDelete(user) {
    setConfirmData({ type: 'delete', user })
    setConfirmOpen(true)
  }

  function triggerBan(user) {
    setConfirmData({ type: 'ban', user })
    setConfirmOpen(true)
  }

  function triggerReject(user) {
    setConfirmData({ type: 'reject', user })
    setConfirmOpen(true)
  }

  async function handleConfirm() {
    if (!confirmData) return
    setConfirmLoading(true)
    if (confirmData.type === 'delete') await deleteUser(confirmData.user)
    else if (confirmData.type === 'ban') await banUser(confirmData.user)
    else if (confirmData.type === 'reject') await rejectUser(confirmData.user)
    setConfirmLoading(false)
    setConfirmOpen(false)
    setConfirmData(null)
  }

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                        (u.email ?? '').toLowerCase().includes(search.toLowerCase())
    const matchRole = u.role === roleFilter
    return matchSearch && matchRole
  })

  const studentCount  = users.filter(u => u.role === 'student').length
  const reviewerCount = users.filter(u => u.role === 'reviewer').length
  const adminCount    = users.filter(u => u.role === 'admin').length
  const pendingCount  = users.filter(u => u.status === 'pending').length

  // Determine what actions to show for a given user row
  function renderActions(u) {
    const isMe = u.id === currentUserProfile?.id
    const isThisUserPermanent = u.is_permanent || u.email === PERMANENT_ADMIN_EMAIL

    // The permanent admin row always shows "Protected" — no actions from anyone
    if (isThisUserPermanent) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem' }}>
          <ShieldCheck size={14} /> Protected
        </span>
      )
    }

    // Sub-admins (not permanent) cannot act on other admins
    if (u.role === 'admin' && !isPermanentAdmin) {
      return <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>—</span>
    }

    // The logged-in admin cannot delete themselves
    if (isMe) {
      return <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>—</span>
    }

    // Pending reviewer → Approve / Reject
    if (u.status === 'pending') {
      return (
        <>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', opacity: actionLoading === u.id ? 0.6 : 1 }}
            disabled={actionLoading === u.id}
            onClick={() => approveUser(u)}
          >
            <CheckCircle2 size={14} /> Approve
          </button>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--destructive)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', opacity: actionLoading === u.id ? 0.6 : 1 }}
            disabled={actionLoading === u.id}
            onClick={() => triggerReject(u)}
          >
            <XCircle size={14} /> Reject
          </button>
        </>
      )
    }

    // Active / Inactive → Ban / Unban + Delete
    return (
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {u.status === 'active' ? (
          <button
            className="btn btn-primary btn-sm"
            style={{  display: 'inline-flex', alignItems: 'center', gap: '0.3rem', opacity: actionLoading === u.id ? 0.6 : 1 }}
            disabled={actionLoading === u.id}
            title="Suspend account"
            onClick={() => triggerBan(u)}
          >
            <ShieldOff size={14} /> Suspend
          </button>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', opacity: actionLoading === u.id ? 0.6 : 1 }}
            disabled={actionLoading === u.id}
            title="Reinstate account"
            onClick={() => unbanUser(u)}
          >
            <ShieldAlert size={14} /> Reinstate
          </button>
        )}
        <button
          className="btn btn-primary btn-sm"
          style={{  display: 'inline-flex', alignItems: 'center', gap: '0.35rem', opacity: actionLoading === u.id ? 0.6 : 1 }}
          disabled={actionLoading === u.id}
          title="Permanently delete account"
          onClick={() => triggerDelete(u)}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    )
  }

  const confirmTitle   = confirmData?.type === 'delete' ? 'Delete User?' : confirmData?.type === 'reject' ? 'Reject Application?' : 'Suspend User?'
  const confirmMessage = confirmData?.type === 'delete'
    ? `Are you sure you want to permanently delete ${confirmData?.user?.name}? They will receive an email notification. This cannot be undone.`
    : confirmData?.type === 'reject'
      ? `Are you sure you want to decline the reviewer application for ${confirmData?.user?.name}? This will delete their pending account and notify them via email.`
      : `Suspend ${confirmData?.user?.name}? They will be locked out and notified by email. You can reinstate them later.`

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manage Users</h1>
          <p className="page-subtitle">View and manage all registered users</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline btn-sm" onClick={fetchUsers} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        {[
          { label: 'Total Users', value: users.length },
          { label: 'Authors',     value: studentCount },
          { label: 'Reviewers',   value: reviewerCount },
          { label: 'Admins',      value: adminCount },
        ].map(({ label, value }) => (
          <div key={label} className="card">
            <div className="card-content" style={{ paddingTop: '1rem' }}>
              <p className="stat-val">{loading ? '—' : value}</p>
              <p className="stat-label">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
          <input className="input input-icon-left" style={{ paddingLeft: '2.5rem' }}
            placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['student', 'reviewer', 'admin'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)} className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-outline'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {r === 'student' ? 'Author' : r.charAt(0).toUpperCase() + r.slice(1)}
              {r === 'reviewer' && pendingCount > 0 && (
                <span style={{
                  background: roleFilter === 'reviewer' ? '#fff' : '#f59e0b',
                  color: roleFilter === 'reviewer' ? 'var(--primary)' : '#fff',
                  fontSize: '0.7rem', fontWeight: 'bold', minWidth: '20px', height: '20px',
                  borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px',
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>Loading users…</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{u.name}</td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{u.email ?? '—'}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-default' : u.role === 'reviewer' ? 'badge-default' : 'badge-secondary'}`}
                      style={{ textTransform: 'capitalize' }}>{u.role}</span>
                  </td>
                  <td>
                    {u.status === 'pending' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b', fontWeight: 500, fontSize: '0.8125rem' }}>
                        <Clock size={13} /> Pending
                      </span>
                    ) : (
                      <span className={u.status === 'active' ? 'status-approved' : 'status-rejected'}>
                        {u.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--muted-foreground)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="table-actions">
                      {renderActions(u)}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: '2rem' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer" style={{ paddingTop: '0.75rem', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
          Showing {filtered.length} of {users.length} users
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={confirmData?.type === 'delete' ? 'Delete' : confirmData?.type === 'reject' ? 'Reject' : 'Suspend'}
        loading={confirmLoading}
        type="danger"
      />
    </div>
  )
}
