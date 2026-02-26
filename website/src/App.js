import React, { useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import Showcase from './components/Showcase';
import Pricing from './components/Pricing';
import FAQ from './components/FAQ';
import CTA from './components/CTA';
import Footer from './components/Footer';
import './App.css';

function App() {
  const glowRef = useRef(null);

  useEffect(() => {
    // ── Cursor Glow Effect ──
    const glow = glowRef.current;
    let mouseX = 0, mouseY = 0, glowX = 0, glowY = 0;

    const onMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const animate = () => {
      glowX += (mouseX - glowX) * 0.08;
      glowY += (mouseY - glowY) * 0.08;
      if (glow) {
        glow.style.left = glowX + 'px';
        glow.style.top = glowY + 'px';
      }
      requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMove);
    animate();

    // ── Scroll Reveal ──
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible');
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

    return () => {
      window.removeEventListener('mousemove', onMove);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="App">
      {/* Cursor glow that follows mouse */}
      <div className="glow-cursor" ref={glowRef} />

      <Navbar />
      <Hero />
      <Features />
      <Showcase />
      <HowItWorks />
      <FAQ />
      <CTA />
      <Pricing />
      <Footer />
    </div>
  );
}

export default App;
