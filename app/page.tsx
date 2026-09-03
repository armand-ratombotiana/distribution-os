import { ArrowRight, Bot, BrainCircuit, Check, CircleDollarSign, Database, Gauge, Globe2, LockKeyhole, Network, Radar, ShieldCheck, Sparkles, Waypoints } from "lucide-react";
import Link from "next/link";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";

const capabilities = [
  { icon: BrainCircuit, title: "Understands the product", text: "Reads the website, extracts the promise, maps the market and builds an evidence-backed first-customer thesis." },
  { icon: Waypoints, title: "Coordinates the work", text: "Specialist agents share one mission, one memory and one measurable objective instead of producing disconnected drafts." },
  { icon: Gauge, title: "Learns from outcomes", text: "Every content asset and experiment carries a metric, attribution path and kill rule for the next cycle." },
];

const channels = ["YouTube", "TikTok", "Instagram", "X", "Gmail", "Reddit", "Quora", "LinkedIn", "Stripe", "HubSpot", "Analytics", "+100"];

export default async function LandingPage() {
  const user = await getChatGPTUser();
  const workspaceHref = user ? "/workspace" : chatGPTSignInPath("/workspace");
  return <main className="landing-page">
    <nav className="landing-nav"><Link className="landing-brand" href="/"><span><Radar /></span>Distribution OS</Link><div className="landing-links"><a href="#system">System</a><a href="#connectors">Connectors</a><a href="#control">Control</a></div><a className="landing-nav-cta" href={workspaceHref} target={user ? undefined : "_top"}>{user ? "Open workspace" : "Sign in"}<ArrowRight /></a></nav>

    <section className="landing-hero landing-hero-v3"><div className="hero-grid" /><div className="hero-copy hero-copy-v3"><p className="landing-kicker"><Sparkles /> One input. A continuously improving distribution system.</p><h1>Paste your website.<br /><span>Let the system find the customers.</span></h1><p className="hero-lede">Distribution OS reads the product, builds the strategy, creates content, coordinates channels and learns from every signal toward the first attributable payment.</p><form id="launch" className="landing-url-form" action="/workspace" method="get"><Globe2 /><input name="website_url" type="url" required autoComplete="url" aria-label="Your public website URL" placeholder="https://yourproduct.com" /><button type="submit">Launch mission <ArrowRight /></button></form><a className="hero-secondary-link" href="#system">See how the agentic operating loop works</a><div className="hero-proof"><span><Check /> One initial input</span><span><Check /> Human-controlled execution</span><span><Check /> Durable learning memory</span></div></div>
    </section>

    <section id="system" className="landing-section"><div className="section-heading"><p>One coordinated system</p><h2>From product truth to revenue evidence.</h2><span>Distribution is a continuous decision loop—not a pile of disconnected content tools.</span></div><div className="capability-grid">{capabilities.map(({icon:Icon,title,text}, index) => <article key={title}><div><Icon /></div><small>0{index+1}</small><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section className="agent-network-story"><div className="agent-orbit" aria-label="Distribution OS agent network"><div className="orbit-ring orbit-one" /><div className="orbit-ring orbit-two" /><div className="orbit-core"><Radar /><strong>Distribution<br />OS</strong><small>AI CMO</small></div><div className="orbit-node node-one"><Globe2 /><span>Market</span></div><div className="orbit-node node-two"><Bot /><span>Content</span></div><div className="orbit-node node-three"><Network /><span>Channels</span></div><div className="orbit-node node-four"><CircleDollarSign /><span>Revenue</span></div><div className="orbit-signal"><i />Learning cycle active</div></div><div className="agent-network-copy"><p className="landing-kicker"><BrainCircuit /> One shared mission</p><h2>An AI CMO coordinates every specialist agent.</h2><p>Website intelligence, market research, customer segmentation, strategy, content and revenue analysis operate against the same evidence ledger. Each cycle keeps what worked, rejects weak assumptions and chooses the next best action.</p><div><span><strong>06</strong> specialist agents</span><span><strong>01</strong> north-star metric</span><span><strong>∞</strong> learning cycles</span></div></div></section>

    <section className="operating-strip"><div><small>01 · Observe</small><strong>Website + market signals</strong></div><ArrowRight /><div><small>02 · Decide</small><strong>ICP + experiment priority</strong></div><ArrowRight /><div><small>03 · Act</small><strong>Approved distribution</strong></div><ArrowRight /><div><small>04 · Learn</small><strong>Revenue + response evidence</strong></div></section>

    <section id="connectors" className="connector-story"><div><p className="landing-kicker"><Network /> Connector intelligence</p><h2>Your distribution stack, available to every agent.</h2><p>Search more than 100 social, email, CRM, analytics, creative and revenue providers. Distribution OS requests the minimum capability needed for the current mission and keeps credentials outside model context.</p><a href={workspaceHref} target={user ? undefined : "_top"}>Explore the connector hub <ArrowRight /></a></div><div className="channel-cloud">{channels.map(channel => <span key={channel}>{channel}</span>)}</div></section>

    <section id="control" className="control-story"><div className="control-icon"><ShieldCheck /></div><div><p>Autonomy with boundaries</p><h2>Agents can reason continuously. You control irreversible actions.</h2></div><div className="control-list"><span><LockKeyhole /> Publish & outreach</span><span><LockKeyhole /> Spend & account changes</span><span><LockKeyhole /> Payment configuration</span></div></section>

    <section className="landing-final"><Database /><h2>One URL. One workspace. One compounding memory.</h2><p>Start the mission and let each cycle become smarter than the last.</p><a className="primary-cta" href="#launch">Enter your website URL <ArrowRight /></a></section>
    <footer className="landing-footer"><span>Distribution OS</span><span>Agentic distribution infrastructure for builders.</span><span>© 2026</span></footer>
  </main>;
}
