import { motion, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import { useEffect } from 'react';
import { useDeviceDetect } from '../../lib/useDeviceDetect';

/* ─────────────────────────────────────────────────────────────────────────
   SCROLL-DRIVEN BOOK  ·  Performance-optimised for all devices
   Key decisions:
   - Full animations active everywhere as requested.
   - Mobile Layout: Book starts LOWER (60vh) so it does NOT overlap hero text.
   - Mobile Performance: Bypasses useSpring completely to eliminate physics engine lag.
   - Mobile Performance: Reduces 3D spine depth from 6 layers to 2.
   ───────────────────────────────────────────────────────────────────────── */

const NUM_PAGES = 5;

function usePageFlips(progress) {
  const s = 0.79 / NUM_PAGES;
  return [
    useTransform(progress, [0.08, 0.08 + s, 0.88, 0.96], [0, 1, 1, 0]),
    useTransform(progress, [0.08 + s, 0.08 + 2 * s, 0.88, 0.96], [0, 1, 1, 0]),
    useTransform(progress, [0.08 + 2 * s, 0.08 + 3 * s, 0.88, 0.96], [0, 1, 1, 0]),
    useTransform(progress, [0.08 + 3 * s, 0.08 + 4 * s, 0.88, 0.96], [0, 1, 1, 0]),
    useTransform(progress, [0.08 + 4 * s, 0.08 + 5 * s, 0.88, 0.96], [0, 1, 1, 0]),
  ];
}

function useFlipTransforms(flipProgress, index) {
  const rotateY = useTransform(flipProgress, [0, 1], [0, -180]);
  const rightZ = 5 - index;
  const leftZ = -(5 - index);
  const z = useTransform(flipProgress, [0, 1], [rightZ, leftZ]);
  return { rotateY, z };
}

function Page({ flipProgress, index, isMobile }) {
  const { rotateY, z } = useFlipTransforms(flipProgress, index);
  const col = index % 2 === 0
    ? { front: '#ffffff', back: '#f8fafc' }
    : { front: '#fdfdfd', back: '#f1f5f9' };
  const lineWidths = [86, 70, 82, 0, 74, 62, 80, 52, 68];
  const backLines = [78, 63, 74, 0, 68, 55, 72];

  // On mobile, skip rendering the last 2 pages to save GPU 3D layers
  if (isMobile && index > 2) return null;

  return (
    <motion.div style={{
      position: 'absolute', inset: 0,
      transformOrigin: 'left center',
      transformStyle: 'preserve-3d',
      rotateY,
      z,
      willChange: 'transform',
    }}>
      {/* Front face */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, ${col.front} 0%, #f0f4f8 100%)`,
        borderRadius: '1px 6px 6px 1px',
        backfaceVisibility: 'hidden',
        border: '0.5px solid rgba(203,213,225,0.6)',
        boxShadow: '1px 0 10px rgba(0,0,0,0.08)',
        padding: '16px 14px 12px 20px',
        overflow: 'hidden',
      }}>
        <div style={{ width: '48%', height: 4, background: 'linear-gradient(90deg, rgba(29,78,216,0.3), rgba(29,78,216,0.1))', borderRadius: 3, marginBottom: 10 }} />
        <div style={{ width: '30%', height: 2.5, background: 'rgba(197,160,89,0.35)', borderRadius: 2, marginBottom: 10 }} />
        {lineWidths.map((w, li) =>
          w === 0
            ? <div key={li} style={{ height: 9 }} />
            : <div key={li} style={{ width: `${w}%`, height: 2.5, marginBottom: 5.5, background: `rgba(71,85,105,${li % 3 === 0 ? 0.2 : 0.11})`, borderRadius: 2 }} />
        )}
        <div style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 6.5, color: 'rgba(100,116,139,0.5)', fontFamily: 'Georgia, serif' }}>
          {index * 2 + 1}
        </div>
      </div>

      {/* Back face */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, ${col.back} 0%, #e8edf5 100%)`,
        borderRadius: '6px 1px 1px 6px',
        backfaceVisibility: 'hidden',
        transform: 'rotateY(180deg) translateZ(0.5px)',
        border: '0.5px solid rgba(203,213,225,0.45)',
        boxShadow: '-1px 0 10px rgba(0,0,0,0.06)',
        padding: '16px 18px 12px 14px',
        overflow: 'hidden',
      }}>
        <div style={{ width: '42%', height: 4, background: 'linear-gradient(90deg, rgba(29,78,216,0.25), rgba(29,78,216,0.08))', borderRadius: 3, marginBottom: 10 }} />
        <div style={{ width: '26%', height: 2.5, background: 'rgba(197,160,89,0.3)', borderRadius: 2, marginBottom: 10 }} />
        {backLines.map((w, li) =>
          w === 0
            ? <div key={li} style={{ height: 9 }} />
            : <div key={li} style={{ width: `${w}%`, height: 2.5, marginBottom: 5.5, background: `rgba(71,85,105,${li % 2 === 0 ? 0.16 : 0.1})`, borderRadius: 2 }} />
        )}
        <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 6.5, color: 'rgba(100,116,139,0.5)', fontFamily: 'Georgia, serif' }}>
          {index * 2 + 2}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Full animated book ── */
function SpiralScrollPathCore({ isMobile }) {
  const { scrollYProgress } = useScroll();

  // CRITICAL FIX: Bypass useSpring on mobile.
  // The physics engine loop causes tremendous frame drops on mid-range/low-end devices.
  // Direct scroll mapping ensures it paints instantly and smoothly.
  const springSource = useSpring(scrollYProgress, { stiffness: 280, damping: 40, restDelta: 0.0005 });
  const smooth = isMobile ? scrollYProgress : springSource;

  // ─── Position via transform (NOT top/left — avoids layout recalculation) ──
  // MOBILE FIX: bookY starts at 60vh (below text) and stays generally lower.
  // bookX is centered/shifted slightly so it doesn't clip off screen.
  const deskX = ['calc(56vw - 77px)', 'calc(25vw - 77px)', 'calc(78vw - 77px)', 'calc(32vw - 77px)', 'calc(85vw - 77px)', 'calc(90vw - 77px)'];
  const deskY = ['calc(30vh - 102px)', 'calc(35vh - 102px)', 'calc(55vh - 102px)', 'calc(75vh - 102px)', 'calc(80vh - 102px)', 'calc(80vh - 102px)'];
  
  const mobX = ['calc(50vw - 77px)', 'calc(10vw - 77px)', 'calc(70vw - 77px)', 'calc(15vw - 77px)', 'calc(65vw - 77px)', 'calc(50vw - 77px)'];
  const mobY = ['calc(60vh - 102px)', 'calc(65vh - 102px)', 'calc(70vh - 102px)', 'calc(75vh - 102px)', 'calc(80vh - 102px)', 'calc(85vh - 102px)'];

  const bookX = useTransform(smooth, [0, 0.25, 0.5, 0.75, 0.92, 1], isMobile ? mobX : deskX);
  const bookY = useTransform(smooth, [0, 0.25, 0.5, 0.75, 0.92, 1], isMobile ? mobY : deskY);

  // ─── 3D tilt — direct from smooth (no extra spring to prevent desync) ──
  const tiltX = useTransform(smooth, [0, 0.25, 0.5, 0.75, 1], [25, 40, 25, 45, 35]);
  const tiltY = useTransform(smooth, [0, 0.25, 0.5, 0.75, 1], [-18, 12, -8, 22, -12]);
  const tiltZ = useTransform(smooth, [0, 0.25, 0.5, 0.75, 1], [-6, 5, -5, 8, -6]);

  const coverOpen = useTransform(smooth, [0, 0.08, 0.88, 0.96], [0, -180, -180, 0]);
  const coverZ = useTransform(smooth, [0, 0.08, 0.88, 0.96], [6, -6, -6, 6]);

  const pageFlips = usePageFlips(smooth);

  // ─── Mouse parallax: desktop only ─────────────────────────────────────
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const pRX = useSpring(useTransform(mouseY, [-20, 20], [8, -8]), { stiffness: 120, damping: 28 });
  const pRY = useSpring(useTransform(mouseX, [-20, 20], [-8, 8]), { stiffness: 120, damping: 28 });

  useEffect(() => {
    if (isMobile) return;
    const onMove = (e) => {
      mouseX.set((e.clientX / window.innerWidth - 0.5) * 40);
      mouseY.set((e.clientY / window.innerHeight - 0.5) * 40);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [mouseX, mouseY, isMobile]);

  // Mobile optimization: scale the whole book down slightly and drastically cut the 3D depth stack
  const scale = isMobile ? 0.85 : 1;
  const spineDepthLayers = isMobile ? 2 : 6;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      zIndex: 5,
      pointerEvents: 'none',
      perspective: isMobile ? '600px' : '900px',
    }}>
      {/* LAYER 1: Position only */}
      <motion.div style={{
        position: 'absolute',
        top: 0, left: 0,
        x: bookX, y: bookY,
        scale: scale,
        willChange: 'transform',
      }}>
        {/* LAYER 2: 3D tilt — all rotations in one div */}
        <motion.div style={{
          width: 155, height: 205,
          transformStyle: 'preserve-3d',
          rotateX: tiltX,
          rotateY: tiltY,
          rotateZ: tiltZ,
          willChange: 'transform',
        }}>
          {/* LAYER 3: Mouse parallax wrapper (static on mobile) */}
          <motion.div style={{
            width: '100%', height: '100%',
            transformStyle: 'preserve-3d',
            rotateX: isMobile ? 0 : pRX,
            rotateY: isMobile ? 0 : pRY,
            willChange: 'transform',
          }}>

            {/* Back Cover */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(155deg, #1a3660 0%, #0c1e3d 100%)',
              borderRadius: '2px 10px 10px 2px',
              transform: 'translateZ(-1px)',
              boxShadow: '0 28px 55px rgba(0,0,0,0.4)',
              border: '0.5px solid rgba(255,255,255,0.1)',
            }} />

            {/* Paper stack depth */}
            {[...Array(spineDepthLayers)].map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                top: `${i}px`, bottom: `${i}px`,
                left: `${i}px`, right: `${(spineDepthLayers / 2) - i}px`,
                background: i % 2 === 0 ? '#f8fafc' : '#f1f5f9',
                borderRadius: '1px 7px 7px 1px',
                transform: `translateZ(${i}px)`,
                borderRight: `1px solid rgba(203,213,225,${0.3 + i * 0.1})`,
              }} />
            ))}

            {/* Scroll-driven pages */}
            {pageFlips.map((flipProgress, i) => (
              <Page key={i} index={i} flipProgress={flipProgress} isMobile={isMobile} />
            ))}

            {/* ── Front Cover ── */}
            <motion.div style={{
              position: 'absolute', inset: 0,
              transformOrigin: 'left center',
              transformStyle: 'preserve-3d',
              rotateY: coverOpen,
              z: coverZ,
              willChange: 'transform',
            }}>
              {/* Front face — no Framer Motion animate loops inside */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(135deg, #1e3a5f 0%, #091c3a 50%, #1D4ED8 100%)',
                borderRadius: '2px 10px 10px 2px',
                backfaceVisibility: 'hidden',
                border: '0.5px solid rgba(255,255,255,0.14)',
                boxShadow: 'inset 0 0 30px rgba(255,255,255,0.03), inset 3px 0 12px rgba(0,0,0,0.55), 6px 12px 40px rgba(0,0,0,0.45)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
                overflow: 'hidden',
              }}>
                {/* Shimmer — CSS-only, far cheaper than Framer Motion animate */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(110deg, transparent 38%, rgba(255,255,255,0.07) 50%, transparent 62%)',
                  animation: 'bookShimmer 7s ease-in-out infinite',
                }} />

                {/* Logo emblem */}
                <div style={{
                  width: 68, height: 68, borderRadius: '50%',
                  border: '2.5px solid rgba(197,160,89,0.85)',
                  boxShadow: '0 0 20px rgba(197,160,89,0.65), inset 0 0 14px rgba(197,160,89,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                  background: '#ffffff',
                  padding: 4,
                }}>
                  <img
                    src="/assets/images/logo.png"
                    alt="Science and Society"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%', display: 'block' }}
                  />
                </div>

                <div style={{ width: '56%', height: 2.5, background: 'rgba(197,160,89,0.88)', borderRadius: 2 }} />
                <div style={{ width: '35%', height: 1.5, background: 'rgba(197,160,89,0.5)', borderRadius: 2 }} />
                <div style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F3D275', fontFamily: 'Georgia, serif', marginTop: 6, textAlign: 'center', fontWeight: '800', textShadow: '0 1px 3px rgba(0,0,0,0.7), 0 0 12px rgba(243,210,117,0.5)' }}>
                  Science &amp; Society
                </div>
              </div>

              {/* Back face of cover (inside) */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(135deg, #091c3a 0%, #112a52 100%)',
                borderRadius: '10px 2px 2px 10px',
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg) translateZ(0.5px)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                boxShadow: 'inset -5px 0 15px rgba(0,0,0,0.4)',
              }} />
            </motion.div>

            {/* Book Spine */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 14,
              background: 'linear-gradient(90deg, #0d2550 0%, #1D4ED8 45%, #0a1628 100%)',
              borderRadius: '5px 0 0 5px',
              transform: 'rotateY(-90deg) translateZ(0)',
              boxShadow: '-3px 0 18px rgba(29,78,216,0.45)',
            }} />

          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ── Main export ── */
export function SpiralScrollPath() {
  const { isMobile } = useDeviceDetect();

  // We explicitly run the heavy animated book on all devices,
  // but the Core uses isMobile to disable physics loops & fix layout.
  return <SpiralScrollPathCore isMobile={isMobile} />;
}
