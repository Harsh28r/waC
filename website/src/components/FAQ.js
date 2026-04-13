import React, { useState } from 'react';

const faqs = [
  {
    q: 'Is WA Bulk AI safe to use?',
    a: 'Absolutely. We run entirely inside your browser — no data ever leaves your device. Messages are sent through your own WhatsApp Web session, just like manual typing, but automated.',
  },
  {
    q: 'Will my WhatsApp account get banned?',
    a: "We use smart throttling, random delays, and human-like sending patterns to minimize any risk. Thousands of users rely on our extension daily without issues. We also recommend following WhatsApp\u2019s usage guidelines.",
  },
  {
    q: 'Do I need an API key or WhatsApp Business API?',
    a: 'No! WA Bulk AI works directly with WhatsApp Web (web.whatsapp.com). No API keys, no business API setup, no developer account needed.',
  },
  {
    q: 'How does the AI reply feature work?',
    a: 'You connect Gemini or Claude with your own API key. The extension sends recent chat context to that provider and drafts a reply you can send or tweak — nothing is routed through our servers.',
  },
  {
    q: 'Is WA Bulk AI really free? Any hidden fees?',
    a: 'The Chrome extension is completely free — no subscription and no in-app upgrade. Optional AI features use your own API keys; Google Gemini offers a free tier at AI Studio, and other providers bill you directly only if you use them.',
  },
  {
    q: 'Does it work with WhatsApp groups?',
    a: 'Yes! You can send messages to individual contacts and groups. Bulk send to multiple groups, schedule group messages, and use quick replies in group chats.',
  },
];

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section className="faq" id="faq">
      <div className="text-center">
        <div className="section-label" style={{ justifyContent: 'center', margin: '0 auto 14px' }}>FAQ</div>
        <h2 className="section-title">Frequently asked questions</h2>
        <p className="section-sub" style={{ margin: '0 auto' }}>
          Got questions? We&apos;ve got answers. Can&apos;t find what you need? Reach out to us.
        </p>
      </div>

      <div className="faq-list">
        {faqs.map((f, i) => (
          <div className={`faq-item ${openIdx === i ? 'open' : ''}`} key={i}>
            <button className="faq-q" onClick={() => setOpenIdx(openIdx === i ? -1 : i)}>
              {f.q}
              <span className="faq-arrow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
            </button>
            <div className="faq-a">{f.a}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
