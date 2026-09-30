import Link from "next/link";
import { ChevronDown, Menu } from "lucide-react";

export function SiteHeader({
  active,
  context = "marketing",
}: {
  active: "home" | "workspace" | "playbooks" | "theses" | "receipts" | "practice" | "demo";
  context?: "marketing" | "workspace" | "demo";
}) {
  const primaryLinks = context === "workspace"
    ? [
        ["Home", "/", "home"],
        ["Workspace", "/workspace", "workspace"],
        ["Playbooks", "/playbooks", "playbooks"],
        ["Theses", "/theses", "theses"],
        ["Receipts", "/receipts", "receipts"],
        ["Practice", "/practice", "practice"],
        ["Demo", "/demo", "demo"],
      ] as const
    : [
        ["Home", "/", "home"],
        ["Workspace", "/workspace", "workspace"],
        ["Demo", "/demo", "demo"],
      ] as const;

  return (
    <header className="topbar">
      <Link className="brand-lockup" href="/" aria-label="Krineo home">
        <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
        <span className="brand-name">KRINEO</span>
        <span className="brand-beta">ALPHA</span>
      </Link>
      <nav className="topnav" aria-label="Primary navigation">
        {primaryLinks.map(([label, href, key]) => <Link className={active === key ? "topnav-active" : undefined} href={href} key={key}>{label}</Link>)}
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
      <span className="mobile-menu-icon" aria-hidden="true"><Menu size={19} /></span>
    </header>
  );
}
