import type { Metadata } from "next";
import { Reveal } from "@/components/home/reveal";
import { ContactForm } from "@/components/about/contact-form";
import {
  HighlightIcon,
  type HighlightKind,
} from "@/components/about/highlight-icon";

export const metadata: Metadata = { title: "About" };

const HIGHLIGHTS: { kind: HighlightKind; text: string; color: string }[] = [
  { kind: "HEART", text: "MADE WITH ❤️ FOR PLAYERS", color: "magenta" },
  { kind: "BROWSER", text: "HTML GAMES — RUN IN ANY BROWSER", color: "cyan" },
  { kind: "PLANT", text: "A PROJECT IN CONSTANT GROWTH", color: "green" },
];

export default function AboutPage() {
  return (
    <div className="about fade-in">
      <Reveal />

      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ABOUT</div>
        <h1 className="about-title">ABOUT ARCADE VAULT</h1>
        <p className="about-mission">
          ARCADE VAULT was born from a love of classic videogames. Our mission is to
          preserve and celebrate the arcades that defined a generation, making them
          accessible to everyone, anywhere, at no cost.
        </p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((h, i) => (
            <div
              key={h.kind}
              className={"highlight " + h.color}
              style={{ transitionDelay: i * 80 + "ms" }}
            >
              <HighlightIcon kind={h.kind} />
              <div className="hl-text pixel">{h.text}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="about-divider reveal" aria-hidden="true">
        <div className="div-bar"></div>
        <div className="div-pixels">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} style={{ animationDelay: i * 80 + "ms" }}></span>
          ))}
        </div>
        <div className="div-bar"></div>
      </div>

      <section className="about-contact reveal">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACT</div>
            <h2 className="contact-title">CONTACT US</h2>
            <p className="contact-sub">
              Have a suggestion, want to propose a game, or just want to say hi?
              Write to us.
            </p>
            <div className="contact-tips">
              <div className="tip">
                <span className="tip-led"></span>REPLY IN 24-48H
              </div>
              <div className="tip">
                <span className="tip-led y"></span>SUGGESTIONS WELCOME
              </div>
              <div className="tip">
                <span className="tip-led m"></span>NO SPAM, EVER
              </div>
            </div>
          </div>

          <ContactForm />
        </div>
      </section>
    </div>
  );
}
