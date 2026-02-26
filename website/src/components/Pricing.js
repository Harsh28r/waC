import React, { useRef } from 'react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/forever',
    note: 'Perfect for getting started',
    featured: false,
    features: [
      '50 bulk messages/day',
      '5 quick reply templates',
      'Basic contact cards',
      'Schedule 3 msgs/day',
      'Community support',
    ],
    cta: 'Get Started Free',
    ctaClass: 'btn btn-ghost btn-lg',
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/mo',
    note: 'For power users & teams',
    featured: true,
    badge: 'MOST POPULAR',
    features: [
      'Unlimited bulk messages',
      'AI smart replies (GPT-4)',
      'Unlimited templates',
      'Advanced CRM & tags',
      'Analytics dashboard',
      'Priority support',
      'Export chats & contacts',
      'Team collab (3 seats)',
    ],
    cta: 'Start Free Trial',
    ctaClass: 'btn btn-primary btn-lg',
  },
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
      <h2 className="section-title">Simple, transparent pricing</h2>
      <p className="section-sub" style={{ margin: '0 auto' }}>
        Start free. Upgrade when you need more. Cancel anytime.
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
    </section>
  );
}
