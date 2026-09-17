"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, ShieldCheck, X } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import {
  ConnectedRecordSection,
  DocumentWorkflow,
  FinalCTA,
  GroundedExplanationDemo,
  HeroLabTimeline,
  ImagingIntelligenceSection,
  ProductWorkspacePreview,
  ProvenanceSection,
  ResponsibleAISection,
  SupportingCapabilities,
  UnifiedTimelinePreview,
  VerificationDemo,
} from "./landing/sections";
import "./premium-landing.css";

function useReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>(".reveal");
    if (!nodes.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

export function PremiumLanding({ onStart }: { onStart?: (view?: string, action?: string) => void }) {
  useReveal();
  const [navOpen, setNavOpen] = useState(false);

  const handleStart = (targetView?: string, action?: string) => {
    setNavOpen(false);
    onStart?.(targetView, action);
  };

  const scrollTo = (id: string) => {
    setNavOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="premium-landing">
      <header className="landing-header">
        <button type="button" className="app-brand" onClick={() => handleStart()} aria-label="MediGuide home">
          <BrandLogo priority variant="wordmark" className="brand-logo-header" />
        </button>

        <nav className="landing-nav desktop-nav" aria-label="Primary">
          <button type="button" onClick={() => scrollTo("connected")}>
            Product
          </button>
          <button type="button" onClick={() => scrollTo("product")}>
            Labs
          </button>
          <button type="button" onClick={() => scrollTo("imaging")}>
            Imaging
          </button>
          <button type="button" onClick={() => scrollTo("how-it-works")}>
            How it works
          </button>
          <button type="button" onClick={() => scrollTo("responsible-ai")}>
            Responsible AI
          </button>
        </nav>

        <div className="header-actions desktop-nav">
          <button type="button" className="quiet-button" onClick={() => handleStart("documents", "sample")}>
            View demo
          </button>
          <button type="button" className="forest-button header-cta" onClick={() => handleStart("documents")}>
            Open workspace <ArrowUpRight size={15} />
          </button>
        </div>

        <button
          type="button"
          className="mobile-nav-toggle icon-button"
          aria-label={navOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          {navOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {navOpen ? (
        <div className="mobile-nav-panel" role="dialog" aria-label="Mobile navigation">
          <button type="button" onClick={() => scrollTo("connected")}>
            Product
          </button>
          <button type="button" onClick={() => scrollTo("product")}>
            Labs
          </button>
          <button type="button" onClick={() => scrollTo("imaging")}>
            Imaging
          </button>
          <button type="button" onClick={() => scrollTo("how-it-works")}>
            How it works
          </button>
          <button type="button" onClick={() => scrollTo("responsible-ai")}>
            Responsible AI
          </button>
          <button type="button" className="quiet-button" onClick={() => handleStart("documents", "sample")}>
            View demo
          </button>
          <button type="button" className="forest-button" onClick={() => handleStart("documents")}>
            Open workspace <ArrowUpRight size={15} />
          </button>
        </div>
      ) : null}

      <section className="premium-hero">
        <div className="premium-hero-copy reveal">
          <p className="eyebrow hero-trust-label">
            <span /> HEALTH DOCUMENT INTELLIGENCE
          </p>
          <h1>Turn health documents into information you can trace.</h1>
          <p>
            Upload a lab report and MediGuide transforms it into structured, verified information — with longitudinal
            lab timelines, educational explanations grounded in approved sources, and direct links back to the original
            report page.
          </p>
          <div className="hero-actions">
            <button type="button" className="forest-button" onClick={() => handleStart("documents", "sample")}>
              Try with synthetic lab data <ArrowUpRight size={17} />
            </button>
            <button type="button" className="quiet-button" onClick={() => handleStart("documents", "upload")}>
              Upload a lab report
            </button>
          </div>
          <ul className="hero-trust">
            <li>Document intelligence</li>
            <li>Human verified</li>
            <li>Source traceable</li>
            <li>Evidence supported</li>
          </ul>
        </div>
        <div className="hero-product-stage reveal reveal-delay">
          <HeroLabTimeline onStart={handleStart} />
        </div>
      </section>

      <ConnectedRecordSection />
      <ProductWorkspacePreview onStart={handleStart} />
      <DocumentWorkflow />
      <ImagingIntelligenceSection onStart={handleStart} />
      <VerificationDemo onStart={handleStart} />
      <UnifiedTimelinePreview onStart={handleStart} />
      <ProvenanceSection />
      <GroundedExplanationDemo onStart={handleStart} />
      <SupportingCapabilities onStart={handleStart} />
      <ResponsibleAISection onStart={handleStart} />
      <FinalCTA onStart={handleStart} />

      <footer className="landing-footer">
        <div className="footer-brand">
          {/* variant="full" already renders the tagline baked into the
              lockup image — a separate caption here just repeated it. */}
          <BrandLogo variant="full" className="brand-logo-footer" />
        </div>
        <nav aria-label="Footer">
          <button type="button" className="footer-link-btn" onClick={() => scrollTo("connected")}>
            Product
          </button>
          <button type="button" className="footer-link-btn" onClick={() => scrollTo("product")}>
            Labs
          </button>
          <button type="button" className="footer-link-btn" onClick={() => scrollTo("imaging")}>
            Imaging
          </button>
          <button type="button" className="footer-link-btn" onClick={() => handleStart("medication")}>
            Medications
          </button>
          <button type="button" className="footer-link-btn" onClick={() => handleStart("visit")}>
            Visit Preparation
          </button>
          <button type="button" className="footer-link-btn" onClick={() => handleStart("sources")}>
            Sources
          </button>
          <button type="button" className="footer-link-btn" onClick={() => scrollTo("privacy")}>
            Privacy
          </button>
        </nav>
        <p className="footer-disclaimer">
          <ShieldCheck size={14} /> Educational prototype. Not a diagnosis, prescription, or substitute for professional
          medical care. © 2026 MediGuide
        </p>
      </footer>
    </main>
  );
}
