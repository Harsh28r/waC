import React from 'react';

const CartoonMascot = () => (
  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 120, height: 120 }} className="cta-mascot">
    {/* Body */}
    <ellipse cx="60" cy="95" rx="28" ry="18" fill="#25D366" opacity="0.15"/>
    <rect x="36" y="52" width="48" height="40" rx="12" fill="#25D366"/>
    <rect x="40" y="56" width="40" height="32" rx="10" fill="#4ade80"/>
    <rect x="36" y="72" width="48" height="4" fill="#1ebe5d"/>
    <circle cx="60" cy="74" r="4" fill="#fbbf24"/>
    {/* Head */}
    <circle cx="60" cy="34" r="26" fill="#25D366"/>
    <circle cx="60" cy="34" r="22" fill="#4ade80"/>
    <ellipse cx="50" cy="32" rx="5" ry="6" fill="#fff"/>
    <ellipse cx="70" cy="32" rx="5" ry="6" fill="#fff"/>
    <circle cx="51" cy="33" r="3" fill="#1e293b"/>
    <circle cx="71" cy="33" r="3" fill="#1e293b"/>
    <circle cx="52" cy="31.5" r="1" fill="#fff"/>
    <circle cx="72" cy="31.5" r="1" fill="#fff"/>
    <path d="M50 42 Q60 50 70 42" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <circle cx="44" cy="40" r="4" fill="#ff9f9f" opacity="0.3"/>
    <circle cx="76" cy="40" r="4" fill="#ff9f9f" opacity="0.3"/>
    {/* Arms */}
    <rect x="18" y="58" width="20" height="8" rx="4" fill="#25D366"/>
    <rect x="82" y="58" width="20" height="8" rx="4" fill="#25D366"/>
    <rect x="86" y="48" width="18" height="30" rx="4" fill="#1e293b"/>
    <rect x="88" y="52" width="14" height="22" rx="2" fill="#efeae2"/>
    <rect x="88" y="52" width="14" height="6" fill="#075e54"/>
    <rect x="92" y="62" width="8" height="4" rx="2" fill="#d9fdd3"/>
    <rect x="89" y="68" width="6" height="3" rx="1.5" fill="#fff"/>
    {/* Legs */}
    <rect x="44" y="88" width="10" height="14" rx="5" fill="#25D366"/>
    <rect x="66" y="88" width="10" height="14" rx="5" fill="#25D366"/>
    <ellipse cx="49" cy="102" rx="7" ry="4" fill="#1ebe5d"/>
    <ellipse cx="71" cy="102" rx="7" ry="4" fill="#1ebe5d"/>
    {/* Crown */}
    <path d="M48 10 L52 4 L56 10 L60 2 L64 10 L68 4 L72 10" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Sparkles */}
    <circle cx="20" cy="24" r="2" fill="#fbbf24" opacity="0.6"/>
    <circle cx="100" cy="28" r="2.5" fill="#a78bfa" opacity="0.5"/>
    <circle cx="14" cy="80" r="1.5" fill="#60a5fa" opacity="0.5"/>
    <circle cx="106" cy="86" r="2" fill="#f472b6" opacity="0.4"/>
  </svg>
);

/* Animated ring decorations */
const GlowRings = () => (
  <div className="cta-rings">
    <div className="cta-ring cta-ring-1" />
    <div className="cta-ring cta-ring-2" />
    <div className="cta-ring cta-ring-3" />
  </div>
);

export default function CTA() {
  return (
    <section className="cta-section">
      <div className="cta-bg">
        <div className="cta-gradient" />
      </div>

      <div className="cta-card">
        <GlowRings />
        <CartoonMascot />
        <h2 style={{ marginTop: 24 }}>Ready to 10x your<br /><span className="gradient-text">WhatsApp game?</span></h2>
        <p>
          Join 10,000+ marketers, founders, and sales teams already using WA Bulk AI 
          to grow their business on WhatsApp.
        </p>
        <a href="https://chrome.google.com/webstore" className="btn btn-primary btn-xl" target="_blank" rel="noreferrer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          Install WA Bulk AI — Free
        </a>
        <div className="cta-trust">
          <div className="cta-trust-item">
            <span className="cta-trust-icon">🔒</span>
            100% Private
          </div>
          <div className="cta-trust-item">
            <span className="cta-trust-icon">⚡</span>
            No Setup Required
          </div>
          <div className="cta-trust-item">
            <span className="cta-trust-icon">💳</span>
            No Credit Card
          </div>
        </div>
      </div>
    </section>
  );
}
