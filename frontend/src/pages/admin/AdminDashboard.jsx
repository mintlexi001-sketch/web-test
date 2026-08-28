import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Users, Clock, TrendingUp, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const statusLabels = { submitted: 'Submitted', under_review: 'Under Review', approved: 'Approved', rejected: 'Rejected', revision_required: 'Revision Required', published: 'Published' }

export default function AdminDashboard() {
  const [stats, setStats]           = useState({ total: 0, users: 0, pending: 0, approved: 0 })
  const [recentJournals, setJournals] = useState([])
  const [recentUsers,    setUsers]    = useState([])
  const [requests,       setRequests] = useState([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => { fetchAll() }, [])


  async function fetchAll() {
    setLoading(true)

    const [journalsRes, profilesRes, pendingRes, approvedRes, recentJRes, recentURes, reqRes] = await Promise.all([
      supabase.from('journals').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('journals').select('id', { count: 'exact', head: true }).eq('status', 'under_review'),
      supabase.from('journals').select('id', { count: 'exact', head: true }).in('status', ['approved', 'published']),
      supabase.from('journals')
        .select('id, title, status, profiles(name)')
        .order('created_at', { ascending: false })
        .limit(4),
      supabase.from('profiles')
        .select('id, name, email, role')
        .order('created_at', { ascending: false })
        .limit(3),
      supabase.from('paper_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
    ])

    setStats({
      total:    journalsRes.count ?? 0,
      users:    profilesRes.count ?? 0,
      pending:  pendingRes.count  ?? 0,
      approved: approvedRes.count ?? 0,
    })
    setJournals(recentJRes.data ?? [])
    setUsers(recentURes.data ?? [])
    setRequests(reqRes.data ?? [])
    setLoading(false)
  }

  }

  const statCards = [
    { label: 'Total Journals',  value: stats.total,    icon: FileText,    color: 'var(--primary)', change: 'All time' },
    { label: 'Total Users',     value: stats.users,    icon: Users,       color: '#2563eb',        change: 'Registered' },
    { label: 'Pending Reviews', value: stats.pending,  icon: Clock,       color: '#d97706',        change: 'Under review' },
    { label: 'Approved',        value: stats.approved, icon: CheckCircle, color: '#059669',        change: 'Published' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Overview of the journal submission system</p>
      </div>

      <div className="stats-grid">
        {statCards.map(({ label, value, icon: Icon, color, change }) => (
          <div key={label} className="card">
            <div className="card-content">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="stat-icon" style={{ color }}><Icon size={20} /></div>
                <span className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <TrendingUp size={12} /> {change}
                </span>
              </div>
              <div className="mt-4">
                <p className="stat-val">{loading ? '—' : value}</p>
                <p className="stat-label">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="two-col-grid">
        <div className="card">
          <div className="card-header">
            <div className="section-card-header">
              <div>
                <div className="card-title">Recent Submissions</div>
                <div className="card-description">Latest journal submissions</div>
              </div>
              <Link to="/admin/journals" className="btn btn-outline btn-sm">View All</Link>
            </div>
          </div>
          <div className="card-content space-y-4">
            {loading ? <p className="text-sm text-muted">Loading…</p> : recentJournals.map(j => (
              <div key={j.id} className="mobile-card-item">
                <div>
                  <p className="text-sm font-medium">{j.title}</p>
                  <p className="text-xs text-muted">by {j.profiles?.name ?? 'Unknown'}</p>
                </div>
                <span className={`status-${j.status}`}>{statusLabels[j.status] ?? j.status}</span>
              </div>
            ))}
            {!loading && recentJournals.length === 0 && <p className="text-sm text-muted">No submissions yet.</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="section-card-header">
              <div>
                <div className="card-title">Recent Users</div>
                <div className="card-description">Newly registered users</div>
              </div>
              <Link to="/admin/users" className="btn btn-outline btn-sm">View All</Link>
            </div>
          </div>
          <div className="card-content space-y-4">
            {loading ? <p className="text-sm text-muted">Loading…</p> : recentUsers.map(u => (
              <div key={u.id} className="mobile-card-item">
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                </div>
                <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>{u.role}</span>
              </div>
            ))}
            {!loading && recentUsers.length === 0 && <p className="text-sm text-muted">No users yet.</p>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Paper Access Requests
          </div>
          <div className="card-description">Pending requests from the public to read full journals. Provide them access manually via email.</div>
        </div>
        <div className="card-content space-y-4">
          {loading ? <p className="text-sm text-muted">Loading…</p> : requests.map(req => (
            <div key={req.id} className="mobile-card-item" style={{ background: 'var(--muted)' }}>
              <div>
                <p className="text-sm font-semibold" style={{ marginBottom: '0.25rem' }}>{req.journal_title}</p>
                <p className="text-sm">Requested by: <span className="font-medium">{req.requester_name}</span></p>
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <a href={`mailto:${req.requester_email}?subject=Paper Access: ${encodeURIComponent(req.journal_title)}`} className="btn btn-outline btn-sm">
                    Email PDF to {req.requester_email}
                  </a>
                </div>
              </div>
              <Link to="/admin/paper-requests" className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
                Review Request
              </Link>
            </div>
          ))}
          {!loading && requests.length === 0 && <p className="text-sm text-muted">No pending paper requests.</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title text-sm" style={{ fontSize: '0.875rem' }}>Quick Actions</div></div>
        <div className="card-content actions-list">
          <Link to="/admin/journals"      className="btn btn-outline" style={{ justifyContent: 'center' }}>Manage Journals</Link>
          <Link to="/admin/users"         className="btn btn-outline" style={{ justifyContent: 'center' }}>Manage Users</Link>
          <Link to="/admin/reviewers"     className="btn btn-outline" style={{ justifyContent: 'center' }}>Assign Reviewers</Link>
          <Link to="/admin/compile-issue" className="btn btn-outline" style={{ justifyContent: 'center' }}>Current Issue Settings</Link>
        </div>
      </div>
    </div>
  )
}
