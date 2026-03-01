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

const IllustrationBot = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="8" width="28" height="24" rx="6" fill="#25D366" opacity="0.15"/>
    <rect x="12" y="10" width="24" height="20" rx="5" fill="#d1fae5"/>
    <circle cx="20" cy="18" r="2.5" fill="#25D366"/>
    <circle cx="28" cy="18" r="2.5" fill="#25D366"/>
    <path d="M18 26 Q24 30 30 26" stroke="#25D366" strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="20" y="34" width="8" height="4" rx="2" fill="#25D366" opacity="0.3"/>
    <path d="M8 20 L4 20 M44 20 L40 20" stroke="#25D366" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const IllustrationDrip = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="4" fill="#8b5cf6" opacity="0.2"/>
    <path d="M12 20 L12 36 L24 42 L36 36 L36 20 L24 14 L12 20Z" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1.5"/>
    <circle cx="24" cy="28" r="3" fill="#8b5cf6"/>
    <path d="M12 20 L24 28 L36 20" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="2 2"/>
    <path d="M24 14 L24 28" stroke="#a78bfa" strokeWidth="1"/>
  </svg>
);

const IllustrationIntegrations = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="10" width="16" height="12" rx="3" fill="#0ea5e9" opacity="0.15"/>
    <rect x="8" y="12" width="12" height="8" rx="2" fill="#e0f2fe"/>
    <circle cx="14" cy="16" r="2" fill="#0ea5e9"/>
    <rect x="26" y="10" width="16" height="12" rx="3" fill="#10b981" opacity="0.15"/>
    <rect x="28" y="12" width="12" height="8" rx="2" fill="#d1fae5"/>
    <path d="M24 16 L26 16" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
    <rect x="10" y="28" width="28" height="8" rx="3" fill="#f59e0b" opacity="0.12"/>
    <rect x="12" y="30" width="24" height="4" rx="2" fill="#fef3c7"/>
    <path d="M18 32 L30 32" stroke="#f59e0b" strokeWidth="1"/>
  </svg>
);

const IllustrationPrivacy = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="14" fill="#f43f5e" opacity="0.12"/>
    <path d="M24 14 L24 24 L30 28" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="24" cy="24" r="3" fill="#f43f5e"/>
    <rect x="10" y="8" width="12" height="8" rx="2" fill="#fecdd3" opacity="0.8"/>
    <rect x="26" y="8" width="12" height="8" rx="2" fill="#fecdd3" opacity="0.8"/>
    <rect x="18" y="34" width="12" height="6" rx="2" fill="#f43f5e" opacity="0.2"/>
    <text x="24" y="38" textAnchor="middle" fill="#f43f5e" fontSize="8" fontWeight="700" fontFamily="sans-serif">ON</text>
  </svg>
);

const IllustrationTranslator = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="14" fill="#14b8a6" opacity="0.12"/>
    <rect x="10" y="12" width="14" height="10" rx="2" fill="#ccfbf1" stroke="#14b8a6" strokeWidth="1.5"/>
    <path d="M12 16h10M12 20h8" stroke="#14b8a6" strokeWidth="1.2" strokeLinecap="round"/>
    <rect x="24" y="12" width="14" height="10" rx="2" fill="#99f6e4" stroke="#0d9488" strokeWidth="1.5"/>
    <path d="M26 16h10M26 20h8" stroke="#0d9488" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M22 22 L26 22" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="24" cy="28" r="4" fill="#14b8a6" opacity="0.2"/>
    <text x="24" y="31" textAnchor="middle" fill="#0d9488" fontSize="10" fontWeight="700" fontFamily="sans-serif">A→あ</text>
  </svg>
);

const IllustrationTasks = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="6" width="32" height="36" rx="6" fill="#6366f1" opacity="0.12"/>
    <rect x="12" y="10" width="24" height="6" rx="2" fill="#e0e7ff" stroke="#6366f1" strokeWidth="1"/>
    <circle cx="15" cy="13" r="1.5" fill="#6366f1"/>
    <rect x="12" y="20" width="24" height="6" rx="2" fill="#e0e7ff" stroke="#6366f1" strokeWidth="1"/>
    <circle cx="15" cy="23" r="1.5" fill="#6366f1"/>
    <rect x="12" y="30" width="20" height="6" rx="2" fill="#c7d2fe" stroke="#6366f1" strokeWidth="1"/>
    <circle cx="15" cy="33" r="1.5" fill="#4f46e5"/>
    <path d="M20 33 L22 35 L26 31" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="38" cy="10" r="6" fill="#f59e0b"/>
    <path d="M38 8 L38 10 L40 10" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="38" cy="10" r="2" fill="#fff" opacity="0.9"/>
  </svg>
);

const features = [
  {
    illustration: <IllustrationBulk />,
    color: 'fi-green',
    title: 'Bulk Messaging',
    desc: 'Send personalized messages to thousands of contacts. CSV import, variable merge {name}, A/B testing, and smart throttling.',
    tag: ['FREE', 'tag-new'],
  },
  {
    illustration: <IllustrationAI />,
    color: 'fi-purple',
    title: 'AI Smart Replies',
    desc: 'Gemini or Claude: context-aware auto-reply, chat history understanding, keyword + no-keyword replies. Never repeat the same line.',
    tag: ['PRO', 'tag-ai'],
  },
  {
    illustration: <IllustrationBot />,
    color: 'fi-green',
    title: 'Auto Reply Bot',
    desc: 'Template or AI mode. Per-chat (all conversations), keyword filter, "when no keyword" reply, business hours & outside-hours message.',
    tag: null,
  },
  {
    illustration: <IllustrationClock />,
    color: 'fi-blue',
    title: 'Schedule & Campaigns',
    desc: 'Schedule campaigns for later. Campaign dashboard, quick sender, multi-number blast. Template library.',
    tag: null,
  },
  {
    illustration: <IllustrationChat />,
    color: 'fi-cyan',
    title: 'Quick Reply & Scan',
    desc: 'One-click templates with variables. AI Reply Handler: scan contacts for replies and get AI-suggested responses.',
    tag: null,
  },
  {
    illustration: <IllustrationDrip />,
    color: 'fi-purple',
    title: 'Drip Campaigns',
    desc: 'Multi-step sequences with delays. Enroll contacts, auto-send follow-ups. Saved sequences and active enrollments.',
    tag: ['PRO', 'tag-pro'],
  },
  {
    illustration: <IllustrationCRM />,
    color: 'fi-orange',
    title: 'Contacts, Segments & CRM',
    desc: 'Contact cards, segments, labels. Google Sheets import. Pipeline funnel. Export contacts and notes.',
    tag: ['PRO', 'tag-pro'],
  },
  {
    illustration: <IllustrationChart />,
    color: 'fi-pink',
    title: 'Analytics & Reports',
    desc: '7-day activity, pipeline funnel, campaign history. Custom HTML/PDF report. Daily business digest.',
    tag: null,
  },
  {
    illustration: <IllustrationPrivacy />,
    color: 'fi-pink',
    title: 'Blur Privacy Mode',
    desc: 'Blur chat list, message bubbles, header & profile pics so no one over your shoulder can read. Hover to reveal. Optional auto-on at start.',
    tag: ['FREE', 'tag-new'],
  },
  {
    illustration: <IllustrationIntegrations />,
    color: 'fi-blue',
    title: 'Settings & Integrations',
    desc: 'Stealth mode, auto privacy (blur), business hours, birthday auto-sender. Webhook/Zapier, link tracker, DNC list.',
    tag: null,
  },
  {
    illustration: <IllustrationTranslator />,
    color: 'fi-cyan',
    title: 'Language Translator',
    desc: 'Translate messages on the fly. Send in the recipient\'s language — supports multiple languages so your outreach reaches everyone.',
    tag: null,
  },
  {
    illustration: <IllustrationTasks />,
    color: 'fi-purple',
    title: 'Task Management & Notifications',
    desc: 'Tasks tab in the extension: Today, Tomorrow, Later, Done. Set reminder times and get browser notifications when a task is due.',
    tag: ['FREE', 'tag-new'],
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
