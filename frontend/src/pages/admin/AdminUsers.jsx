import { useEffect, useState } from 'react'
import { Search, Trash2, RefreshCw, CheckCircle2, XCircle, Clock, ShieldCheck, ShieldOff, ShieldAlert, UserCog, Settings, ChevronDown, MoreVertical, UserCheck } from 'lucide-react'
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
  const [openMenuId,    setOpenMenuId]    = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  // Confirmation modal state
  const [confirmOpen,    setConfirmOpen]    = useState(false)
  const [confirmData,    setConfirmData]    = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Is the currently logged-in admin the permanent one?
  const isPermanentAdmin = currentUserProfile?.is_permanent === true ||
                           currentUserProfile?.email === PERMANENT_ADMIN_EMAIL

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchUsers() }, [])

  useEffect(() => {
    const handleOutsideClick = () => setOpenMenuId(null)
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

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

  async function promoteUser(user) {
    setActionLoading(user.id)
    const { error } = await supabase.rpc('promote_to_admin', { p_user_id: user.id })
    if (error) {
      toast.error('Failed to promote user: ' + error.message)
    } else {
      toast.success(`${user.name} has been promoted to Admin.`)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: 'admin' } : u))
      window.dispatchEvent(new Event('users-updated'))
    }
    setActionLoading(null)
  }

  async function demoteUser(user) {
    setActionLoading(user.id)
    const { error } = await supabase.rpc('demote_from_admin', { p_user_id: user.id })
    if (error) {
      toast.error('Failed to demote user: ' + error.message)
    } else {
      toast.success(`${user.name} has been demoted back to Author.`)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: 'student' } : u))
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

  function triggerPromote(user) {
    setConfirmData({ type: 'promote', user })
    setConfirmOpen(true)
  }

  function triggerDemote(user) {
    setConfirmData({ type: 'demote', user })
    setConfirmOpen(true)
  }

  async function handleConfirm() {
    if (!confirmData) return
    setConfirmLoading(true)
    if (confirmData.type === 'delete') await deleteUser(confirmData.user)
    else if (confirmData.type === 'ban') await banUser(confirmData.user)
    else if (confirmData.type === 'reject') await rejectUser(confirmData.user)
    else if (confirmData.type === 'promote') await promoteUser(confirmData.user)
    else if (confirmData.type === 'demote') await demoteUser(confirmData.user)
    setConfirmLoading(false)
    setConfirmOpen(false)
    setConfirmData(null)
  }

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                        (u.email ?? '').toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  const studentCount  = users.filter(u => u.role === 'student').length
  const reviewerCount = users.filter(u => u.role === 'reviewer').length
  const adminCount    = users.filter(u => u.role === 'admin').length
  const pendingCount  = users.filter(u => u.status === 'pending').length

  // ── Render Actions: Operation Selector Dropdown with Icons ─────────────────
  function renderActions(u) {
    const isMe = u.id === currentUserProfile?.id
    const isThisUserPermanent = u.is_permanent || u.email === PERMANENT_ADMIN_EMAIL

    if (isThisUserPermanent) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.78rem' }}>
          <ShieldCheck size={14} /> System Admin
        </span>
      )
    }

    if (u.role === 'admin' && !isPermanentAdmin) {
      return <span style={{ color: 'var(--muted-foreground)', fontSize: '0.78rem' }}>Protected Admin</span>
    }

    if (isMe) {
      return <span style={{ color: 'var(--muted-foreground)', fontSize: '0.78rem' }}>Current Session</span>
    }

    // Pending reviewer application → Quick Approve / Reject buttons
    if (u.status === 'pending') {
      return (
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <button
            className="btn btn-sm"
            style={{ background: '#16a34a', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            disabled={actionLoading === u.id}
            onClick={() => approveUser(u)}
          >
            <CheckCircle2 size={13} /> Approve
          </button>
          <button
            className="btn btn-sm"
            style={{ background: '#dc2626', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            disabled={actionLoading === u.id}
            onClick={() => triggerReject(u)}
          >
            <XCircle size={13} /> Reject
          </button>
        </div>
      )
    }

    // Active / Inactive / Admin → Single Gear Icon Button with Horizontal Action Popover
    const isMenuOpen = openMenuId === u.id

    return (
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{
            width: '28px',
            height: '28px',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-md)',
            background: isMenuOpen ? 'var(--muted)' : 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
            cursor: 'pointer',
          }}
          disabled={actionLoading === u.id}
          onClick={(e) => {
            e.stopPropagation()
            setOpenMenuId(isMenuOpen ? null : u.id)
          }}
          title="Click to perform user operations"
        >
          <Settings size={14} style={{ color: 'var(--muted-foreground)' }} />
        </button>

        {isMenuOpen && (
          <div
            style={{
              position: 'absolute',
              right: 'calc(100% + 6px)',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 100,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
              padding: '0.25rem 0.4rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              whiteSpace: 'nowrap'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {isPermanentAdmin && u.status === 'active' && u.role !== 'admin' && (
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  fontSize: '0.75rem', padding: '0.2rem 0.5rem',
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.3)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600
                }}
                onClick={() => { setOpenMenuId(null); triggerPromote(u); }}
              >
                <ShieldCheck size={13} /> Promote
              </button>
            )}

            {isPermanentAdmin && u.role === 'admin' && (
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  fontSize: '0.75rem', padding: '0.2rem 0.5rem',
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', border: '1px solid rgba(217, 119, 6, 0.3)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600
                }}
                onClick={() => { setOpenMenuId(null); triggerDemote(u); }}
              >
                <ShieldOff size={13} /> Demote
              </button>
            )}

            {u.status === 'active' ? (
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  fontSize: '0.75rem', padding: '0.2rem 0.5rem',
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', border: '1px solid rgba(217, 119, 6, 0.3)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600
                }}
                onClick={() => { setOpenMenuId(null); triggerBan(u); }}
              >
                <ShieldAlert size={13} /> Suspend
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  fontSize: '0.75rem', padding: '0.2rem 0.5rem',
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', border: '1px solid rgba(22, 163, 74, 0.3)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600
                }}
                onClick={() => { setOpenMenuId(null); unbanUser(u); }}
              >
                <UserCheck size={13} /> Reinstate
              </button>
            )}

            <button
              type="button"
              className="btn btn-sm"
              style={{
                fontSize: '0.75rem', padding: '0.2rem 0.5rem',
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600
              }}
              onClick={() => { setOpenMenuId(null); triggerDelete(u); }}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>
    )
  }

  const confirmTitle = confirmData?.type === 'delete'  ? 'Delete User?'
    : confirmData?.type === 'reject'  ? 'Reject Application?'
    : confirmData?.type === 'promote' ? 'Promote to Admin?'
    : confirmData?.type === 'demote'  ? 'Demote Admin?'
    : 'Suspend User?'

  const confirmMessage = confirmData?.type === 'delete'
    ? `Are you sure you want to permanently delete ${confirmData?.user?.name}? They will receive an email notification. This cannot be undone.`
    : confirmData?.type === 'reject'
      ? `Are you sure you want to decline the reviewer application for ${confirmData?.user?.name}? This will delete their pending account and notify them via email.`
      : confirmData?.type === 'promote'
        ? `Promote ${confirmData?.user?.name} to Admin? They will gain full administrative access to the system.`
        : confirmData?.type === 'demote'
          ? `Demote ${confirmData?.user?.name} back to Author? They will lose all admin access immediately.`
          : `Suspend ${confirmData?.user?.name}? They will be locked out and notified by email. You can reinstate them later.`

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manage Users</h1>
          <p className="page-subtitle">View and manage all registered user accounts and reviewer applications</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline btn-sm" onClick={fetchUsers} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['all', 'student', 'reviewer', 'admin'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-outline'}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 0.85rem', fontWeight: 600, fontSize: '0.85rem',
                borderRadius: 'var(--radius-md)',
                background: roleFilter === r ? 'var(--primary)' : 'var(--card)',
                color: roleFilter === r ? '#ffffff' : 'var(--foreground)',
                border: roleFilter === r ? '1px solid var(--primary)' : '1px solid var(--border)',
                cursor: 'pointer'
              }}
            >
              {r === 'all' ? 'All Users' : r === 'student' ? 'Authors' : r.charAt(0).toUpperCase() + r.slice(1) + 's'}
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
                    <span className={`badge ${u.role === 'admin' ? 'badge-default' : u.role === 'reviewer' ? 'badge-default' : 'badge-secondary'}`}>
                      {u.role === 'student' ? 'Author' : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </span>
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
        confirmText={
          confirmData?.type === 'delete'  ? 'Delete'   :
          confirmData?.type === 'reject'  ? 'Reject'   :
          confirmData?.type === 'promote' ? 'Promote'  :
          confirmData?.type === 'demote'  ? 'Demote'   :
          'Suspend'
        }
        loading={confirmLoading}
        type={confirmData?.type === 'promote' ? 'warning' : 'danger'}
      />
    </div>
  )
}
