import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Home, BookOpen, Users, LayoutList, Info, Workflow, Mail, LogIn, UserPlus, LayoutDashboard, LogOut, X, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/about', label: 'About Us', icon: Info },
  { href: '/editorial-board', label: 'Editorial Board', icon: Users },
  { href: '/published-papers', label: 'Publication Archive', icon: LayoutList },
  { href: '/#guidelines', label: 'Guidelines', icon: BookOpen },
  { href: '/#workflow', label: 'Submission Procedure', icon: Workflow },
  { href: '/#contact', label: 'Contact', icon: Mail },
];

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.78rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>
        {time.toLocaleDateString([], { month: 'short', day: 'numeric' })}
      </span>
    </div>
  );
}

const drawerVariants = {
  closed: { x: '100%', opacity: 0 },
  open: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 340, damping: 34 } },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } },
};

const itemVariants = {
  closed: { opacity: 0, x: 16 },
  open: (i) => ({ opacity: 1, x: 0, transition: { delay: 0.06 + i * 0.055, duration: 0.28, ease: 'easeOut' } }),
};

const backdropVariants = {
  closed: { opacity: 0 },
  open: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export default function SlideMenu({ isOpen, setMenuOpen, user, signOut, navigate, dashboardPath }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Soft backdrop — click to dismiss */}
          <motion.div
            key="backdrop"
            variants={backdropVariants}
            initial="closed" animate="open" exit="exit"
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9990,
              background: 'rgba(10, 14, 30, 0.45)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />

          {/* Drawer panel */}
          <motion.aside
            key="drawer"
            variants={drawerVariants}
            initial="closed" animate="open" exit="exit"
            style={{
              position: 'fixed',
              top: 0, right: 0, bottom: 0,
              width: '320px',
              zIndex: 9995,
              background: 'var(--card)',
              color: 'var(--text-primary)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Decorative top gradient bar */}
            <div style={{
              height: '3px',
              background: 'linear-gradient(90deg, var(--primary) 0%, var(--gold) 100%)',
              flexShrink: 0,
            }} />

            {/* Header row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.1rem 1.4rem 0.8rem',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <img src="/assets/images/logo.png" alt="logo" style={{ height: '28px' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Science & Society
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  onClick={toggleTheme}
                  className="theme-toggle-btn"
                  title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  aria-label="Toggle theme"
                  style={{ width: '32px', height: '32px' }}
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>
                <motion.button
                  whileTap={{ scale: 0.88 }} whileHover={{ rotate: 90 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setMenuOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', padding: '4px' }}
                  aria-label="Close menu"
                >
                  <X size={18} />
                </motion.button>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--border)', margin: '0 1.4rem', flexShrink: 0 }} />

            {/* Nav Links */}
            <nav style={{ padding: '1rem 0.8rem', flex: 1, overflowY: 'auto' }}>
              {navItems.map(({ href, label, icon: Icon }, i) => (
                <motion.div key={href} custom={i} variants={itemVariants} initial="closed" animate="open">
                  <a
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.65rem 0.8rem',
                      borderRadius: '0.6rem',
                      textDecoration: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.92rem',
                      fontWeight: 500,
                      marginBottom: '0.15rem',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    className="drawer-nav-link"
                  >
                    <Icon size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    {label}
                  </a>
                </motion.div>
              ))}

              {/* Divider */}
              <div style={{ height: '1px', background: 'var(--border)', margin: '0.75rem 0.8rem' }} />

              {/* Auth section */}
              {user ? (
                <>
                  <motion.div custom={6} variants={itemVariants} initial="closed" animate="open">
                    <Link
                      to={dashboardPath}
                      onClick={() => setMenuOpen(false)}
                      className="drawer-nav-link"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.65rem 0.8rem', borderRadius: '0.6rem',
                        textDecoration: 'none', color: 'var(--text-primary)',
                        fontSize: '0.92rem', fontWeight: 500, marginBottom: '0.15rem',
                      }}
                    >
                      <LayoutDashboard size={16} style={{ color: 'var(--text-muted)' }} />
                      Dashboard
                    </Link>
                  </motion.div>
                  <motion.div custom={7} variants={itemVariants} initial="closed" animate="open">
                    <button
                      onClick={async () => { setMenuOpen(false); await signOut(); navigate('/'); }}
                      className="drawer-nav-link"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.65rem 0.8rem', borderRadius: '0.6rem',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-primary)',
                        fontSize: '0.92rem', fontWeight: 500,
                        width: '100%', textAlign: 'left',
                      }}
                    >
                      <LogOut size={16} style={{ color: 'var(--text-muted)' }} />
                      Logout
                    </button>
                  </motion.div>
                </>
              ) : (
                <motion.div custom={6} variants={itemVariants} initial="closed" animate="open"
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0 0.8rem' }}
                >
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      padding: '0.6rem 1rem', borderRadius: '0.6rem',
                      border: '1px solid var(--border)', textDecoration: 'none',
                      color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.9rem',
                      transition: 'background 0.15s',
                    }}
                  >
                    <LogIn size={15} /> Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      padding: '0.6rem 1rem', borderRadius: '0.6rem',
                      background: 'var(--primary)', textDecoration: 'none',
                      color: '#fff', fontWeight: 600, fontSize: '0.9rem',
                    }}
                  >
                    <UserPlus size={15} /> Register
                  </Link>
                </motion.div>
              )}
            </nav>

            {/* Footer — live clock + tagline */}
            <div style={{
              padding: '1rem 1.4rem 1.2rem',
              borderTop: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <LiveClock />
              <p style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                Science and Society
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
