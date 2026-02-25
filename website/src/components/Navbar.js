import React, { useState, useEffect } from 'react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-inner">
        <a href="#top" className="nav-logo">
          <div className="nav-logo-icon">⚡</div>
          <div className="nav-logo-text">WA <span>Bulk AI</span></div>
        </a>

        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#how-it-works">How It Works</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>

        <div className="nav-cta">
          <a href="#pricing" className="btn btn-ghost">View Plans</a>
          <a href="https://chrome.google.com/webstore" className="btn btn-primary" target="_blank" rel="noreferrer">
            Install Free →
          </a>
        </div>
      </div>
    </nav>
  );
}

