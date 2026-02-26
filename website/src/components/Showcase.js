import React from 'react';

const CartoonLaptop = () => (
  <svg viewBox="0 0 400 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="showcase-cartoon-laptop">
    {/* Laptop base shadow */}
    <ellipse cx="200" cy="270" rx="170" ry="10" fill="#e2e8f0" opacity="0.5"/>
    
    {/* Laptop screen frame */}
    <rect x="40" y="10" width="320" height="210" rx="12" fill="#1e293b"/>
    <rect x="48" y="18" width="304" height="186" rx="4" fill="#efeae2"/>
    
    {/* WhatsApp header */}
    <rect x="48" y="18" width="304" height="36" fill="#075e54"/>
    <circle cx="68" cy="36" r="10" fill="#25D366"/>
    <text x="68" y="39" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="sans-serif">S</text>
    <text x="84" y="33" fill="#fff" fontSize="10" fontWeight="600" fontFamily="sans-serif">Sarah</text>
    <text x="84" y="43" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="sans-serif">online</text>
    
    {/* Chat messages */}
    <rect x="160" y="64" width="180" height="32" rx="8" fill="#d9fdd3"/>
    <text x="170" y="78" fill="#303030" fontSize="8" fontFamily="sans-serif">Hey Sarah! 👋 Exclusive offer for you...</text>
    <text x="170" y="90" fill="#303030" fontSize="8" fontFamily="sans-serif">Use code VIP20 for 20% off!</text>
    
    <rect x="58" y="104" width="150" height="24" rx="8" fill="#fff"/>
    <text x="68" y="120" fill="#303030" fontSize="8" fontFamily="sans-serif">That sounds amazing! 🤩</text>
    
    <rect x="180" y="136" width="160" height="24" rx="8" fill="#d9fdd3"/>
    <text x="190" y="152" fill="#303030" fontSize="8" fontFamily="sans-serif">Here&apos;s your personalized link! 🎉</text>
    
    <rect x="58" y="168" width="120" height="24" rx="8" fill="#fff"/>
    <text x="68" y="184" fill="#303030" fontSize="8" fontFamily="sans-serif">Just ordered! Thanks 🙌</text>
    
    {/* Laptop keyboard */}
    <path d="M20 220 L40 210 L360 210 L380 220 Z" fill="#334155"/>
    <rect x="30" y="220" width="340" height="16" rx="2" fill="#475569"/>
    <rect x="140" y="240" width="120" height="6" rx="3" fill="#334155"/>
    
    {/* Floating elements around laptop */}
    {/* Delivery badge */}
    <g transform="translate(330, 40)">
      <rect x="0" y="0" width="60" height="44" rx="10" fill="#fff" stroke="#e2e8f0" strokeWidth="1"/>
      <circle cx="16" cy="16" r="8" fill="#e8fbef"/>
      <text x="16" y="19" textAnchor="middle" fill="#25D366" fontSize="8" fontWeight="700">✓</text>
      <text x="16" y="34" textAnchor="middle" fill="#25D366" fontSize="6" fontWeight="600">100%</text>
    </g>
    
    {/* AI badge */}
    <g transform="translate(-10, 80)">
      <rect x="0" y="0" width="56" height="44" rx="10" fill="#fff" stroke="#e2e8f0" strokeWidth="1"/>
      <circle cx="16" cy="16" r="8" fill="#ede9fe"/>
      <text x="16" y="19" textAnchor="middle" fill="#7c3aed" fontSize="8">🤖</text>
      <text x="16" y="34" textAnchor="middle" fill="#7c3aed" fontSize="6" fontWeight="600">AI</text>
    </g>
    
    {/* Star decorations */}
    <circle cx="15" cy="30" r="3" fill="#fbbf24" opacity="0.6"/>
    <circle cx="390" cy="150" r="2" fill="#a78bfa" opacity="0.6"/>
    <circle cx="25" cy="200" r="2" fill="#34d399" opacity="0.5"/>
    <circle cx="380" cy="80" r="3" fill="#60a5fa" opacity="0.4"/>
  </svg>
);

export default function Showcase() {
  return (
    <section className="showcase">
      <div className="showcase-grid">
        <div className="showcase-visual">
          <CartoonLaptop />
        </div>

        <div className="showcase-text">
          <div className="section-label">📨 Bulk Messaging</div>
          <h2>Send thousands of<br />personalized messages</h2>
          <p>
            Import your contacts via CSV, use merge variables like {'{{name}}'}, {'{{company}}'}, 
            and {'{{offer}}'} to craft personal messages at scale. Smart throttling ensures 
            delivery without getting flagged.
          </p>
          <ul className="showcase-bullets">
            <li>
              <span className="bullet-check">✓</span>
              CSV import with auto-mapping
            </li>
            <li>
              <span className="bullet-check">✓</span>
              Personalization with merge variables
            </li>
            <li>
              <span className="bullet-check">✓</span>
              Smart delivery throttling & retry
            </li>
            <li>
              <span className="bullet-check">✓</span>
              Real-time delivery tracking
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
