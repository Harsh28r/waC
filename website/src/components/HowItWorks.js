import React from 'react';

const steps = [
  {
    num: 1,
    title: 'Install Extension',
    desc: 'Add WA Bulk AI from the Chrome Web Store in one click. No signup needed.',
  },
  {
    num: 2,
    title: 'Open WhatsApp Web',
    desc: 'Head to web.whatsapp.com. The extension activates automatically.',
  },
  {
    num: 3,
    title: 'Import Contacts',
    desc: 'Upload a CSV or select contacts directly from your chat list.',
  },
  {
    num: 4,
    title: 'Send & Track',
    desc: 'Compose your message, hit send, and watch real-time analytics roll in.',
  },
];

export default function HowItWorks() {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="text-center">
        <div className="section-label" style={{ justifyContent: 'center' }}>🛠 How It Works</div>
        <h2 className="section-title" style={{ margin: '0 auto 16px' }}>
          Up and running in<br />under 2 minutes
        </h2>
        <p className="section-sub" style={{ margin: '0 auto' }}>
          No complicated setup, no API keys, no coding — just install and go.
        </p>
      </div>

      <div className="steps-grid">
        {steps.map((s, i) => (
          <div className="step-card" key={i}>
            <div className="step-num">{s.num}</div>
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
            {i < steps.length - 1 && <span className="step-arrow">→</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

