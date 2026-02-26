import React, { useEffect, useRef } from 'react';

/* ── Cartoon SVG illustrations per feature ── */
const IllustrationBulk = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="8" width="28" height="20" rx="4" fill="#25D366" opacity="0.15"/>
    <rect x="6" y="10" width="24" height="16" rx="3" fill="#e8fbef"/>
    <path d="M8 14h20M8 18h14M8 22h18" stroke="#25D366" strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="16" y="20" width="28" height="20" rx="4" fill="#25D366" opacity="0.2"/>
    <rect x="18" y="22" width="24" height="16" rx="3" fill="#d1fae5"/>
    <path d="M20 26h20M20 30h14M20 34h18" stroke="#25D366" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="40" cy="12" r="6" fill="#25D366"/>
    <text x="40" y="15" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" fontFamily="sans-serif">✓</text>
  </svg>
);

const IllustrationAI = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="12" width="32" height="26" rx="8" fill="#7c3aed" opacity="0.12"/>
    <circle cx="20" cy="24" r="3" fill="#7c3aed"/>
    <circle cx="28" cy="24" r="3" fill="#7c3aed"/>
    <path d="M19 30 Q24 34 29 30" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <line x1="24" y1="12" x2="24" y2="6" stroke="#a78bfa" strokeWidth="2"/>
    <circle cx="24" cy="5" r="3" fill="#a78bfa"/>
    <circle cx="10" cy="8" r="1.5" fill="#c4b5fd" opacity="0.6"/>
    <circle cx="38" cy="10" r="2" fill="#c4b5fd" opacity="0.6"/>
    <circle cx="42" cy="32" r="1.5" fill="#c4b5fd" opacity="0.6"/>
    <path d="M6 18l3 2-3 2" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M42 18l-3 2 3 2" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IllustrationClock = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="18" fill="#3b82f6" opacity="0.1"/>
    <circle cx="24" cy="24" r="14" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2"/>
    <line x1="24" y1="24" x2="24" y2="16" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="24" y1="24" x2="30" y2="28" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="24" cy="24" r="2" fill="#3b82f6"/>
    {/* Bell decoration */}
    <path d="M36 8 L38 6 L40 8" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="38" cy="5" r="1" fill="#60a5fa"/>
    <circle cx="10" cy="38" r="2" fill="#93c5fd" opacity="0.5"/>
  </svg>
);

const IllustrationChat = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="6" width="30" height="22" rx="6" fill="#06b6d4" opacity="0.12"/>
    <rect x="6" y="8" width="26" height="18" rx="5" fill="#cffafe"/>
    <path d="M10 14h18M10 18h12M10 22h16" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 26l6 6v-6" fill="#cffafe"/>
    <rect x="22" y="18" width="22" height="16" rx="5" fill="#06b6d4" opacity="0.2"/>
    <rect x="24" y="20" width="18" height="12" rx="4" fill="#a5f3fc"/>
    <path d="M28 24h10M28 28h6" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="40" cy="10" r="4" fill="#06b6d4" opacity="0.2"/>
    <text x="40" y="13" textAnchor="middle" fill="#06b6d4" fontSize="6" fontWeight="700" fontFamily="sans-serif">⚡</text>
  </svg>
);

const IllustrationCRM = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="8" width="36" height="32" rx="6" fill="#f59e0b" opacity="0.1"/>
    <circle cx="18" cy="18" r="6" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5"/>
    <circle cx="18" cy="16" r="2.5" fill="#f59e0b" opacity="0.4"/>
    <path d="M12 28 Q18 24 24 28" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5"/>
    <circle cx="34" cy="16" r="5" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5"/>
    <circle cx="34" cy="14.5" r="2" fill="#f59e0b" opacity="0.4"/>
    <path d="M29 24 Q34 21 39 24" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5"/>
    <rect x="10" y="32" width="28" height="4" rx="2" fill="#fde68a"/>
    <rect x="10" y="32" width="18" height="4" rx="2" fill="#f59e0b" opacity="0.3"/>
  </svg>
);

const IllustrationChart = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="36" height="36" rx="6" fill="#ec4899" opacity="0.08"/>
    <rect x="10" y="28" width="6" height="12" rx="2" fill="#fce7f3" stroke="#ec4899" strokeWidth="1"/>
    <rect x="18" y="20" width="6" height="20" rx="2" fill="#fce7f3" stroke="#ec4899" strokeWidth="1"/>
    <rect x="26" y="14" width="6" height="26" rx="2" fill="#fbcfe8" stroke="#ec4899" strokeWidth="1"/>
    <rect x="34" y="22" width="6" height="18" rx="2" fill="#fce7f3" stroke="#ec4899" strokeWidth="1"/>
    <path d="M10 28 L18 20 L26 14 L34 22" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3"/>
    <circle cx="10" cy="28" r="2.5" fill="#ec4899"/>
    <circle cx="18" cy="20" r="2.5" fill="#ec4899"/>
    <circle cx="26" cy="14" r="2.5" fill="#ec4899"/>
    <circle cx="34" cy="22" r="2.5" fill="#ec4899"/>
  </svg>
);

const features = [
  {
    illustration: <IllustrationBulk />,
    color: 'fi-green',
    title: 'Bulk Messaging',
    desc: 'Send personalized messages to thousands of contacts simultaneously. CSV import, variable merge, and smart throttling.',
    tag: ['NEW', 'tag-new'],
  },
  {
    illustration: <IllustrationAI />,
    color: 'fi-purple',
    title: 'AI Smart Replies',
    desc: 'GPT-powered auto-responses that understand context, sentiment, and language. Train on your business FAQ.',
    tag: ['AI', 'tag-ai'],
  },
  {
    illustration: <IllustrationClock />,
    color: 'fi-blue',
    title: 'Schedule Messages',
    desc: 'Plan campaigns hours, days, or weeks ahead. Set timezone-aware delivery windows for maximum engagement.',
    tag: null,
  },
  {
    illustration: <IllustrationChat />,
    color: 'fi-cyan',
    title: 'Quick Reply Templates',
    desc: 'One-click saved responses with rich text, emojis, and variable placeholders. Organize by category.',
    tag: null,
  },
  {
    illustration: <IllustrationCRM />,
    color: 'fi-orange',
    title: 'Contact Cards & CRM',
    desc: 'Rich contact profiles, tags, notes, and deal tracking. Export contacts and chat history anytime.',
    tag: ['PRO', 'tag-pro'],
  },
  {
    illustration: <IllustrationChart />,
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
      {/* Decorative blobs */}
      <div className="features-deco features-deco-1" />
      <div className="features-deco features-deco-2" />

      <div className="section-label">✨ Features</div>
      <h2 className="section-title">Everything you need to<br />scale WhatsApp outreach</h2>
      <p className="section-sub">
        A complete toolkit designed for marketers, sales teams, and customer support — no API keys required.
      </p>

      <div className="features-grid">
        {features.map((f, i) => (
          <div className="feature-card reveal" key={i} style={{ transitionDelay: `${i * 0.08}s` }}>
            <div className="feature-illustration">
              {f.illustration}
            </div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
            {f.tag && <span className={`feature-tag ${f.tag[1]}`}>{f.tag[0]}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
