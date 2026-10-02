import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, GitBranch, ShieldCheck } from "lucide-react";
import { PhoneFrame } from "./phone-frame";
import { TradingScreen, screenDescriptions } from "./trading-screen";
import { StoryScreen, storyScreenDescriptions, type StoryScreenVariant } from "./story-screen";
import { StoryReveal } from "./story-reveal";
import styles from "./landing.module.css";

function MarketingHeader() {
  return <header className={styles.header}>
    <Link className={styles.brand} href="/" aria-label="Krineo home"><span className={styles.brandMark} aria-hidden="true"><i /><i /><i /></span>krineo<span className={styles.alpha}>ALPHA</span></Link>
    <nav className={styles.nav} aria-label="Marketing navigation"><a href="#how-it-works">How it works</a><Link href="/demo">Golden Demo</Link></nav>
    <Link className={styles.headerCta} href="/workspace">Open Workspace <ArrowUpRight size={14} aria-hidden="true" /></Link>
  </header>;
}

function OrbitArtwork() {
  return <svg className={styles.heroOrbit} viewBox="0 0 460 420" fill="none" aria-hidden="true"><ellipse cx="230" cy="245" rx="222" ry="104" transform="rotate(-18 230 245)" /><ellipse cx="230" cy="245" rx="159" ry="184" transform="rotate(30 230 245)" /></svg>;
}

export function HeroPhoneComposition() {
  return <div className={styles.heroVisual}>
    <div className={styles.phoneStage} data-hero-phones="true"><OrbitArtwork />
      <PhoneFrame className={styles.heroLeft} label={screenDescriptions.portfolio}><TradingScreen variant="portfolio" /></PhoneFrame>
      <PhoneFrame className={styles.heroRight} label={screenDescriptions.receipt}><TradingScreen variant="receipt" /></PhoneFrame>
      <PhoneFrame className={styles.heroCenter} label={screenDescriptions.research}><TradingScreen variant="research" /></PhoneFrame>
    </div>
    <p className={styles.visualCaption}>ILLUSTRATIVE SIMULATION <span className={styles.captionDivider}>/</span> NO LIVE EXECUTION</p>
  </div>;
}

function Actions({ final = false }: { final?: boolean }) {
  return <div className={styles.actions}>
    <Link className={styles.primaryCta} href="/workspace">{final ? "Open Krineo Workspace" : "Open Workspace"}<ArrowUpRight size={18} aria-hidden="true" /></Link>
    <Link className={styles.secondaryCta} href="/demo">Explore Golden Demo <ArrowRight size={16} aria-hidden="true" /></Link>
  </div>;
}

function Hero() {
  return <section className={styles.hero} aria-labelledby="landing-title"><div className={styles.heroCopy}>
    <p className={styles.eyebrow}>AI-ASSISTED MARKET REASONING</p>
    <h1 id="landing-title">The strategy memory <span>for AI trading.</span></h1>
    <p className={styles.lede}>Krineo keeps the <strong>decision, guardrails, receipts</strong> and change visible.</p><Actions />
    <p className={styles.heroDisclosure}><Check size={13} aria-hidden="true" /> Saved in this browser · no live execution</p>
  </div><HeroPhoneComposition /></section>;
}

const stories: readonly { number: string; label: string; title: string; copy: string; variant: StoryScreenVariant }[] = [
  { number: "01", label: "Playbook", title: "Your trading rules, approved.", copy: "Set limits before the decision.", variant: "rules" },
  { number: "02", label: "Research + Decision", title: "Evidence you can inspect.", copy: "Research and guardrails in one view.", variant: "research-decision" },
  { number: "03", label: "Memory", title: "Keep the receipt.", copy: "See what changed and review the lesson.", variant: "memory" },
];

export function PhoneCrop({ variant }: { variant: StoryScreenVariant }) {
  return <div className={styles.phoneCrop} data-phone-crop="true"><PhoneFrame label={storyScreenDescriptions[variant]} className={styles.storyPhone}><StoryScreen variant={variant} /></PhoneFrame></div>;
}

export function StoryCard({ story }: { story: typeof stories[number] }) {
  const headingId = `story-${story.number}`;
  return <section className={styles.story} aria-labelledby={headingId} data-story={story.number}>
    <span className={styles.cardClip} data-card-clip="true" aria-hidden="true" />
    <div className={styles.storyCopy}><p className={styles.storyLabel}><span>{story.number}</span>{story.label}</p><h3 id={headingId}>{story.title}</h3><p className={styles.storyBody}>{story.copy}</p></div>
    <div className={styles.storyVisual}><PhoneCrop variant={story.variant} /></div>
  </section>;
}

export function TrustStrip() {
  return <section className={styles.trustStrip} aria-label="Krineo product boundaries"><span><ShieldCheck /> Inspectable evidence</span><span><Check /> Human-approved rules</span><span><GitBranch /> Preserved receipts</span><span className={styles.simulationProof}>Simulation only</span></section>;
}

export function FinalCTA() {
  return <section className={styles.finalCta} aria-labelledby="final-title"><p className={styles.eyebrow}>ACCOUNTABLE MARKET REASONING</p><h2 id="final-title">Better reasoning.<br /><span>A memory to build on.</span></h2><p>Decisions, guardrails and receipts.<br className={styles.mobileBreak} /> All in one local workspace.</p><Actions final /><small>Practice is simulation only. No real-money execution.</small></section>;
}

export function MarketingLanding() {
  return <div className={styles.canvas}><div className={styles.page}>
    <a href="#main-content" className={styles.skipLink}>Skip to content</a><MarketingHeader />
    <main id="main-content"><Hero />
      <section id="how-it-works" className={styles.transition} aria-labelledby="system-title"><div className={styles.transitionRule} /><p className={styles.eyebrow}>THE KRINEO SYSTEM</p><div className={styles.transitionHeading}><h2 id="system-title">More than signals.<br /><span>A reasoning system with memory.</span></h2><a href="#story-01" className={styles.scrollLink} aria-label="Explore the three stages"><ArrowDown size={20} aria-hidden="true" /></a></div></section>
      <StoryReveal>{stories.map(story => <StoryCard key={story.number} story={story} />)}</StoryReveal><TrustStrip /><FinalCTA />
    </main><footer className={styles.footer}><span>KRINEO · ACCOUNTABLE MARKET REASONING</span><span>LOCAL PRODUCT SHELL · NO LIVE EXECUTION</span></footer>
  </div></div>;
}
