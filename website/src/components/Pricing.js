import React, { useRef } from 'react';

const plan = {
  name: 'Free forever',
  price: '$0',
  period: '',
  note: 'Same feature set others paywall — we don’t',
  featured: true,
  badge: 'MARKET STANDARD',
  features: [
    'Bulk messaging & campaigns (you control daily pace)',
    'AI auto-reply & chat context — bring your own Gemini or Claude key',
    'Quick replies, templates, schedule & drip',
    'CRM cards, segments, pipeline, Sheets import',
    'Analytics, webhooks, link tracking, business hours',
    'Blur / privacy mode, stealth send, DNC list',
    'No subscription, no credit card, no expiring trial',
  ],
  cta: 'Add to Chrome — free',
  ctaClass: 'btn btn-primary btn-lg',
};

const launchSteps = [
  'Install from the Chrome Web Store',
  'Open WhatsApp Web and sign in',
  'Import contacts (CSV or from chats)',
  'Optional: add a free Gemini key in Settings for AI features',
  'Run campaigns and auto-reply with safe delays',
];

/* Spotlight follow effect on card */
function SpotlightCard({ children, featured }) {
  const cardRef = useRef(null);

  const handleMove = (e) => {
    if (!featured || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--spot-x', `${x}px`);
    cardRef.current.style.setProperty('--spot-y', `${y}px`);
  };

  return (
    <div
      ref={cardRef}
      className={`pricing-card ${featured ? 'featured spotlight' : ''}`}
      onMouseMove={handleMove}
    >
      {featured && <div className="pricing-spotlight-overlay" />}
      {children}
    </div>
  );
}

export default function Pricing() {
  return (
    <section className="pricing" id="pricing">
      <div className="section-label" style={{ justifyContent: 'center', margin: '0 auto 14px' }}>💚 Pricing</div>
      <h2 className="section-title">100% free — full product, zero paywall</h2>
      <p className="section-sub" style={{ margin: '0 auto' }}>
        We don&apos;t charge for the extension. AI features use your own API keys (Gemini&apos;s free tier is enough for most teams).
      </p>

      <div className="pricing-cards" style={{ gridTemplateColumns: 'minmax(280px, 440px)', justifyContent: 'center' }}>
        <SpotlightCard featured={plan.featured}>
          {plan.badge && <div className="pricing-badge">{plan.badge}</div>}
          <h3>{plan.name}</h3>
          <div className="price">{plan.price}{plan.period ? <span>{plan.period}</span> : null}</div>
          <div className="price-note">{plan.note}</div>
          <ul className="pricing-features">
            {plan.features.map((f, j) => (
              <li key={j}>{f}</li>
            ))}
          </ul>
          <a href="https://chrome.google.com/webstore" className={plan.ctaClass} style={{ width: '100%' }} target="_blank" rel="noreferrer">
            {plan.cta}
          </a>
        </SpotlightCard>
      </div>

      <div className="plans-guide" style={{ marginTop: 48 }}>
        <div className="section-label" style={{ justifyContent: 'center', margin: '0 auto 14px' }}>🚀 Quick start</div>
        <h2 className="section-title">Go live in minutes</h2>
        <p className="section-sub" style={{ margin: '0 auto 32px' }}>
          No checkout, no plan picker — just install and use.
        </p>
        <div className="plans-guide-grid" style={{ gridTemplateColumns: '1fr', maxWidth: 560, margin: '0 auto' }}>
          <div className="plans-guide-card featured-guide">
            <ol className="plans-guide-steps">
              {launchSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <p className="plans-guide-tip">Respect WhatsApp limits: keep daily sends conservative and use delays — the extension is built for that.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
