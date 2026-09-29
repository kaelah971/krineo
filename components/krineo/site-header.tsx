import Link from "next/link";
import { Menu } from "lucide-react";

export function SiteHeader({
  active,
  showFixtureMeta = false,
}: {
  active: "home" | "workspace";
  showFixtureMeta?: boolean;
}) {
  return (
    <header className="topbar">
      <Link className="brand-lockup" href="/" aria-label="Krineo home">
        <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
        <span className="brand-name">KRINEO</span>
        <span className="brand-beta">ALPHA</span>
      </Link>
      <nav className="topnav" aria-label="Primary navigation">
        <Link className={active === "home" ? "topnav-active" : undefined} href="/">Home</Link>
        <Link className={active === "workspace" ? "topnav-active" : undefined} href="/workspace">Workspace</Link>
      </nav>
      {showFixtureMeta ? (
        <div className="topbar-meta">
          <span className="fixture-dot" />
          <span>DEMO FIXTURE</span>
          <span className="avatar" aria-label="Demo agent">A</span>
        </div>
      ) : (
        <div className="topbar-actions">
          <Link className="button button-dark topbar-cta" href="/workspace">Open workspace</Link>
        </div>
      )}
      <span className="mobile-menu-icon" aria-hidden="true"><Menu size={19} /></span>
    </header>
  );
}
