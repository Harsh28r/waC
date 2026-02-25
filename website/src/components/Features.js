import React, { useEffect, useRef } from 'react';

const features = [
  {
    icon: '🚀',
    color: 'fi-green',
    title: 'Bulk Messaging',
    desc: 'Send personalized messages to thousands of contacts simultaneously. CSV import, variable merge, and smart throttling.',
    tag: ['NEW', 'tag-new'],
  },
  {
    icon: '🤖',
    color: 'fi-purple',
    title: 'AI Smart Replies',
    desc: 'GPT-powered auto-responses that understand context, sentiment, and language. Train on your business FAQ.',
    tag: ['AI', 'tag-ai'],
  },
  {
    icon: '⏰',
    color: 'fi-blue',
    title: 'Schedule Messages',
    desc: 'Plan campaigns hours, days, or weeks ahead. Set timezone-aware delivery windows for maximum engagement.',
    tag: null,
  },
  {
    icon: '💬',
    color: 'fi-cyan',
    title: 'Quick Reply Templates',
    desc: 'One-click saved responses with rich text, emojis, and variable placeholders. Organize by category.',
    tag: null,
  },
  {
    icon: '📇',
    color: 'fi-orange',
    title: 'Contact Cards & CRM',
    desc: 'Rich contact profiles, tags, notes, and deal tracking. Export contacts and chat history anytime.',
    tag: ['PRO', 'tag-pro'],
  },
  {
    icon: '📊',
    color: 'fi-pink',
    title: 'Analytics Dashboard',
    desc: 'Track delivery rates, response times, and engagement metrics. Beautiful charts and exportable reports.',
    tag: null,
  },
];

export default function Features() {
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    const cards = ref.current?.querySelectorAll('.feature-card');
    cards?.forEach((c) => observer.observe(c));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="features" id="features" ref={ref}>
      <div className="section-label">⚡ Features</div>
      <h2 className="section-title">Everything you need to<br />scale WhatsApp outreach</h2>
      <p className="section-sub">
        A complete toolkit designed for marketers, sales teams, and customer support — no API keys required.
      </p>

      <div className="features-grid">
        {features.map((f, i) => (
          <div className="feature-card reveal" key={i} style={{ transitionDelay: `${i * 0.08}s` }}>
            <div className={`feature-icon ${f.color}`}>{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
            {f.tag && <span className={`feature-tag ${f.tag[1]}`}>{f.tag[0]}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

