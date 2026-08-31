import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Users, ChevronRight, ChevronDown } from 'lucide-react'
import { Turnstile } from '@marsidev/react-turnstile'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { sendNotification } from '../lib/api'
import { motion } from 'framer-motion'

import { AnimatedSection, StaggerContainer, StaggerItem } from '../components/ui/AnimatedSection';
import { Card3D } from '../components/ui/Card3D';
import { GoldUnderline } from '../components/ui/GoldUnderline';
import { Scroll3DWrapper } from '../components/ui/Scroll3DWrapper';
import { ScrollJourney } from '../components/ui/ScrollJourney';
import { SpiralScrollPath } from '../components/ui/SpiralScrollPath';
import { ElegantGridBackground } from '../components/ui/ElegantGridBackground';
import { BackgroundElements } from '../components/ui/BackgroundElements';
import { ParallaxFloatingElements } from '../components/ui/ParallaxFloatingElements';

/* ─────────────────────────────────────────────────────────────────────
   Helper: group papers by (volume, issue), sorted newest-first
───────────────────────────────────────────────────────────────────── */
function groupByIssue(papers) {
  const groups = {}
  papers.forEach(p => {
    const key = `${p.volume_number || 'unknown'}|||${p.issue_number || 'unknown'}`
    if (!groups[key]) groups[key] = { volume: p.volume_number, issue: p.issue_number, papers: [], latestDate: null }
    groups[key].papers.push(p)
    const date = new Date(p.published_at || p.created_at)
    if (!groups[key].latestDate || date > groups[key].latestDate) groups[key].latestDate = date
  })
  return Object.values(groups).sort((a, b) => b.latestDate - a.latestDate)
}

function getCorrespondingAuthorName(p) {
  if (Array.isArray(p.authors) && p.authors.length > 0) {
    const corr = p.authors.find(a => a.is_corresponding || a.role === 'corresponding')
    if (corr) return corr.name || corr
    return p.authors[0].name || p.authors[0]
  }
  return p.author_name || 'Unknown Author'
}



/* ─────────────────────────────────────────────────────────────────────
   CURRENT ISSUE BOX — compact, 1 paper at a time, blue palette
───────────────────────────────────────────────────────────────────── */
function CurrentIssueBox({ papers, viewAllLink }) {
  const [idx, setIdx] = useState(0)
  const [fade, setFade] = useState(true)

  const headerVol = papers[0]?.volume_number
  const headerIss = papers[0]?.issue_number

  useEffect(() => {
    if (papers.length <= 1) return
    let timeoutId;
    const timer = setInterval(() => {
      setFade(false)
      timeoutId = setTimeout(() => { setIdx(prev => (prev + 1) % papers.length); setFade(true) }, 320)
    }, 5000)
    return () => { clearInterval(timer); clearTimeout(timeoutId); }
  }, [papers.length])

  if (papers.length === 0) return null
  const safeIdx = idx % papers.length || 0
  const paper = papers[safeIdx]

  return (
    <div style={{
      background: 'var(--card)',
      border: '1.5px solid rgba(29,78,216,0.2)',
      borderRadius: '1.35rem',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 8px 40px rgba(29,78,216,0.12)',
    }}>
      {/* Header — bright blue */}
      <div style={{
        background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        flexWrap: 'wrap',
      }}>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '0.35rem' }}>Current Issue</h3>
        {headerVol && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.12rem 0.48rem', borderRadius: '999px', background: 'rgba(255,255,255,0.22)', color: '#fff', letterSpacing: '0.04em' }}>Vol. {headerVol}</span>}
        {headerIss && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.12rem 0.48rem', borderRadius: '999px', background: 'rgba(255,255,255,0.13)', color: '#dbeafe', letterSpacing: '0.04em' }}>Iss. {headerIss}</span>}
      </div>

      {/* Single paper — fades in/out */}
      <div style={{ padding: '1.1rem 1.25rem', flex: 1, opacity: fade ? 1 : 0, transition: 'opacity 0.32s ease', height: '11rem', overflow: 'hidden' }}>
        <Link to={`/paper/${paper?.id}`} style={{ textDecoration: 'none' }}>
          <h4 style={{ fontSize: '0.93rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '0 0 0.45rem', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--foreground)'}
          >{paper?.title}</h4>
        </Link>
        <p style={{ fontSize: '0.77rem', color: 'var(--muted-foreground)', margin: '0 0 0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Users size={10} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCorrespondingAuthorName(paper)}</span>
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{paper?.abstract}</p>
      </div>

      {/* Footer */}
      <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', background: 'rgba(29,78,216,0.04)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Link to={viewAllLink} style={{ fontSize: '0.79rem', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
          Browse <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   PREVIOUS ISSUE BOX — compact sidebar, 1 paper at a time, dark navy
───────────────────────────────────────────────────────────────────── */
function PreviousIssueBox({ papers, viewAllLink }) {
  const [idx, setIdx] = useState(0)
  const [fade, setFade] = useState(true)

  const headerVol = papers[0]?.volume_number
  const headerIss = papers[0]?.issue_number

  useEffect(() => {
    if (papers.length <= 1) return
    let timeoutId;
    const timer = setInterval(() => {
      setFade(false)
      timeoutId = setTimeout(() => { setIdx(prev => (prev + 1) % papers.length); setFade(true) }, 320)
    }, 4500)
    return () => { clearInterval(timer); clearTimeout(timeoutId); }
  }, [papers.length])

  if (papers.length === 0) return null
  const safeIdx = idx % papers.length || 0
  const paper = papers[safeIdx]

  return (
    <div style={{
      background: 'var(--card)',
      border: '1.5px solid rgba(29,78,216,0.16)',
      borderRadius: '1.35rem',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 6px 28px rgba(29,78,216,0.09)',
    }}>
      {/* Header — dark navy */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        flexWrap: 'wrap',
      }}>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e0f2fe', margin: 0, lineHeight: 1.2, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '0.35rem' }}>Previous Issue</h3>
        {headerVol && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.12rem 0.48rem', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', color: '#e0f2fe', letterSpacing: '0.04em' }}>Vol. {headerVol}</span>}
        {headerIss && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.12rem 0.48rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#93c5fd', letterSpacing: '0.04em' }}>Iss. {headerIss}</span>}
      </div>

      {/* Single paper — fades in/out */}
      <div style={{ padding: '1.1rem 1.25rem', flex: 1, opacity: fade ? 1 : 0, transition: 'opacity 0.32s ease', height: '11rem', overflow: 'hidden' }}>
        <Link to={`/paper/${paper?.id}`} style={{ textDecoration: 'none' }}>
          <h4 style={{ fontSize: '0.93rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '0 0 0.45rem', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--foreground)'}
          >{paper?.title}</h4>
        </Link>
        <p style={{ fontSize: '0.77rem', color: 'var(--muted-foreground)', margin: '0 0 0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Users size={10} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCorrespondingAuthorName(paper)}</span>
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{paper?.abstract}</p>
      </div>

      {/* Footer */}
      <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', background: 'rgba(29,78,216,0.04)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Link to={viewAllLink} style={{ fontSize: '0.79rem', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
          Browse <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   FUTURE ISSUE BOX — compact, 1 paper at a time, violet palette
───────────────────────────────────────────────────────────────────── */
function FutureIssueBox({ papers, viewAllLink }) {
  const [idx, setIdx] = useState(0)
  const [fade, setFade] = useState(true)

  const headerVol = papers[0]?.volume_number
  const headerIss = papers[0]?.issue_number

  useEffect(() => {
    if (papers.length <= 1) return
    let timeoutId;
    const timer = setInterval(() => {
      setFade(false)
      timeoutId = setTimeout(() => { setIdx(prev => (prev + 1) % papers.length); setFade(true) }, 320)
    }, 4500)
    return () => { clearInterval(timer); clearTimeout(timeoutId); }
  }, [papers.length])

  if (papers.length === 0) return null
  const safeIdx = idx % papers.length || 0
  const paper = papers[safeIdx]

  return (
    <div style={{
      background: 'var(--card)',
      border: '1.5px solid rgba(124,58,237,0.22)',
      borderRadius: '1.35rem',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 6px 28px rgba(124,58,237,0.12)',
    }}>
      {/* Header — violet/purple palette */}
      <div style={{
        background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        flexWrap: 'wrap',
      }}>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ede9fe', margin: 0, lineHeight: 1.2, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '0.35rem' }}>Articles in Press</h3>
        {headerVol && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.12rem 0.48rem', borderRadius: '999px', background: 'rgba(255,255,255,0.2)', color: '#fff', letterSpacing: '0.04em' }}>Vol. {headerVol}</span>}
        {headerIss && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.12rem 0.48rem', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', color: '#ddd6fe', letterSpacing: '0.04em' }}>Iss. {headerIss}</span>}
      </div>

      {/* Single paper — fades in/out */}
      <div style={{ padding: '1.1rem 1.25rem', flex: 1, opacity: fade ? 1 : 0, transition: 'opacity 0.32s ease', height: '11rem', overflow: 'hidden' }}>
        <Link to={`/paper/${paper?.id}`} style={{ textDecoration: 'none' }}>
          <h4 style={{ fontSize: '0.93rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '0 0 0.45rem', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#7c3aed'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--foreground)'}
          >{paper?.title}</h4>
        </Link>
        <p style={{ fontSize: '0.77rem', color: 'var(--muted-foreground)', margin: '0 0 0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Users size={10} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getCorrespondingAuthorName(paper)}</span>
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{paper?.abstract}</p>
      </div>

      {/* Footer */}
      <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', background: 'rgba(124,58,237,0.04)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Link to={viewAllLink} style={{ fontSize: '0.79rem', fontWeight: 600, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
          Browse <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   Data fetcher for current and future issue boxes
───────────────────────────────────────────────────────────────────── */
function useIssueData() {
  const [currentPapersAll, setCurrentPapersAll] = useState([])
  const [futurePapers, setFuturePapers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      // Try fetching current issue papers (is_future_issue = false or null)
      let { data: currentData, error: currentError } = await supabase
        .from('published_issues')
        .select('id, title, abstract, published_at, created_at, author_name, authors, volume_number, issue_number')
        .not('volume_number', 'is', null)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(20)

      // Fetch future issue papers (volume_number = null)
      let futureData = []
      if (!currentError) {
        const { data: fd } = await supabase
          .from('published_issues')
          .select('id, title, abstract, published_at, created_at, author_name, authors, volume_number, issue_number')
          .is('volume_number', null)
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(40)
        futureData = fd || []
      }

      if (currentData) setCurrentPapersAll(currentData)
      setFuturePapers(futureData)
      setLoading(false)
    }
    fetchAll()
  }, [])

  const groups = groupByIssue(currentPapersAll)
  const currentGroup = groups[0] || null
  const previousGroup = groups[1] || null

  return { loading, currentGroup, previousGroup, futurePapers }
}


/* ─────────────────────────────────────────────────────────────────────
   About Features
───────────────────────────────────────────────────────────────────── */
const features = [
  { title: 'Secure Submission', description: 'Secure submissions ensuring your research remains confidential throughout the review process.' },
  { title: 'Expert Reviewers', description: 'Multi-level review by domain experts ensuring thorough evaluation and constructive feedback.' },
  { title: 'Fast Turnaround', description: 'Streamlined workflow with real-time status tracking for quick and transparent review cycles.' },
  { title: 'Quality Standards', description: 'Rigorous academic standards maintained through our comprehensive peer review process.' },
]

/* ─────────────────────────────────────────────────────────────────────
   HERO SECTION
   Layout: [Left: Journal text + CTA] [Right: Previous Issue sidebar]
   Below: [Full-width Current Issue box]
───────────────────────────────────────────────────────────────────── */
function HeroSection() {
  const [showScroll, setShowScroll] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setShowScroll(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  const { user, profile } = useAuth()
  const dashboardPath = profile?.role === 'admin'
    ? '/admin/dashboard'
    : profile?.role === 'reviewer'
      ? '/reviewer/dashboard'
      : '/student/dashboard'

  const { loading, currentGroup, previousGroup, futurePapers } = useIssueData()

  const currentPapers = currentGroup?.papers || []
  const previousPapers = previousGroup?.papers || []

  const currentVol = currentGroup?.volume ? encodeURIComponent(currentGroup.volume) : ''
  const currentIss = currentGroup?.issue ? encodeURIComponent(currentGroup.issue) : ''
  const prevVol = previousGroup?.volume ? encodeURIComponent(previousGroup.volume) : ''
  const prevIss = previousGroup?.issue ? encodeURIComponent(previousGroup.issue) : ''

  const currentLink = currentVol && currentIss ? `/published-papers?vol=${currentVol}&iss=${currentIss}` : '/published-papers'
  const prevLink = prevVol && prevIss ? `/published-papers?vol=${prevVol}&iss=${prevIss}` : '/published-papers'
  const futureLink = '/future-issues'

  return (
    <section id="hero" className="hero" style={{
      position: 'relative',
      overflow: 'hidden',
      paddingTop: '3.5rem',
      paddingBottom: '4rem',
    }}>
      <div className="container" style={{ position: 'relative', zIndex: 10 }}>

        {/* ── Top Row: Left (journal text) + Right (previous issue) ── */}
        <div className="hero-top-grid">
          <AnimatedSection direction="up" delay={0.05}>
            <div className="hero-text-card" style={{
              background: 'rgba(255,255,255,0.02)',
              padding: '2.75rem 3rem 2.5rem',
              borderRadius: '1.5rem',
              border: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}>

              {/* Decorative top accent */}
              <div style={{
                position: 'absolute', top: 0, left: '3rem', right: '3rem', height: '2px',
                background: 'linear-gradient(90deg, transparent, var(--gold), transparent)',
                opacity: 0.5,
              }} />



              <h1 className="hero-journal-title" style={{ textAlign: 'left', marginBottom: '0.6rem' }}>
                <span className="desktop-title">Science and Society</span>
                <span className="mobile-title">Science and Society</span>
              </h1>
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.75rem' }}>
                <GoldUnderline width={260} />
              </div>

              {/* Elegant serif description */}
              <blockquote style={{
                margin: '0 0 1.75rem',
                padding: '0 0 0 1.25rem',
                borderLeft: '2px solid rgba(201,168,76,0.45)',
                fontFamily: 'var(--font-serif)',
                fontSize: '1.05rem',
                lineHeight: 1.8,
                color: 'var(--foreground)',
                opacity: 0.87,
                letterSpacing: '0.005em',
              }}>
                A multidisciplinary, peer-reviewed journal published by{' '}
                <strong>Nirmala Academic and Research Publications (NARP)</strong> since 2003 —
                fostering interdisciplinary research and scholarly dialogue across science, technology,
                humanities, literature, commerce, and allied disciplines.
              </blockquote>



              <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                {user ? (
                  profile?.role === 'student' ? (
                    <>
                      <Link to="/student/upload" className="btn btn-primary" style={{ letterSpacing: '0.01em' }}>
                        Submit Your Manuscript
                      </Link>
                      <Link to={dashboardPath} className="btn btn-primary">
                        Go to Dashboard
                      </Link>
                    </>
                  ) : (
                    <Link to={dashboardPath} className="btn btn-primary">
                      Go to Dashboard
                    </Link>
                  )
                ) : (
                  <>
                    <Link to="/register" className="btn btn-primary" style={{ letterSpacing: '0.01em' }}>
                      Submit Your Manuscript
                    </Link>
                    <Link to="/login" className="btn btn-primary">
                      Sign In
                    </Link>
                  </>
                )}
              </div>
            </div>
          </AnimatedSection>

          {/* RIGHT: Previous Issue sidebar */}
          <AnimatedSection direction="left" delay={0.2}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px' }}>
                <div className="spinner" />
              </div>
            ) : previousPapers.length === 0 ? (
              <div style={{
                background: 'var(--card)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '1.25rem',
                height: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2.5rem',
                flexDirection: 'column', gap: '0.75rem', minHeight: '300px'
              }}>
                <p style={{ color: 'var(--foreground)', fontSize: '0.9rem', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Previous Issue</p>
                <GoldUnderline width={40} />
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
                  Archived issues will appear here. Browse our publication archive to view past volumes and issues.
                </p>
              </div>
            ) : (
              <PreviousIssueBox
                papers={previousPapers}
                viewAllLink={prevLink}
              />
            )}
          </AnimatedSection>
        </div>

        {/* ── Bottom: Current Issue + Future Issue side by side ── */}
        <AnimatedSection direction="up" delay={0.35}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2.5rem' }}>
              <div className="spinner" />
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.5rem',
              alignItems: 'stretch',
            }}>
              {/* Left: Current Issue */}
              {currentPapers.length === 0 ? (
                <div style={{
                  background: 'var(--card)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '1.25rem',
                  padding: '2.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                  flexDirection: 'column', gap: '0.75rem', minHeight: '220px'
                }}>
                  <p style={{ color: 'var(--foreground)', fontSize: '0.9rem', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Issue</p>
                  <GoldUnderline width={40} />
                  <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
                    The current issue is being prepared. Recently accepted papers will be available here soon.
                  </p>
                </div>
              ) : (
                <CurrentIssueBox
                  papers={currentPapers}
                  viewAllLink={currentLink}
                />
              )}

              {/* Right: Future Issue */}
              {futurePapers.length === 0 ? (
                <div style={{
                  background: 'var(--card)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '1.25rem',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2.5rem',
                  flexDirection: 'column', gap: '0.75rem', minHeight: '220px',
                }}>
                  <p style={{ color: 'var(--foreground)', fontSize: '0.9rem', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Articles in Press</p>
                  <GoldUnderline width={40} />
                  <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
                    Currently, there are no upcoming papers scheduled for early access publication. Check back later for the latest pre-issue releases.
                  </p>
                </div>
              ) : (
                <FutureIssueBox
                  papers={futurePapers}
                  viewAllLink={futureLink}
                />
              )}
            </div>
          )}
        </AnimatedSection>

        {/* ── View All CTA ── */}
        <div style={{ textAlign: 'center', marginTop: '2.5rem', marginBottom: '1.5rem' }}>
          <Link to="/published-papers" className="btn btn-primary" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.15rem',
            padding: '1.1rem 2.5rem', borderRadius: '999px',
            background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)',
            color: '#fff', fontWeight: 700,
            boxShadow: '0 8px 30px rgba(29,78,216,0.35)',
            border: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            View Publication Archive
          </Link>
        </div>
      </div>

      {/* ── Scroll Down Indicator ── */}
      <div style={{
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: showScroll ? 0.7 : 0,
        pointerEvents: 'none',
        transition: 'opacity 1s ease-in-out',
        zIndex: 50
      }}>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--foreground)'
          }}
        >
          <span style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>Scroll</span>
          <ChevronDown size={22} />
        </motion.div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   About Section
───────────────────────────────────────────────────────────────────── */
function AboutSection() {
  return (
    <section id="about" className="about-section">
      <Scroll3DWrapper direction="left">
        <div className="container">
          <AnimatedSection direction="up">
            <div className="section-header">
              <span className="section-label">About</span>
              <h2 className="section-title">About Science and Society</h2>
              <GoldUnderline width={150} />
              <p className="section-desc">
                Science and Society is an academic initiative by Nirmala College, providing a robust platform
                for scholarly journal submissions and multi-level peer reviews.
              </p>
            </div>
          </AnimatedSection>
          <StaggerContainer className="features-grid">
            {features.map((f, i) => (
              <StaggerItem key={f.title} className="feature-wrapper">
                <Card3D intensity={5}>
                  <div className="feature-card card" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', padding: '2rem' }}>
                    <div style={{ position: 'absolute', top: '1.2rem', right: '1.5rem', fontSize: '3.5rem', fontWeight: 800, color: 'rgba(197,160,89,0.1)', lineHeight: 1 }}>
                      0{i + 1}
                    </div>
                    <h3 style={{ marginTop: '0.5rem', marginBottom: '1rem', position: 'relative', zIndex: 1 }}>{f.title}</h3>
                    <p style={{ flex: 1, position: 'relative', zIndex: 1 }}>{f.description}</p>
                  </div>
                </Card3D>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </Scroll3DWrapper>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   Workflow Section
───────────────────────────────────────────────────────────────────── */
const steps = [
  { step: '01', title: 'Submit your Manuscript', description: 'Upload your research paper with all required details and supporting documents.' },
  { step: '02', title: 'Initial Review', description: 'Your submission undergoes initial screening for format compliance and relevance.' },
  { step: '03', title: 'Peer Review', description: 'Expert reviewers evaluate your work through multiple levels of assessment.' },
  { step: '04', title: 'Publication', description: 'Approved journals are published and indexed in our academic repository.' },
]

function WorkflowSection() {
  const { user, profile } = useAuth()
  const canSubmit = !user || profile?.role === 'student'

  return (
    <section id="workflow" className="workflow-section">
      <Scroll3DWrapper direction="right">
        <div className="container">
          <AnimatedSection direction="up">
            <div className="section-header">
              <span className="section-label">Process</span>
              <h2 className="section-title">Submission Procedure</h2>
              <GoldUnderline width={200} />
              <p className="section-desc">Our streamlined process ensures efficient handling of your research from submission to publication.</p>
            </div>
          </AnimatedSection>
          <div className="workflow-steps">
            <div className="workflow-line" />
            {steps.map((step, i) => (
              <div key={step.title} className="workflow-step">
                <div className="workflow-step-grid">
                  {i % 2 !== 0 && <div className="desktop-spacer" />}
                  <AnimatedSection delay={i * 0.15} direction={i % 2 === 0 ? 'right' : 'left'}>
                    <Card3D>
                      <div className="workflow-card card">
                        <div className="workflow-step-header" style={{ marginBottom: '1.25rem' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Step {step.step}</span>
                        </div>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>{step.title}</h3>
                        <p style={{ color: 'var(--muted-foreground)', lineHeight: 1.6 }}>{step.description}</p>
                      </div>
                    </Card3D>
                  </AnimatedSection>
                  {i % 2 === 0 && <div className="desktop-spacer" />}
                </div>
                <div className="workflow-dot" style={{ borderColor: 'var(--gold)' }}>
                  <div className="workflow-dot-inner" style={{ background: 'var(--gold)' }}>
                    <div className="workflow-dot-ping" style={{ background: 'var(--gold)' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {canSubmit && (
            <AnimatedSection direction="up" delay={0.4}>
              <div style={{ textAlign: 'center', marginTop: '3.5rem' }}>
                <Link to={user ? "/student/upload" : "/login"} className="btn btn-primary" style={{ padding: '0.9rem 2.5rem', fontSize: '1.1rem', boxShadow: '0 8px 30px rgba(37,99,235,0.25)' }}>
                  Submit your Manuscript
                </Link>
              </div>
            </AnimatedSection>
          )}
        </div>
      </Scroll3DWrapper>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   Contact Section
───────────────────────────────────────────────────────────────────── */
function ContactSection() {
  const toast = useToast()
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    
    const form = e.target;
    const name = form['c-name'].value;
    const email = form['c-email'].value;
    const subject = form['c-subject'].value;
    const message = form['c-message'].value;

    if (!turnstileToken) {
      toast.error('Please complete the CAPTCHA verification');
      setSubmitting(false);
      return;
    }

    try {
      const res = await sendNotification('/api/notify/contact', {
        name, email, subject, message, turnstileToken
      });
      
      if (!res || !res.ok) throw new Error('Failed to send message');
      
      toast.success("Message sent! We'll get back to you soon.")
      form.reset()
    } catch (error) {
      toast.error(error.message || 'Error sending message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="contact" className="contact-section">
      <Scroll3DWrapper direction="left">
        <div className="container">
          <AnimatedSection direction="up">
            <div className="section-header">
              <span className="section-label">Support</span>
              <h2 className="section-title">Contact Us</h2>
              <GoldUnderline width={100} />
              <p className="section-desc">Have questions about the submission process? Get in touch with our team.</p>
            </div>
          </AnimatedSection>
          <div className="contact-grid">
            <AnimatedSection delay={0.1} direction="left">
              <Card3D intensity={2}>
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Send us a message</div>
                    <div className="card-description">Fill out the form and we will respond within 24–48 hours.</div>
                  </div>
                  <div className="card-content">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid-2">
                        <div className="form-group">
                          <label htmlFor="c-name">Name</label>
                          <input id="c-name" className="input" placeholder="Your name" required />
                        </div>
                        <div className="form-group">
                          <label htmlFor="c-email">Email</label>
                          <input id="c-email" type="email" className="input" placeholder="your@email.com" defaultValue={user?.email || ''} disabled={!!user} required />
                        </div>
                      </div>
                      <div className="form-group">
                        <label htmlFor="c-subject">Subject</label>
                        <input id="c-subject" className="input" placeholder="How can we help?" required />
                      </div>
                      <div className="form-group">
                        <label htmlFor="c-message">Message</label>
                        <textarea id="c-message" className="textarea" placeholder="Your message..." rows={4} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                        <Turnstile siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} onSuccess={(token) => setTurnstileToken(token)} />
                      </div>
                      <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
                        {submitting ? 'Sending…' : 'Send Message'}
                      </button>
                    </form>
                  </div>
                </div>
              </Card3D>
            </AnimatedSection>
            <AnimatedSection delay={0.2} direction="right">
              <StaggerContainer className="contact-info-cards">
                {[
                  { title: 'Email', lines: ['editorscisoc@nirmalacollege.ac.in'] },
                  { title: 'Phone', lines: ['+91 4852832361 ', 'Mon–Fri, 9:00 AM – 5:00 PM IST'] },
                  { title: 'Address', lines: ['Nirmala College', 'Muvattupuzha(Autonomous), Kerala, India'] },
                ].map(({ title, lines }) => (
                  <StaggerItem key={title} className="contact-info-card card" style={{ padding: '2rem' }}>
                    <div>
                      <h3 style={{ color: 'var(--gold)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '1rem', fontWeight: 700 }}>{title}</h3>
                      {lines.map(l => <p key={l} style={{ margin: '0.35rem 0', color: 'var(--foreground)', fontSize: '0.95rem' }}>{l}</p>)}
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </AnimatedSection>
          </div>
        </div>
      </Scroll3DWrapper>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   Guidelines Section
───────────────────────────────────────────────────────────────────── */
const guidelineCards = [
  { title: '1. PUBLICATION SCHEME', content: <p className="text-muted text-sm" style={{ lineHeight: '1.6' }}>The journal is published as a biannual publication in January–June and July–December issues. The Editor reserves the right to accept/reject manuscripts and to edit articles wherever considered necessary. Manuscripts become the property of the publisher.</p> },
  { title: '2. LANGUAGE', content: <p className="text-muted text-sm" style={{ lineHeight: '1.6' }}>English</p> },
  { title: '3. SUBJECTS COVERED', content: <p className="text-muted text-sm" style={{ lineHeight: '1.6' }}>Science, Humanities, Commerce, Management, Literature, Education, Engineering and Ethics.</p> },
  {
    title: '4. SUBMISSION GUIDELINES', content: (
      <ul className="text-muted text-sm" style={{ listStyleType: 'none', paddingLeft: '0', display: 'flex', flexDirection: 'column', gap: '0.5rem', lineHeight: '1.6' }}>
        <li><strong>General Articles:</strong> Articles should not exceed 5000 words.</li>
        <li><strong>Review Articles:</strong> Word limit: 4000–5000 words. Limit of cited references: up to 50.</li>
        <li><strong>Research Articles:</strong> Should present results of original research. Size: 2500–3500 words.</li>
        <li><strong>Reports:</strong> Factual reports on conferences, seminars, etc. (less than 2000 words).</li>
        <li><strong>News and Views:</strong> Less than 750 words, max 2 display items.</li>
        <li><strong>Resource Reviews:</strong> New books, websites, CDs, etc.</li>
        <li><strong>Letters to the Editor:</strong> May be limited to less than 500 words.</li>
      </ul>
    )
  },
  {
    title: '5. INSTRUCTIONS TO AUTHORS', content: (
      <div className="text-muted text-sm space-y-2" style={{ lineHeight: '1.6' }}>
        <p>Articles will be peer-reviewed. The title page should include: Title, Author name, designation, postal address with PIN code, Email, Abstract (≤250 words), Keywords (3–5 words). Manuscripts should follow proper structure. Pages should be serially numbered.</p>
      </div>
    )
  },
  { title: '6. FORMATTING INSTRUCTIONS', content: <div className="text-muted text-sm" style={{ lineHeight: '1.6' }}><p>Submit manuscripts with a soft copy. Use normal plain font (e.g., Times New Roman, 12 pt). Divide your article into clearly defined sections and subsections.</p></div> },
  { title: '7. REFERENCES', content: <div className="text-muted text-sm" style={{ lineHeight: '1.6' }}><p>All references cited in text using numbers in square brackets, listed consecutively. <strong>Journal:</strong> Author, Journal name, Volume, Page, Year. <strong>Book:</strong> Author, Book name, Publisher, Place, Year, Pages.</p></div> },
  { title: '8. ACKNOWLEDGEMENT', content: <p className="text-muted text-sm" style={{ lineHeight: '1.6' }}>Should be placed at the end of the paper before references.</p> },
  { title: '9. TABLES AND FIGURES', content: <ul className="text-muted text-sm" style={{ listStyleType: 'disc', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', lineHeight: '1.6' }}><li>Should be embedded in the text.</li><li>Must have proper numbering and captions.</li><li>High-quality images (preferably 300 dpi resolution).</li><li>Grayscale mode is preferred.</li></ul> },
  { title: '10. FOOTNOTES', content: <p className="text-muted text-sm" style={{ lineHeight: '1.6' }}>Should be minimal.</p> },
  { title: '11. SUBMISSION', content: <ul className="text-muted text-sm" style={{ listStyleType: 'disc', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', lineHeight: '1.6' }}><li>Submit original manuscript in MS Word format.</li><li>Proof corrections must be returned within one week.</li></ul> },
]

function GuidelinesSection() {
  return (
    <section id="guidelines" className="about-section">
      <Scroll3DWrapper direction="right">
        <div className="container">
          <AnimatedSection direction="up">
            <div className="section-header">
              <span className="section-label">Rules</span>
              <h2 className="section-title">Guidelines for Authors</h2>
              <GoldUnderline width={220} />
              <p className="section-desc">Please review these essential guidelines to ensure a smooth submission and peer-review process.</p>
            </div>
          </AnimatedSection>
          <StaggerContainer className="guidelines-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
            {guidelineCards.map(g => (
              <StaggerItem key={g.title}>
                <Card3D intensity={3}>
                  <div className="card guideline-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(180deg, var(--gold) 0%, transparent 100%)', opacity: 0.8 }} />
                    <div>
                      <h3 style={{ marginBottom: '1rem', color: 'var(--foreground)', fontSize: '1.15rem', fontWeight: '700', letterSpacing: '0.05em' }}>{g.title}</h3>
                      {g.content}
                    </div>
                  </div>
                </Card3D>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </Scroll3DWrapper>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   Home Page
───────────────────────────────────────────────────────────────────── */
export default function Home() {
  return (
    <>
      <ElegantGridBackground />
      <BackgroundElements />
      <ParallaxFloatingElements />
      <SpiralScrollPath />
      <ScrollJourney>
        <HeroSection />
        <AboutSection />
        <GuidelinesSection />
        <WorkflowSection />
        <ContactSection />
      </ScrollJourney>
    </>
  )
}
