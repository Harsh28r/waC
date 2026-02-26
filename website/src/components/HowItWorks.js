import React from 'react';

/* ── Cartoon step illustrations ── */
const StepInstall = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Browser window */}
    <rect x="8" y="12" width="64" height="52" rx="8" fill="#fff" stroke="#e2e8f0" strokeWidth="2"/>
    <rect x="8" y="12" width="64" height="14" rx="8" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="2"/>
    <circle cx="18" cy="19" r="3" fill="#ff5f57"/>
    <circle cx="27" cy="19" r="3" fill="#ffbd2e"/>
    <circle cx="36" cy="19" r="3" fill="#28c840"/>
    {/* Download arrow */}
    <rect x="30" y="36" width="20" height="3" rx="1.5" fill="#25D366"/>
    <path d="M34 42 L40 50 L46 42" fill="#25D366"/>
    <rect x="38" y="32" width="4" height="14" rx="2" fill="#25D366"/>
    {/* Chrome logo hint */}
    <circle cx="58" cy="19" r="4" fill="#4285f4" opacity="0.6"/>
    {/* Sparkles */}
    <circle cx="20" cy="48" r="2" fill="#fbbf24" opacity="0.5"/>
    <circle cx="62" cy="42" r="1.5" fill="#a78bfa" opacity="0.5"/>
  </svg>
);

const StepWhatsApp = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Phone outline */}
    <rect x="20" y="6" width="40" height="68" rx="10" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
    <rect x="24" y="16" width="32" height="48" rx="2" fill="#efeae2"/>
    {/* WA header */}
    <rect x="24" y="16" width="32" height="10" fill="#075e54"/>
    {/* Chat bubbles */}
    <rect x="34" y="30" width="18" height="8" rx="4" fill="#d9fdd3"/>
    <rect x="28" y="42" width="16" height="8" rx="4" fill="#fff"/>
    <rect x="36" y="52" width="16" height="8" rx="4" fill="#d9fdd3"/>
    {/* Notch */}
    <rect x="33" y="9" width="14" height="3" rx="1.5" fill="#475569"/>
    {/* Home button */}
    <rect x="35" y="67" width="10" height="2" rx="1" fill="#475569"/>
    {/* Green glow */}
    <circle cx="40" cy="40" r="30" fill="#25D366" opacity="0.05"/>
    {/* Sparkle */}
    <circle cx="14" cy="20" r="2" fill="#25D366" opacity="0.4"/>
    <circle cx="66" cy="54" r="1.5" fill="#25D366" opacity="0.4"/>
  </svg>
);

const StepImport = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* File/CSV icon */}
    <rect x="16" y="8" width="36" height="48" rx="4" fill="#fff" stroke="#e2e8f0" strokeWidth="2"/>
    <path d="M40 8 L52 20 L40 20 Z" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5"/>
    {/* CSV lines */}
    <rect x="22" y="28" width="10" height="3" rx="1.5" fill="#25D366" opacity="0.3"/>
    <rect x="34" y="28" width="12" height="3" rx="1.5" fill="#3b82f6" opacity="0.3"/>
    <rect x="22" y="34" width="10" height="3" rx="1.5" fill="#25D366" opacity="0.3"/>
    <rect x="34" y="34" width="12" height="3" rx="1.5" fill="#3b82f6" opacity="0.3"/>
    <rect x="22" y="40" width="10" height="3" rx="1.5" fill="#25D366" opacity="0.3"/>
    <rect x="34" y="40" width="12" height="3" rx="1.5" fill="#3b82f6" opacity="0.3"/>
    <rect x="22" y="46" width="10" height="3" rx="1.5" fill="#25D366" opacity="0.3"/>
    <rect x="34" y="46" width="12" height="3" rx="1.5" fill="#3b82f6" opacity="0.3"/>
    {/* People icons going in */}
    <circle cx="60" cy="28" r="6" fill="#e8fbef" stroke="#25D366" strokeWidth="1.5"/>
    <circle cx="60" cy="26" r="2.5" fill="#25D366" opacity="0.4"/>
    <circle cx="66" cy="44" r="5" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5"/>
    <circle cx="66" cy="42.5" r="2" fill="#3b82f6" opacity="0.4"/>
    {/* Arrow */}
    <path d="M56 36 L48 36" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" markerEnd="url(#arr)"/>
    <circle cx="18" cy="66" r="2" fill="#fbbf24" opacity="0.4"/>
  </svg>
);

const StepSend = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Rocket */}
    <path d="M40 10 C40 10 26 26 26 44 L54 44 C54 26 40 10 40 10Z" fill="#25D366"/>
    <path d="M40 10 C40 10 32 22 30 34 L50 34 C48 22 40 10 40 10Z" fill="#4ade80"/>
    <circle cx="40" cy="28" r="5" fill="#fff"/>
    <circle cx="40" cy="28" r="3" fill="#dbeafe"/>
    {/* Fins */}
    <path d="M26 38 L16 50 L26 44Z" fill="#f59e0b"/>
    <path d="M54 38 L64 50 L54 44Z" fill="#f59e0b"/>
    {/* Exhaust */}
    <path d="M32 44 L30 58 L40 50 L50 58 L48 44Z" fill="#ef4444" opacity="0.6"/>
    <path d="M34 44 L33 54 L40 48 L47 54 L46 44Z" fill="#fbbf24"/>
    {/* Stars/sparkles */}
    <circle cx="14" cy="18" r="2" fill="#fbbf24" opacity="0.6"/>
    <circle cx="68" cy="14" r="1.5" fill="#fbbf24" opacity="0.6"/>
    <circle cx="10" cy="44" r="1.5" fill="#a78bfa" opacity="0.5"/>
    <circle cx="70" cy="38" r="2" fill="#a78bfa" opacity="0.5"/>
    {/* Speed lines */}
    <line x1="18" y1="56" x2="28" y2="52" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    <line x1="52" y1="52" x2="62" y2="56" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    {/* Chart line at bottom */}
    <path d="M12 68 L24 62 L36 66 L48 58 L60 64 L68 56" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
  </svg>
);

const steps = [
  {
    illustration: <StepInstall />,
    title: 'Install Extension',
    desc: 'Add WA Bulk AI from the Chrome Web Store in one click. No signup needed.',
  },
  {
    illustration: <StepWhatsApp />,
    title: 'Open WhatsApp Web',
    desc: 'Head to web.whatsapp.com. The extension activates automatically.',
  },
  {
    illustration: <StepImport />,
    title: 'Import Contacts',
    desc: 'Upload a CSV or select contacts directly from your chat list.',
  },
  {
    illustration: <StepSend />,
    title: 'Send & Track',
    desc: 'Compose your message, hit send, and watch real-time analytics roll in.',
  },
];

export default function HowItWorks() {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="text-center">
        <div className="section-label" style={{ justifyContent: 'center', margin: '0 auto 14px' }}>🛠 How It Works</div>
        <h2 className="section-title" style={{ margin: '0 auto 16px', textAlign: 'center' }}>
          Up and running in<br />under 2 minutes
        </h2>
        <p className="section-sub" style={{ margin: '0 auto', textAlign: 'center' }}>
          No complicated setup, no API keys, no coding — just install and go.
        </p>
      </div>

      <div className="steps-grid">
        <div className="steps-line" />
        {steps.map((s, i) => (
          <div className="step-card" key={i}>
            <div className="step-illustration">
              {s.illustration}
            </div>
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
