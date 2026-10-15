import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home" };

export default function Home() {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
      </section>
    </div>
  );
}
