import React from 'react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <a href="#top" className="nav-logo">
            <div className="nav-logo-icon">⚡</div>
            <div className="nav-logo-text">WA <span>Bulk AI</span></div>
          </a>
          <p>
            The all-in-one Chrome extension for WhatsApp Web. 
            Bulk messages, AI replies, scheduling, CRM and more.
          </p>
        </div>

        <div className="footer-col">
          <h4>Product</h4>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <a href="https://chrome.google.com/webstore" target="_blank" rel="noreferrer">Chrome Store</a>
        </div>

        <div className="footer-col">
          <h4>Resources</h4>
          <a href="#faq">Documentation</a>
          <a href="#faq">Tutorials</a>
          <a href="#faq">Blog</a>
          <a href="#faq">Changelog</a>
        </div>

        <div className="footer-col">
          <h4>Legal</h4>
          <a href="#faq">Privacy Policy</a>
          <a href="#faq">Terms of Service</a>
          <a href="#faq">Cookie Policy</a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 WA Bulk AI. All rights reserved.</span>
        <span>Made with 💚 for WhatsApp power users</span>
      </div>
    </footer>
  );
}

