import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Clock, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const statusLabels = { submitted: 'Submitted', under_review: 'Under Review', approved: 'Approved', rejected: 'Rejected', revision_required: 'Revision Required', rework: 'Revision Required', published: 'Published' }

export default function StudentDashboard() {
  const { user } = useAuth()
  const [journals, setJournals] = useState([])
  const [stats, setStats] = useState({ total: 0, underReview: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (user) fetchJournals()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchJournals() {
    setLoading(true)
    setFetchError(false)

    // L-2 fix: fetch accurate per-status counts separately (no limit) and 3 recent items for the activity list.
    const [
      { count: total },
      { count: underReview },
      { count: approved },
      { count: rejected },
      { data: recent, error },
    ] = await Promise.all([
      supabase.from('journals').select('id', { count: 'exact', head: true }).eq('student_id', user.id),
      supabase.from('journals').select('id', { count: 'exact', head: true }).eq('student_id', user.id).eq('status', 'under_review'),
      supabase.from('journals').select('id', { count: 'exact', head: true }).eq('student_id', user.id).eq('status', 'approved'),
      supabase.from('journals').select('id', { count: 'exact', head: true }).eq('student_id', user.id).eq('status', 'rejected'),
      supabase.from('journals').select('id, title, status, created_at').eq('student_id', user.id).order('created_at', { ascending: false }).limit(3),
    ])

    if (error) {
      console.error('StudentDashboard: failed to load journals', error.message)
      setFetchError(true)
    } else {
      setJournals(recent ?? [])
      setStats({ total: total ?? 0, underReview: underReview ?? 0, approved: approved ?? 0, rejected: rejected ?? 0 })
    }
    setLoading(false)
  }

  const statCards = [
    { label: 'Total Submissions', value: stats.total, icon: FileText, color: 'var(--primary)' },
    { label: 'Under Review', value: stats.underReview, icon: Clock, color: '#d97706' },
    { label: 'Accepted', value: stats.approved, icon: CheckCircle, color: '#059669' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, },
  ]

  const recentSubmissions = journals

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back! Here is an overview of your submissions.</p>
        </div>
        <Link to="/student/upload" className="btn btn-primary">
          Upload Manuscript
        </Link>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <div className="card-content stat-card">
              <div className="stat-icon" style={{ color }}><Icon size={24} /></div>
              <div>
                <p className="stat-val">{loading ? '—' : value}</p>
                <p className="stat-label">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Submissions */}
      <div className="card">
        <div className="card-header">
          <div className="section-card-header">
            <div>
              <div className="card-title">Recent Submissions</div>
              <div className="card-description">Your latest article submissions</div>
            </div>
            <Link to="/student/journals" className="btn btn-outline btn-sm">
              View All
            </Link>
          </div>
        </div>
        <div className="card-content">
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : fetchError ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--destructive)' }}>
              <p className="text-sm">Failed to load submissions. Please check your connection and try again.</p>
              <button className="btn btn-outline btn-sm" style={{ marginTop: '0.75rem' }} onClick={fetchJournals}>Retry</button>
            </div>
          ) : recentSubmissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--muted-foreground)' }}>
              <FileText size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <p className="text-sm">No submissions yet. <Link to="/student/upload" className="auth-link">Submit your first manuscript</Link></p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentSubmissions.map(s => (
                <div key={s.id} className="submission-item">
                  <div>
                    <Link to={`/student/journals/${s.id}`} className="submission-link">{s.title}</Link>
                    <p className="submission-date">
                      Submitted on {new Date(s.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <span className={`status-${s.status}`}>{statusLabels[s.status] ?? s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions + Guidelines */}
      <div className="two-col-grid">
        <div className="card">
          <div className="card-header"><div className="card-title">Quick Actions</div></div>
          <div className="card-content actions-list">
            <Link to="/student/upload" className="btn btn-outline" style={{ justifyContent: 'center' }}>
              Submit your Manuscript
            </Link>
            <Link to="/student/journals" className="btn btn-outline" style={{ justifyContent: 'center' }}>
              View All Submissions
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Submission Guidelines</div></div>
          <div className="card-content">
            <p className="text-sm text-muted" style={{ marginBottom: '0.5rem' }}>Please ensure your submission meets the following criteria:</p>
            <ul className="list-disc text-sm text-muted">
              <li>Original research work</li>
              <li>PDF format (max 10 MB)</li>
              <li>Proper citations and references</li>
              <li>Abstract within 300 words</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
