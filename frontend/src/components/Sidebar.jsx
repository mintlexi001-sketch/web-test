import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen, LayoutDashboard, Upload, FileText, Users,
  Settings, LogOut, Menu, X, ClipboardList, UserCog, Home, BookCheck, Inbox, Layers, UserCheck
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const studentLinks = [
  { to: '/', label: 'Home Page', icon: Home },
  { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/student/upload', label: 'Upload Manuscript', icon: Upload },
  { to: '/student/journals', label: 'My Submissions', icon: FileText },
  { to: '/student/guidelines', label: 'Guidelines', icon: BookOpen },
]
const reviewerLinks = [
  { to: '/', label: 'Home Page', icon: Home },
  { to: '/reviewer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/reviewer/assigned', label: 'Assigned Journals', icon: ClipboardList },
]
const adminLinks = [
  { to: '/', label: 'Home Page', icon: Home },
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/journals', label: 'All Journals', icon: FileText },
  { to: '/admin/reports', label: 'Review Reports', icon: ClipboardList },
  { to: '/admin/accepted-papers', label: 'Accepted Papers', icon: BookCheck },
  { to: '/admin/compile-issue', label: 'Create Issue', icon: Layers },
  { to: '/admin/publish-legacy', label: 'Publish Paper', icon: Upload },
  { to: '/admin/paper-requests', label: 'Paper Requests', icon: Inbox },
  { to: '/admin/users', label: 'Manage Users', icon: Users },
  { to: '/admin/reviewers', label: 'Assign Reviewers', icon: UserCog },
  { to: '/admin/assigned-papers', label: 'Assigned Papers', icon: UserCheck },
]

const roleLabels = { student: 'Author', reviewer: 'Reviewer', admin: 'Admin' }

function SidebarContent({ role, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const links = role === 'student' ? studentLinks : role === 'reviewer' ? reviewerLinks : adminLinks
  const { signOut } = useAuth()
  const [forReviewCount, setForReviewCount] = useState(0)
  const [forAssignCount, setForAssignCount] = useState(0)
  const [pendingUsersCount, setPendingUsersCount] = useState(0)
  const [acceptedCount, setAcceptedCount] = useState(0)
  const [paperRequestCount, setPaperRequestCount] = useState(0)
  const [assignedCount, setAssignedCount] = useState(0)

  useEffect(() => {
    if (role === 'admin') {
      let isMounted = true;
      const fetchAllCounts = async () => {
        try {
          const [journalsRes, profilesRes, requestsRes] = await Promise.all([
            supabase.from('journals').select('id, status, reviews(id)'),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('paper_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
          ]);

          if (!isMounted) return;

          if (journalsRes.data) {
            const data = journalsRes.data;
            setForReviewCount(data.filter(j => j.reviews && j.reviews.length > 0 && j.status === 'under_review').length);
            setForAssignCount(data.filter(j => j.status === 'pending' || j.status === 'submitted').length);
            setAcceptedCount(data.filter(j => j.status === 'accepted').length);
            setAssignedCount(data.filter(j => j.status === 'under_review').length);
          }

          if (profilesRes.count !== null) setPendingUsersCount(profilesRes.count);
          if (requestsRes.count !== null) setPaperRequestCount(requestsRes.count);
        } catch (err) {
          console.error('Failed to load sidebar badge counts:', err);
        }
      };

      fetchAllCounts();
      return () => { isMounted = false; };
    }
  }, [role]);

  const handleLogout = async () => {
    try {
      if (onClose) onClose()
      await signOut()
      navigate('/', { replace: true })
    } catch (err) {
      console.error('Logout failed', err)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--sidebar-bg)', color: 'var(--sidebar-fg)' }}>
      <div className="sidebar-header">
        <BookOpen size={32} />
        <div className="sidebar-brand">
          <span className="sidebar-brand-title">Science and Society</span>
          <span className="sidebar-brand-sub">{roleLabels[role]} Portal</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {(() => {
          const badgeStyle = {
            background: 'var(--sidebar-fg)',
            color: 'var(--sidebar-bg)',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            minWidth: '20px',
            height: '20px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
          }
          return links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`${location.pathname === to ? 'active' : ''}`}
              onClick={onClose}
            >
              <Icon size={20} />
              <span style={{ flex: 1 }}>{label}</span>
              {to === '/admin/reports' && forReviewCount > 0 && (
                <span style={badgeStyle}>{forReviewCount}</span>
              )}
              {to === '/admin/reviewers' && forAssignCount > 0 && (
                <span style={badgeStyle}>{forAssignCount}</span>
              )}
              {to === '/admin/users' && pendingUsersCount > 0 && (
                <span style={{ ...badgeStyle, background: '#f59e0b', color: '#fff' }}>{pendingUsersCount}</span>
              )}
              {to === '/admin/accepted-papers' && acceptedCount > 0 && (
                <span style={{ ...badgeStyle, background: '#059669', color: '#fff' }}>{acceptedCount}</span>
              )}
              {to === '/admin/paper-requests' && paperRequestCount > 0 && (
                <span style={{ ...badgeStyle, background: '#7c3aed', color: '#fff' }}>{paperRequestCount}</span>
              )}
              {to === '/admin/assigned-papers' && assignedCount > 0 && (
                <span style={{ ...badgeStyle, background: '#c9a84c', color: '#0A192F' }}>{assignedCount}</span>
              )}
            </Link>
          ))
        })()}
      </nav>

      <div className="sidebar-footer">
        <Link to={`/${role}/settings`} onClick={onClose} className={`${location.pathname === `/${role}/settings` ? 'active' : ''}`}>
          <Settings size={20} />
          Settings
        </Link>
        <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>
          <LogOut size={20} />
          Logout
        </a>
      </div>
    </div>
  )
}

export function DashboardSidebar({ role }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop */}
      <aside className="sidebar">
        <SidebarContent role={role} />
      </aside>

      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <BookOpen size={22} />
          <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>Science and Society</span>
        </div>
        <button
          className="btn btn-outline btn-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--foreground)',
            background: 'var(--card)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius-md)'
          }}
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={16} />
          <span>Menu</span>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="sidebar-drawer-overlay" onClick={() => setMobileOpen(false)} />
          <div className="sidebar-drawer">
            <SidebarContent role={role} onClose={() => setMobileOpen(false)} />
          </div>
        </>
      )}
    </>
  )
}
