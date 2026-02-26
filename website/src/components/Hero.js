import React, { useEffect, useRef, useState } from 'react';

/* ── Inline SVG cartoon illustrations ── */

const CartoonPhone = () => (
  <svg viewBox="0 0 220 420" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 220, height: 420 }}>
    {/* Phone body */}
    <rect x="10" y="10" width="200" height="400" rx="30" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
    <rect x="20" y="50" width="180" height="340" rx="4" fill="#efeae2"/>
    {/* Notch */}
    <rect x="75" y="18" width="70" height="8" rx="4" fill="#334155"/>
    {/* Screen header - WhatsApp green */}
    <rect x="20" y="50" width="180" height="52" rx="0" fill="#075e54"/>
    <circle cx="46" cy="76" r="14" fill="#25D366"/>
    <text x="46" y="81" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700" fontFamily="sans-serif">J</text>
    <text x="68" y="72" fill="#fff" fontSize="11" fontWeight="600" fontFamily="sans-serif">John&apos;s Team</text>
    <text x="68" y="86" fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="sans-serif">online</text>
    {/* Chat bubbles */}
    <rect x="60" y="115" width="130" height="36" rx="10" fill="#d9fdd3"/>
    <text x="70" y="131" fill="#303030" fontSize="8" fontFamily="sans-serif">Hey Sarah! 👋 Check out our</text>
    <text x="70" y="143" fill="#303030" fontSize="8" fontFamily="sans-serif">new launch offer!</text>
    <rect x="30" y="162" width="120" height="28" rx="10" fill="#fff"/>
    <text x="40" y="180" fill="#303030" fontSize="8" fontFamily="sans-serif">Sounds amazing! 🤩</text>
    <rect x="65" y="200" width="125" height="36" rx="10" fill="#d9fdd3"/>
    <text x="75" y="216" fill="#303030" fontSize="8" fontFamily="sans-serif">Use code VIP20 for</text>
    <text x="75" y="228" fill="#303030" fontSize="8" fontFamily="sans-serif">20% off this week! 🎉</text>
    <rect x="30" y="247" width="110" height="28" rx="10" fill="#fff"/>
    <text x="40" y="265" fill="#303030" fontSize="8" fontFamily="sans-serif">Just ordered! 🙌</text>
    {/* Delivery status bar */}
    <rect x="30" y="290" width="160" height="32" rx="8" fill="rgba(37,211,102,0.08)" stroke="rgba(37,211,102,0.2)" strokeWidth="1"/>
    <circle cx="44" cy="306" r="5" fill="#25D366"/>
    <text x="44" y="309" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="700">✓</text>
    <text x="54" y="309" fill="#25D366" fontSize="7" fontWeight="600" fontFamily="sans-serif">4 sent · 100% delivered</text>
    {/* Input bar */}
    <rect x="20" y="335" width="180" height="42" fill="#f0f2f5"/>
    <rect x="30" y="345" width="130" height="24" rx="12" fill="#fff"/>
    <text x="42" y="361" fill="#999" fontSize="8" fontFamily="sans-serif">Type a message...</text>
    <circle cx="176" cy="357" r="12" fill="#25D366"/>
    <path d="M172 357l6-3v6l-6-3z" fill="#fff"/>
    {/* Home bar */}
    <rect x="80" y="398" width="60" height="4" rx="2" fill="#475569"/>
  </svg>
);

const CartoonRobot = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 80, height: 80 }}>
    <rect x="18" y="28" width="44" height="36" rx="10" fill="#7c3aed" opacity="0.15"/>
    <rect x="22" y="32" width="36" height="28" rx="8" fill="#ede9fe"/>
    <rect x="20" y="8" width="40" height="30" rx="12" fill="#7c3aed"/>
    <circle cx="33" cy="22" r="4" fill="#fff"/>
    <circle cx="47" cy="22" r="4" fill="#fff"/>
    <circle cx="33" cy="23" r="2" fill="#1e293b"/>
    <circle cx="47" cy="23" r="2" fill="#1e293b"/>
    <path d="M35 29 Q40 33 45 29" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <line x1="40" y1="8" x2="40" y2="2" stroke="#7c3aed" strokeWidth="2"/>
    <circle cx="40" cy="1" r="3" fill="#a78bfa"/>
    <rect x="8" y="36" width="12" height="6" rx="3" fill="#7c3aed" opacity="0.3"/>
    <rect x="60" y="36" width="12" height="6" rx="3" fill="#7c3aed" opacity="0.3"/>
    <rect x="28" y="62" width="8" height="10" rx="4" fill="#7c3aed" opacity="0.2"/>
    <rect x="44" y="62" width="8" height="10" rx="4" fill="#7c3aed" opacity="0.2"/>
  </svg>
);

const CartoonRocket = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 56, height: 56 }}>
    <path d="M32 6 C32 6 20 20 20 38 L44 38 C44 20 32 6 32 6Z" fill="#25D366"/>
    <path d="M32 6 C32 6 26 16 24 28 L40 28 C38 16 32 6 32 6Z" fill="#4ade80"/>
    <circle cx="32" cy="24" r="5" fill="#fff"/>
    <circle cx="32" cy="24" r="3" fill="#dbeafe"/>
    <path d="M20 32 L12 42 L20 38Z" fill="#f59e0b"/>
    <path d="M44 32 L52 42 L44 38Z" fill="#f59e0b"/>
    <path d="M26 38 L24 50 L32 44 L40 50 L38 38Z" fill="#ef4444" opacity="0.7"/>
    <path d="M28 38 L27 46 L32 42 L37 46 L36 38Z" fill="#fbbf24"/>
    <circle cx="10" cy="14" r="1.5" fill="#fbbf24"/>
    <circle cx="54" cy="10" r="1" fill="#fbbf24"/>
    <circle cx="8" cy="36" r="1" fill="#a78bfa"/>
    <circle cx="56" cy="30" r="1.5" fill="#a78bfa"/>
  </svg>
);

/* Sparkle particle component */
const Particle = ({ style }) => (
  <div className="hero-particle" style={style}>✦</div>
);

/* Animated counter */
function AnimCounter({ end, suffix = '' }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        let start = 0;
        const duration = 1800;
        const startTime = performance.now();
        const tick = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setVal(Math.floor(eased * end));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

export default function Hero() {
  // Generate random sparkle particles
  const particles = Array.from({ length: 20 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    animationDelay: `${Math.random() * 5}s`,
    animationDuration: `${2 + Math.random() * 4}s`,
    fontSize: `${8 + Math.random() * 10}px`,
    opacity: 0.15 + Math.random() * 0.25,
    color: ['#25D366', '#7c3aed', '#3b82f6', '#f59e0b', '#ec4899'][i % 5],
  }));

  return (
    <section className="hero" id="top">
      {/* Background decorations */}
      <div className="hero-bg">
        <div className="hero-blob hero-blob-1" />
        <div className="hero-blob hero-blob-2" />
        <div className="hero-blob hero-blob-3" />
        <div className="hero-grid-pattern" />
        
        {/* Floating particles */}
        {particles.map((p, i) => (
          <Particle key={i} style={p} />
        ))}
      </div>

      <div className="hero-content">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Trusted by 10,000+ WhatsApp Power Users
        </div>

        <h1>
          Supercharge Your<br />
          <span className="gradient-text">WhatsApp Business</span>
        </h1>

        <p className="hero-sub">
          Bulk messaging, AI-powered replies, scheduled sends, quick templates, 
          contact cards & CRM — all inside WhatsApp Web.
        </p>

        <div className="hero-actions">
          <a href="https://chrome.google.com/webstore" className="btn btn-primary btn-xl" target="_blank" rel="noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            Add to Chrome — It's Free
          </a>
          <a href="#features" className="btn btn-ghost btn-lg">
            See All Features
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </a>
        </div>

        {/* ── Cartoon illustration area ── */}
        <div className="hero-illustration">
          <div className="hero-phone">
            {/* Floating cartoon cards */}
            <div className="hero-float hero-float-1">
              <div className="hero-float-card">
                <CartoonRocket />
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>Bulk Sent!</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>1,247 messages delivered</div>
                </div>
              </div>
            </div>

            <div className="hero-float hero-float-2">
              <div className="hero-float-card">
                <CartoonRobot />
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>AI Reply</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Smart response ready</div>
                </div>
              </div>
            </div>

            <div className="hero-float hero-float-3">
              <div className="hero-float-card">
                <div className="hero-float-icon" style={{ background: '#dbeafe' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>Scheduled</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>3 campaigns queued</div>
                </div>
              </div>
            </div>

            {/* Glow ring behind phone */}
            <div className="hero-phone-glow" />
            
            {/* Cartoon phone SVG */}
            <div className="hero-phone-frame-cartoon">
              <CartoonPhone />
            </div>
          </div>
        </div>

        {/* Stats with animated counters */}
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-num"><AnimCounter end={10} suffix="K+" /></div>
            <div className="hero-stat-label">Active Users</div>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <div className="hero-stat-num"><AnimCounter end={5} suffix="M+" /></div>
            <div className="hero-stat-label">Messages Sent</div>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <div className="hero-stat-num">4.9★</div>
            <div className="hero-stat-label">Chrome Store</div>
          </div>
        </div>
      </div>
    </section>
  );
}
