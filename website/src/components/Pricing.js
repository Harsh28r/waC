import React, { useRef } from 'react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/forever',
    note: 'Get started with core features',
    featured: false,
    features: [
      'Bulk messaging (daily limit)',
      'Quick reply templates (limited)',
      'Auto Reply — template mode only',
      'Blur privacy mode (hover to reveal)',
      'Schedule a few campaigns',
      'Contact list & basic cards',
      'Campaign dashboard',
      'Quick sender & template library',
      'Community support',
    ],
    cta: 'Get Started Free',
    ctaClass: 'btn btn-ghost btn-lg',
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/mo',
    note: 'Full power for teams & businesses',
    featured: true,
    badge: 'BEST VALUE',
    features: [
      'Unlimited bulk messages',
      'AI Auto Reply (Gemini or Claude)',
      'Chat-context & varied replies',
      'Per-chat: reply in all conversations',
      'Keyword + no-keyword AI replies',
      'Blur privacy mode + auto-on at start',
      'Drip campaigns & sequences',
      'CRM, segments, pipeline funnel',
      'Google Sheets import',
      'Analytics, custom reports, digest',
      'Webhook / Zapier, link tracker',
      'Business hours & birthday sender',
      'DNC list, stealth mode',
      'Priority support',
    ],
    cta: 'Start Pro Trial',
    ctaClass: 'btn btn-primary btn-lg',
  },
];

const featureComparison = [
  { feature: 'Bulk messaging', free: 'Daily limit', paid: 'Unlimited' },
  { feature: 'Auto Reply', free: 'Template only', paid: 'Template + AI (Gemini/Claude)' },
  { feature: 'Blur privacy mode', free: '✓ Hover to reveal', paid: '✓ + auto-on at start' },
  { feature: 'Reply in all chats', free: '—', paid: '✓ Per-chat mode' },
  { feature: 'AI understands chat history', free: '—', paid: '✓' },
  { feature: 'Drip campaigns', free: '—', paid: '✓' },
  { feature: 'CRM & segments', free: 'Basic list', paid: 'Full CRM, pipeline, Sheets' },
  { feature: 'Analytics & reports', free: 'Basic', paid: 'Full + custom PDF' },
  { feature: 'Webhook / integrations', free: '—', paid: '✓' },
  { feature: 'Support', free: 'Community', paid: 'Priority' },
];

const launchStepsFree = [
  'Install the extension from Chrome Web Store',
  'Open WhatsApp Web and log in',
  'Add contacts (CSV or from chat list)',
  'Compose a message, use template mode for Auto Reply',
  'Send campaigns within daily limits',
];

const launchStepsPro = [
  'Do everything in Free, then unlock Pro',
  'Add Gemini (free) or Claude API key in Settings',
  'Turn on AI Auto Reply + optional "Monitor all chats"',
  'Set up Drip sequences and CRM if needed',
  'Connect webhook or use reports for analytics',
];

/* Spotlight follow effect on featured card */
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
      <div className="section-label" style={{ justifyContent: 'center', margin: '0 auto 14px' }}>💎 Pricing</div>
      <h2 className="section-title">Simple, feature-based pricing</h2>
      <p className="section-sub" style={{ margin: '0 auto' }}>
        Start free. Upgrade to Pro for AI, drip, CRM, and integrations. Cancel anytime.
      </p>

      <div className="pricing-cards">
        {plans.map((plan, i) => (
          <SpotlightCard key={i} featured={plan.featured}>
            {plan.badge && <div className="pricing-badge">{plan.badge}</div>}
            <h3>{plan.name}</h3>
            <div className="price">{plan.price}<span>{plan.period}</span></div>
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
        ))}
      </div>

      {/* Feature comparison table */}
      <div className="pricing-comparison">
        <h3 className="pricing-comparison-title">Feature comparison</h3>
        <div className="pricing-table-wrap">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Free</th>
                <th>Pro</th>
              </tr>
            </thead>
            <tbody>
              {featureComparison.map((row, i) => (
                <tr key={i}>
                  <td>{row.feature}</td>
                  <td>{row.free}</td>
                  <td><strong>{row.paid}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Launch guide: go live based on plan */}
      <div className="plans-guide">
        <div className="section-label" style={{ justifyContent: 'center', margin: '0 auto 14px' }}>🚀 Launch guide</div>
        <h2 className="section-title">Go live based on your plan</h2>
        <p className="section-sub" style={{ margin: '0 auto 32px' }}>
          Follow these steps to get the most out of Free or Pro.
        </p>
        <div className="plans-guide-grid">
          <div className="plans-guide-card">
            <h4>Free plan</h4>
            <ol className="plans-guide-steps">
              {launchStepsFree.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <p className="plans-guide-tip">Use template-based Auto Reply (e.g. “Thanks! We’ll get back soon”) and stay within daily send limits.</p>
          </div>
          <div className="plans-guide-card featured-guide">
            <h4>Pro plan</h4>
            <ol className="plans-guide-steps">
              {launchStepsPro.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <p className="plans-guide-tip">Enable AI for auto-reply and “Monitor all chats” so every conversation gets a smart reply. Add drip and CRM when you’re ready.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
