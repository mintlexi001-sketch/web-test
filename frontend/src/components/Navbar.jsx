import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogIn, UserPlus, LayoutDashboard, LogOut, Bell, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import ElegantMenuIcon from './ui/ElegantMenuIcon'
import SlideMenu from './ui/FullscreenMenu'
import { supabase } from '../lib/supabase'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About Us' },
  { href: '/editorial-board', label: 'Editorial Board' },
  { href: '/published-papers', label: 'Publication Archive' },
  { href: '/#guidelines', label: 'Guidelines' },
  { href: '/#workflow', label: 'Submission Procedure' },
  { href: '/#contact', label: 'Contact' },
]

export function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, profile, loading, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return;
    
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (count !== null) setUnreadCount(count);
    };

    fetchUnread();

    const channel = supabase
      .channel('navbar:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const dashboardPath = profile?.role === 'admin'
    ? '/admin/dashboard'
    : profile?.role === 'reviewer'
      ? '/reviewer/dashboard'
      : '/student/dashboard'

  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    if (location.pathname !== '/') {
      setActiveSection('');
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      let visibleSection = null;
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          visibleSection = entry.target.id;
        }
      });
      if (visibleSection) {
        setActiveSection(visibleSection);
      }
    }, {
      rootMargin: '-50% 0px -50% 0px'
    });

    const sectionIds = ['hero', 'about', 'guidelines', 'workflow', 'contact'];
    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [location.pathname]);

  // Handle hash scrolling on navigation
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const scrollToHash = () => {
        const el = document.getElementById(id);
        if (el) {
          const y = el.getBoundingClientRect().top + window.scrollY - 72; // 72px offset for sticky navbar
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      };
      
      // Try scrolling immediately, and also after a short delay in case of rendering
      scrollToHash();
      setTimeout(scrollToHash, 100);
      setTimeout(scrollToHash, 500); // Fallback for slower page loads
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname, location.hash]);

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">
            <img src="/assets/images/logo.png" alt="Science and Society Logo" style={{ height: '38px', width: 'auto', objectFit: 'contain' }} />
            <div className="navbar-brand-text">
              <span className="navbar-brand-title navbar-brand-title--elegant">Science and Society</span>
            </div>
          </Link>

          <nav className="navbar-links">
            {navLinks.map(link => {
              // Determine if this link should be active based on our observer
              let isActive = false;
              if (location.pathname === '/') {
                if (activeSection === 'hero' && link.href === '/') isActive = true;
                else if (activeSection && link.href === `/#${activeSection}`) isActive = true;
              } else {
                isActive = location.pathname === link.href;
              }

              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`navbar-link${isActive ? ' active' : ''}`}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="navbar-actions">
              {loading ? (
                <div style={{ width: '80px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spinner-sm" />
                </div>
              ) : user ? (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <Link 
                    to="/notifications" 
                    className="btn btn-sidebar btn-sm"
                    style={{ position: 'relative', padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '9999px', minWidth: '18px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link to={dashboardPath} className="btn btn-sidebar-solid btn-sm">
                    <LayoutDashboard size={16} /> Dashboard
                  </Link>
                  <button
                    onClick={async () => { await signOut(); navigate('/'); }}
                    className="btn btn-sidebar btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              ) : (
                <div className="auth-pill">
                  <Link to="/login" className="auth-pill-login">
                    <LogIn size={14} /> Login
                  </Link>
                  <Link to="/register" className="auth-pill-register">
                    <UserPlus size={14} /> Register
                  </Link>
                </div>
              )}

              {/* Theme Toggle Icon Button */}
              <button
                onClick={toggleTheme}
                className="theme-toggle-btn"
                title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            </div>

            {/* Mobile Actions Button */}
            <div className="navbar-menu-btn">
              <button
                className="btn btn-primary btn-icon"
                style={{ zIndex: 9999, position: 'relative' }}
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
              >
                <ElegantMenuIcon isOpen={menuOpen} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <SlideMenu
        isOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        user={user}
        signOut={signOut}
        navigate={navigate}
        dashboardPath={dashboardPath}
      />
    </>
  )
}
