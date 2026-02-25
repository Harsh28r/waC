import React from 'react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/forever',
    note: 'Perfect for getting started',
    featured: false,
    features: [
      '50 bulk messages / day',
      'Quick reply templates (5)',
      'Basic contact cards',
      'Schedule messages (3/day)',
      'Community support',
    ],
    cta: 'Get Started Free',
    ctaClass: 'btn btn-ghost btn-lg',
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/month',
    note: 'For power users & small teams',
    featured: true,
    badge: 'MOST POPULAR',
    features: [
      'Unlimited bulk messages',
      'AI smart replies (GPT-4)',
      'Unlimited templates & categories',
      'Advanced CRM & contact tags',
      'Analytics dashboard',
      'Priority chat support',
      'Export chat & contacts',
      'Team collaboration (3 seats)',
    ],
    cta: 'Start 7-Day Free Trial',
    ctaClass: 'btn btn-primary btn-lg',
  },
];

export default function Pricing() {
  return (
    <section className="pricing" id="pricing">
      <div className="section-label" style={{ justifyContent: 'center' }}>💎 Pricing</div>
      <h2 className="section-title">Simple, transparent pricing</h2>
      <p className="section-sub" style={{ margin: '0 auto' }}>
        Start free and upgrade when you need more power. No hidden fees, cancel anytime.
      </p>

      <div className="pricing-cards">
        {plans.map((plan, i) => (
          <div className={`pricing-card ${plan.featured ? 'featured' : ''}`} key={i}>
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
          </div>
        ))}
      </div>
    </section>
  );
}

