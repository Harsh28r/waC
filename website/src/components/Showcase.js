import React from 'react';

export default function Showcase() {
  return (
    <section className="showcase">
      <div className="showcase-grid">
        <div className="showcase-visual">
          <div className="showcase-mockup">
            <div className="mockup-header">
              <div className="mockup-dot mockup-dot-red" />
              <div className="mockup-dot mockup-dot-yellow" />
              <div className="mockup-dot mockup-dot-green" />
            </div>
            <div className="mockup-body">
              <div className="mockup-chat">
                <div className="mockup-msg mockup-msg-out">
                  Hey {'{{name}}'}! 👋 Just wanted to share our exclusive offer with you...
                </div>
                <div className="mockup-msg mockup-msg-in">
                  Oh wow, that sounds amazing! Tell me more 🤩
                </div>
                <div className="mockup-msg mockup-msg-out">
                  Absolutely! Here's a personalized discount just for you: <b>SAVE20</b>
                </div>
                <div className="mockup-msg mockup-msg-in">
                  Perfect, I'll use it right now! Thanks so much 🙌
                </div>
              </div>
              <div style={{
                marginTop: 16,
                padding: '10px 14px',
                background: 'rgba(37, 211, 102, 0.08)',
                border: '1px solid rgba(37, 211, 102, 0.15)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: '#25D366'
              }}>
                <span>⚡</span>
                <span>4 messages sent • 100% delivered • 2 replies</span>
              </div>
            </div>
          </div>
        </div>

        <div className="showcase-text">
          <div className="section-label">📨 Bulk Messaging</div>
          <h2>Send thousands of<br />personalized messages</h2>
          <p>
            Import your contacts via CSV, use merge variables like {'{{name}}'}, {'{{company}}'}, 
            and {'{{offer}}'} to craft personal messages at scale. Smart throttling ensures 
            delivery without getting flagged.
          </p>
          <ul className="showcase-bullets">
            <li>
              <span className="bullet-check">✓</span>
              CSV import with auto-mapping
            </li>
            <li>
              <span className="bullet-check">✓</span>
              Personalization with merge variables
            </li>
            <li>
              <span className="bullet-check">✓</span>
              Smart delivery throttling & retry
            </li>
            <li>
              <span className="bullet-check">✓</span>
              Real-time delivery tracking
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

