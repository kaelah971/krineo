"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";

export function SiteHeader({
  active,
  context = "marketing",
}: {
  active: "home" | "workspace" | "playbooks" | "theses" | "receipts" | "practice" | "demo";
  context?: "marketing" | "workspace" | "demo";
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const primaryLinks = context === "marketing"
    ? [
        ["Home", "/", "home"],
        ["Workspace", "/workspace", "workspace"],
        ["Demo", "/demo", "demo"],
      ] as const
    : [
        ["Home", "/", "home"],
        ["Workspace", "/workspace", "workspace"],
        ["Playbooks", "/playbooks", "playbooks"],
        ["Theses", "/theses", "theses"],
        ["Receipts", "/receipts", "receipts"],
        ["Practice", "/practice", "practice"],
        ["Demo", "/demo", "demo"],
      ] as const;

  return (
    <header className="topbar">
      <Link className="brand-lockup" href="/" aria-label="Krineo home">
        <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
        <span className="brand-name">KRINEO</span>
        <span className="brand-beta">ALPHA</span>
      </Link>
      <nav id="primary-navigation" className={`topnav ${menuOpen ? "topnav-open" : ""}`} aria-label="Primary navigation">
        {primaryLinks.map(([label, href, key]) => <Link className={active === key ? "topnav-active" : undefined} href={href} key={key} onClick={() => setMenuOpen(false)}>{label}</Link>)}
      </nav>
      {context === "demo" ? (
        <div className="topbar-meta">
          <span className="fixture-dot" />
          <span>DEMO FIXTURE</span>
          <span className="avatar" aria-label="Demo agent">A</span>
        </div>
      ) : context === "marketing" ? (
        <div className="topbar-actions">
          <Link className="button button-dark topbar-cta" href="/workspace">Open workspace</Link>
        </div>
      ) : (
        <div className="topbar-meta topbar-local-meta">
          <span className="fixture-dot" />
          <span>LOCAL WORKSPACE</span>
          <span className="avatar" aria-label="Local workspace">L</span>
          <ChevronDown size={13} aria-hidden="true" />
        </div>
      )}
      <button
        className="mobile-menu-toggle"
        type="button"
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
      </button>
    </header>
  );
}
