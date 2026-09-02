import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDeviceDetect } from '../../lib/useDeviceDetect';

export function IntroAnimation({ onComplete }) {
  const { isMobile, isHeavyAnimationSafe } = useDeviceDetect();
  const [isVisible, setIsVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  /*
    Masthead Timeline (5.5 seconds total):
    
    0.00s  — Logo lens-focuses from deep blur to razor-sharp.
    0.70s  — Upper rule draws left to right.
    0.85s  — Title is revealed by a moving light from left to right.
    1.50s  — Diamond ornament and Subtitle fade in.
    1.80s  — Lower rule expands.
    2.00s  — Second logo fades in.
    4.50s  — Silent, total fade to the site begins.
    5.50s  — Intro unmounts.
  */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    
    // Preload logo2.png
    const img = new Image();
    img.src = "/assets/images/logo2.png";

    const t1 = setTimeout(() => setExiting(true), 4500);
    const t2 = setTimeout(() => setIsVisible(false), 5400);
    const t3 = setTimeout(() => {
      document.body.style.overflow = '';
      onComplete();
    }, 5500);
    return () => { [t1,t2,t3].forEach(clearTimeout); document.body.style.overflow = ''; };
  }, [onComplete]);

  const logoSize = isMobile ? 120 : 160;
  const titleSize = isMobile ? '2.2rem' : '3.6rem';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: exiting ? 0 : 1 }}
          transition={{ duration: 0.85, ease: 'easeInOut' }}
          style={{
            position: 'fixed', inset: 0, zIndex: 999999,
            backgroundColor: '#F4F7FB',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Imperceptible ambient warmth behind the logo — the only non-text element */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: exiting ? 0 : 1 }}
            transition={{ duration: 3, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              width: isMobile ? '70vw' : '55vw',
              height: isMobile ? '70vw' : '55vw',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 65%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
          }}>

            {/* ── LOGO — Cinematic depth-of-field focus ──
                Starts blurry (like an un-focused lens) and snaps to perfect clarity.
                The scale goes from 1.06→1 to simulate optical focus. ── */}
            <motion.div
              initial={{ scale: 1.06, opacity: 0, filter: 'blur(28px)' }}
              animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 1.4, delay: 0, ease: [0.16, 1, 0.3, 1] }}
              style={{
                marginBottom: isMobile ? 28 : 42,
                boxShadow: '0 20px 70px rgba(10,25,47,0.1)',
                borderRadius: '50%',
              }}
            >
              <img
                src="/assets/images/logo.png"
                alt="Science and Society"
                style={{
                  width: logoSize, height: logoSize,
                  borderRadius: '50%', display: 'block',
                }}
              />
            </motion.div>

            {/* ── UPPER RULE — draws left to right, precise ── */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0, transformOrigin: 'left center' }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.7, ease: [0.4, 0, 0.2, 1] }}
              style={{
                width: isMobile ? '72vw' : 440,
                height: 1,
                backgroundColor: '#0A192F',
                opacity: 0.18,
                marginBottom: isMobile ? 14 : 20,
              }}
            />

            {/* ── TITLE — clip-path wipe: a light moving over engraved text ── */}
            <div style={{ position: 'relative', overflow: 'hidden', marginBottom: isMobile ? 14 : 20 }}>
              <motion.h1
                initial={{ clipPath: 'inset(0 100% 0 0)' }}
                animate={{ clipPath: 'inset(0 0% 0 0)' }}
                transition={{ duration: 1.4, delay: 0.85, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  fontFamily: "'EB Garamond', Georgia, serif",
                  fontSize: titleSize,
                  fontWeight: 500,
                  color: '#0A192F',
                  textTransform: 'uppercase',
                  letterSpacing: isMobile ? '0.2em' : '0.32em',
                  margin: 0,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                Science &amp; Society
              </motion.h1>

              {/* Moving light shimmer that follows the reveal */}
              {isHeavyAnimationSafe && (
                <motion.div
                  initial={{ x: '-100%', opacity: 0 }}
                  animate={{ x: '100%', opacity: [0, 1, 0] }}
                  transition={{ duration: 1.4, delay: 0.85, ease: [0.4, 0, 0.2, 1] }}
                  style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: 'linear-gradient(104deg, transparent 30%, rgba(255,255,255,0.7) 50%, transparent 70%)',
                  }}
                />
              )}
            </div>

            {/* ── DIAMOND ORNAMENT ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
              style={{
                width: 5, height: 5,
                backgroundColor: '#c9a84c',
                transform: 'rotate(45deg)',
                marginBottom: isMobile ? 14 : 20,
              }}
            />

            {/* ── SUBTITLE ── */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.0, delay: 1.55, ease: 'easeInOut' }}
              style={{
                fontFamily: "'EB Garamond', Georgia, serif",
                fontStyle: 'italic',
                fontSize: isMobile ? '0.75rem' : '0.88rem',
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.22em',
                margin: 0,
                textAlign: 'center',
                marginBottom: isMobile ? 14 : 20,
              }}
            >
              Journal · Submission · Review System
            </motion.p>

            {/* ── LOWER RULE — mirrors upper, completes the frame ── */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0, transformOrigin: 'left center' }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.9, delay: 1.8, ease: [0.4, 0, 0.2, 1] }}
              style={{
                width: isMobile ? '72vw' : 440,
                height: 1,
                backgroundColor: '#0A192F',
                opacity: 0.18,
                marginBottom: isMobile ? 18 : 26,
              }}
            />

            {/* ── LOGO 2 ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.0, delay: 2.0, ease: 'easeOut' }}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <img
                src="/assets/images/logo2.png"
                alt="Partner Logo"
                style={{
                  width: isMobile ? 220 : 320,
                  height: 'auto',
                  display: 'block',
                }}
              />
            </motion.div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
