import React from 'react';

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-bg">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="hero-grid" />
      </div>

      <div className="hero-content">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Chrome Extension — Trusted by 10,000+ users
        </div>

        <h1>
          Supercharge Your<br />
          <span className="gradient-text">WhatsApp Business</span>
        </h1>

        <p className="hero-sub">
          Bulk messaging, AI-powered replies, scheduled sends, quick templates, 
          contact cards & CRM — all inside WhatsApp Web.
        </p>

        <div className="hero-actions">
          <a href="https://chrome.google.com/webstore" className="btn btn-primary btn-xl" target="_blank" rel="noreferrer">
            ⚡ Add to Chrome — It's Free
          </a>
          <a href="#features" className="btn btn-ghost btn-lg">
            See Features
          </a>
        </div>

        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-num">10K+</div>
            <div className="hero-stat-label">Active Users</div>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <div className="hero-stat-num">5M+</div>
            <div className="hero-stat-label">Messages Sent</div>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <div className="hero-stat-num">4.9★</div>
            <div className="hero-stat-label">Chrome Store</div>
          </div>
        </div>
      </div>
    </section>
  );
}

