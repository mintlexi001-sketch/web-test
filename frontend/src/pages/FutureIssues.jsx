import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AnimatedSection } from '../components/ui/AnimatedSection'
import { ElegantGridBackground } from '../components/ui/ElegantGridBackground'
import { BackgroundElements } from '../components/ui/BackgroundElements'
import { ParallaxFloatingElements } from '../components/ui/ParallaxFloatingElements'
import { GoldUnderline } from '../components/ui/GoldUnderline'

function getAuthors(paper) {
  if (Array.isArray(paper.authors) && paper.authors.length > 0) {
    return paper.authors.map(a => a.name || a).join(', ')
  }
  return paper.author_name || '—'
}

function PaperCard({ paper, index }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: '1rem',
      padding: '1.75rem',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      position: 'relative',
      overflow: 'hidden',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(29,78,216,0.1)'
        e.currentTarget.style.borderColor = 'rgba(29,78,216,0.3)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <div style={{
        position: 'absolute', top: '1.25rem', right: '1.25rem',
        fontSize: '2rem', fontWeight: 800, lineHeight: 1,
        color: 'var(--border)', userSelect: 'none',
      }}>
        {String(index + 1).padStart(2, '0')}
      </div>

      <div style={{ paddingRight: '3rem' }}>
        <Link to={`/paper/${paper.id}`} style={{ textDecoration: 'none' }}>
          <h3 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)',
            marginBottom: '0.6rem', lineHeight: 1.5, cursor: 'pointer',
            transition: 'color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--foreground)'}
          >{paper.title}</h3>
        </Link>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '0.9rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
            {getAuthors(paper)}
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
            {new Date(paper.published_at || paper.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}
          </span>
        </div>

        <p style={{
          fontSize: '0.875rem', color: 'var(--muted-foreground)', lineHeight: 1.75,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', marginBottom: '1rem',
        }}>{paper.abstract}</p>

        {paper.keywords && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
            {paper.keywords.split(',').slice(0, 5).map((kw, i) => (
              <span key={i} style={{
                fontSize: '0.68rem', padding: '0.2rem 0.6rem', borderRadius: '999px',
                background: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)',
              }}>{kw.trim()}</span>
            ))}
          </div>
        )}

        <Link to={`/paper/${paper.id}`} className="btn btn-primary btn-sm" style={{ fontSize: '0.82rem' }}>
          Read Abstract
        </Link>
      </div>
    </div>
  )
}

export default function FutureIssues() {
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => { fetchPapers() }, [])

  async function fetchPapers() {
    setLoading(true)
    setFetchError(false)
    const { data, error } = await supabase
      .from('published_issues')
      .select('id, title, abstract, keywords, authors, author_name, volume_number, issue_number, published_at, created_at')
      .is('volume_number', null)
      .order('published_at', { ascending: false })
      
    if (error) {
      setFetchError(true)
    } else if (data) {
      setPapers(data)
    }
    setLoading(false)
  }

  return (
    <>
      <ElegantGridBackground />
      <BackgroundElements />
      <ParallaxFloatingElements />

      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Hero */}
        <section style={{ padding: '5rem 0 4rem', textAlign: 'center' }}>
          <div className="container">
            <AnimatedSection direction="up">
              <span className="section-label" style={{ justifyContent: 'center' }}>Articles in Press</span>
              <h1 style={{
                fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
                fontWeight: 800, lineHeight: 1.12,
                color: 'var(--foreground)',
                margin: '0.5rem 0 0.75rem',
                letterSpacing: '-0.02em',
              }}>
                Upcoming Publications
              </h1>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.1rem' }}>
                <GoldUnderline width={200} />
              </div>
              <p style={{
                fontSize: '1rem', color: 'var(--muted-foreground)',
                lineHeight: 1.75, margin: '0 auto', maxWidth: '560px',
              }}>
                Accepted papers queued for publication in upcoming issues of <em>Science &amp; Society</em>.
              </p>
            </AnimatedSection>
          </div>
        </section>

        {/* Content */}
        <section style={{ padding: '0 0 5rem' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1.5rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                <p className="text-muted">Loading articles in press...</p>
              </div>
            ) : fetchError ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--destructive)' }}>
                <p style={{ marginBottom: '1rem' }}>Failed to load articles. Please try again.</p>
                <button className="btn btn-outline" onClick={fetchPapers}>Retry</button>
              </div>
            ) : papers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--muted-foreground)' }}>
                <p style={{ fontStyle: 'italic', fontSize: '1rem', marginBottom: '0.5rem' }}>
                  No articles are currently queued for upcoming issues.
                </p>
                <p style={{ fontSize: '0.875rem' }}>
                  Check back soon — newly accepted papers will appear here before formal publication.
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '1.75rem' }}>
                  Showing <strong style={{ color: 'var(--foreground)' }}>{papers.length}</strong> paper{papers.length !== 1 ? 's' : ''} awaiting publication
                </p>
                <div style={{ display: 'grid', gap: '1.25rem' }}>
                  {papers.map((paper, i) => <PaperCard key={paper.id} paper={paper} index={i} />)}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
