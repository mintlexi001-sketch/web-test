import { GoldUnderline } from '../components/ui/GoldUnderline'
import { ElegantGridBackground } from '../components/ui/ElegantGridBackground'
import { BackgroundElements } from '../components/ui/BackgroundElements'
import { ParallaxFloatingElements } from '../components/ui/ParallaxFloatingElements'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const allCards = [
  {
    title: 'Our Mission',
    description: 'To bridge the gap between scientific advancement and societal impact by publishing original research that informs policy, ethics, and sustainable development.',
    num: '01', strong: true,
  },
  {
    title: 'Our Vision',
    description: 'A world where knowledge flows freely between disciplines — where scientists, scholars, and citizens engage together to shape a better future.',
    num: '02', strong: true,
  },
  {
    title: 'Our Values',
    description: 'Academic integrity, inclusivity, rigorous peer review, and a commitment to open and constructive scholarly dialogue across all disciplines.',
    num: '03', strong: true,
  },
  {
    title: 'Secure Submission',
    description: 'Secure submissions ensuring your research remains confidential throughout the review process.',
    num: '04', strong: true,
  },
  {
    title: 'Expert Reviewers',
    description: 'Multi-level review by domain experts ensuring thorough evaluation and constructive feedback.',
    num: '05', strong: true,
  },
  {
    title: 'Fast Turnaround',
    description: 'Streamlined workflow with real-time status tracking for quick and transparent review cycles.',
    num: '06', strong: true,
  },
  {
    title: 'Quality Standards',
    description: 'Rigorous academic standards maintained through our comprehensive peer review process.',
    num: '07', strong: true,
  },
]

export default function About() {
  const { user, profile } = useAuth()
  const canSubmit = !user || profile?.role === 'student'

  return (
    <>
      {/* ── Subtle background ── */}
      <ElegantGridBackground />
      <BackgroundElements />
      <ParallaxFloatingElements />

      {/* All content sits above the fixed background at zIndex 2 */}
      <div style={{ position: 'relative', zIndex: 2 }}>

        {/* ════════════════════════════════════════════════════════
            HERO
        ════════════════════════════════════════════════════════ */}
        <section style={{
          padding: '5rem 0 4rem',
          textAlign: 'center',
        }}>
          <div className="container">
            <h2 className="section-title">
              About the Journal
            </h2>
            <h1 style={{
              fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
              fontWeight: 800, lineHeight: 1.12,
              color: 'var(--foreground)',
              margin: '0 0 0.75rem',
              letterSpacing: '-0.02em',
            }}>
              Science and Society
            </h1>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.1rem' }}>
              <GoldUnderline width={200} />
            </div>
            <p style={{
              fontSize: '0.95rem',
              color: 'var(--muted-foreground)',
              letterSpacing: '0.02em',
              margin: 0,
            }}>
              Nirmala Academic and Research Publications (NARP)&nbsp;·&nbsp;Established 2003
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            OFFICIAL JOURNAL DESCRIPTION
        ════════════════════════════════════════════════════════ */}
        <style>{`
          @keyframes bubbleFloat {
            0%   { transform: translateY(0px) scale(1); opacity: 0.4; }
            50%  { transform: translateY(-20px) scale(1.03); opacity: 0.6; }
            100% { transform: translateY(0px) scale(1); opacity: 0.4; }
          }
          @keyframes bubbleFloat2 {
            0%   { transform: translateY(0px) scale(1); opacity: 0.3; }
            50%  { transform: translateY(-15px) scale(1.02); opacity: 0.5; }
            100% { transform: translateY(0px) scale(1); opacity: 0.3; }
          }
          @keyframes bubblePulse {
            0%,100% { transform: scale(1); opacity: 0.2; }
            50%      { transform: scale(1.06); opacity: 0.4; }
          }
        `}</style>

        <section style={{
          padding: '4rem 0',
        }}>
          <div className="container">
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr clamp(220px, 30%, 340px)',
              gap: '3rem',
              alignItems: 'start',
            }}>

              {/* ── LEFT: text ── */}
              <div>
                {/* Paragraph 1 */}
                <p style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.08rem',
                  lineHeight: 1.95,
                  color: 'var(--foreground)',
                  margin: '0 0 1.5rem',
                }}>
                  <strong>Science &amp; Society</strong> is a multidisciplinary, peer-reviewed journal
                  published by <strong>Nirmala Academic and Research Publications (NARP)</strong>. Since
                  its inception in 2003, the journal has been committed to promoting high-quality research
                  and scholarly communication, establishing a distinguished legacy of serving the academic
                  community.
                </p>

                {/* Paragraph 2 */}
                <p style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.08rem',
                  lineHeight: 1.95,
                  color: 'var(--foreground)',
                  margin: '0 0 1.5rem',
                }}>
                  The journal provides a platform for the publication and dissemination of original
                  research articles and review papers across the broad domains of science, technology,
                  humanities, literature, commerce, and allied disciplines. It seeks to foster
                  interdisciplinary research, promote scholarly dialogue, and disseminate knowledge
                  that advances scientific inquiry, innovation, and societal development.
                </p>

                {/* Paragraph 3 — peer review blockquote */}
                <blockquote style={{
                  margin: '0 0 1.5rem',
                  padding: '1.6rem 2rem',
                  borderLeft: '3px solid var(--primary)',
                  background: 'var(--card)',
                  borderRadius: '0 0.75rem 0.75rem 0',
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: '1.06rem',
                  lineHeight: 1.95,
                  color: 'var(--foreground)',
                }}>
                  All manuscripts submitted to the journal undergo a rigorous peer-review process to
                  ensure originality, scientific merit, methodological rigor, and ethical integrity.
                  The journal adheres to internationally accepted standards of publication ethics and
                  follows a transparent and objective editorial process for the evaluation and
                  publication of manuscripts.
                </blockquote>

                {/* Paragraph 4 */}
                <p style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.08rem',
                  lineHeight: 1.95,
                  color: 'var(--foreground)',
                  margin: '0 0 1.5rem',
                }}>
                  The editorial policies, publication standards, and strategic direction of the journal
                  are formulated and periodically reviewed by the <strong>Editorial Board</strong> and{' '}
                  <strong>Advisory Board</strong>, comprising distinguished academicians and researchers
                  from diverse disciplines. Their collective expertise ensures that the journal maintains
                  the highest standards of scholarly excellence, academic integrity, and editorial quality.
                </p>

                {/* Paragraph 5 */}
                <p style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.08rem',
                  lineHeight: 1.95,
                  color: 'var(--foreground)',
                  margin: 0,
                }}>
                  Through its unwavering commitment to quality publishing and interdisciplinary
                  scholarship, <em>Science &amp; Society</em> serves as a vibrant platform for
                  researchers, academicians, professionals, and students to disseminate innovative
                  research, exchange ideas, and contribute to the advancement of knowledge across
                  diverse disciplines.
                </p>
              </div>

              {/* ── RIGHT: floating bubble decoration ── */}
              <div style={{
                position: 'sticky',
                top: '6rem',
                height: '480px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                userSelect: 'none',
              }}>
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>

                  {/* Large primary orb */}
                  <div style={{
                    position: 'absolute', top: '10%', left: '15%',
                    width: '160px', height: '160px', borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%, rgba(29,78,216,0.25) 0%, rgba(29,78,216,0.05) 60%, transparent 100%)',
                    animation: 'bubbleFloat 7s ease-in-out infinite',
                    backdropFilter: 'blur(2px)',
                  }} />

                  {/* Medium gold orb */}
                  <div style={{
                    position: 'absolute', top: '38%', right: '8%',
                    width: '110px', height: '110px', borderRadius: '50%',
                    background: 'radial-gradient(circle at 40% 40%, rgba(201,168,76,0.3) 0%, rgba(201,168,76,0.08) 60%, transparent 100%)',
                    animation: 'bubbleFloat2 9s ease-in-out 1.5s infinite',
                  }} />

                  {/* Small blue orb top-right */}
                  <div style={{
                    position: 'absolute', top: '5%', right: '18%',
                    width: '70px', height: '70px', borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%, rgba(59,130,246,0.35) 0%, transparent 70%)',
                    animation: 'bubbleFloat 11s ease-in-out 3s infinite',
                  }} />

                  {/* Tiny gold dot */}
                  <div style={{
                    position: 'absolute', top: '30%', left: '8%',
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(201,168,76,0.4) 0%, transparent 70%)',
                    animation: 'bubbleFloat2 6s ease-in-out 0.8s infinite',
                  }} />

                  {/* Large bottom orb */}
                  <div style={{
                    position: 'absolute', bottom: '8%', left: '20%',
                    width: '130px', height: '130px', borderRadius: '50%',
                    background: 'radial-gradient(circle at 40% 40%, rgba(29,78,216,0.2) 0%, rgba(99,102,241,0.08) 55%, transparent 100%)',
                    animation: 'bubbleFloat 8.5s ease-in-out 2s infinite',
                  }} />

                  {/* Small indigo bottom-right */}
                  <div style={{
                    position: 'absolute', bottom: '18%', right: '12%',
                    width: '60px', height: '60px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
                    animation: 'bubbleFloat2 10s ease-in-out 4s infinite',
                  }} />

                  {/* Ring overlay */}
                  <div style={{
                    position: 'absolute', top: '22%', left: '10%',
                    width: '180px', height: '180px', borderRadius: '50%',
                    border: '1px solid rgba(29,78,216,0.15)',
                    animation: 'bubblePulse 6s ease-in-out infinite',
                  }} />

                  {/* Second ring */}
                  <div style={{
                    position: 'absolute', bottom: '15%', right: '5%',
                    width: '120px', height: '120px', borderRadius: '50%',
                    border: '1px solid rgba(201,168,76,0.15)',
                    animation: 'bubblePulse 8s ease-in-out 2s infinite',
                  }} />

                </div>
              </div>


            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════════════════
            7 CARDS
        ════════════════════════════════════════════════════════ */}
        <section style={{
          padding: '4.5rem 0',
          borderBottom: '1px solid var(--border)',
        }}>
          <div className="container">

            {/* Heading */}
            <div style={{ textAlign: 'center', marginBottom: '2.75rem' }}>
              <h2 className="section-title" style={{ color: '#fff', fontSize: '1.8rem' }}>
                What We Stand For
              </h2>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GoldUnderline width={110} />
              </div>
            </div>

            {/* Centred flex grid */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '1.25rem',
            }}>
              {allCards.map((c) => (
                <div
                  key={c.title}
                  className="card"
                  style={{
                    width: '260px',
                    flexShrink: 0,
                    padding: '1.75rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    border: '1px solid var(--border)',
                    borderTop: `2px solid ${c.strong ? 'var(--primary)' : 'var(--border-hover)'}`,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'box-shadow 0.22s, transform 0.22s',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = '0 10px 36px rgba(29,78,216,0.15)'
                    e.currentTarget.style.transform = 'translateY(-4px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = ''
                    e.currentTarget.style.transform = ''
                  }}
                >
                  <span style={{
                    position: 'absolute', top: '0.7rem', right: '1rem',
                    fontSize: '2.5rem', fontWeight: 800, lineHeight: 1,
                    color: 'var(--muted)',
                    zIndex: 0,
                  }}>
                    {c.num}
                  </span>
                  <div style={{
                    width: '24px', height: '3px', borderRadius: '2px',
                    background: c.strong ? 'var(--primary)' : 'var(--border-hover)',
                    position: 'relative', zIndex: 1,
                  }} />
                  <h3 style={{
                    fontSize: '1rem', fontWeight: 700,
                    color: 'var(--foreground)', margin: 0,
                    position: 'relative', zIndex: 1,
                  }}>
                    {c.title}
                  </h3>
                  <p style={{
                    fontSize: '0.875rem', color: 'var(--muted-foreground)',
                    lineHeight: 1.65, margin: 0,
                    position: 'relative', zIndex: 1,
                  }}>
                    {c.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            CTA
        ════════════════════════════════════════════════════════ */}
        {canSubmit && (
          <section style={{ padding: '4.5rem 0' }}>
            <div className="container" style={{ textAlign: 'center' }}>
              <h3 style={{
                fontSize: 'clamp(1.4rem, 3vw, 1.85rem)',
                fontWeight: 800, color: 'var(--foreground)',
                margin: '0 0 0.75rem', letterSpacing: '-0.01em',
              }}>
                Ready to Contribute?
              </h3>
              <p style={{
                color: 'var(--muted-foreground)', fontSize: '0.97rem',
                lineHeight: 1.7, margin: '0 auto 2rem', maxWidth: '440px',
              }}>
                Join our growing scholarly community and submit your original research for peer review
                and publication.
              </p>
              <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/register" className="btn btn-primary" style={{ padding: '0.8rem 2.25rem', fontWeight: 700 }}>
                  Submit Your Manuscript
                </Link>
              </div>
            </div>
          </section>
        )}

      </div>
    </>
  )
}
