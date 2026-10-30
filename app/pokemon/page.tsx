import type { Metadata } from "next";
import { PokemonCounter } from "@/components/pokemon-counter";

export const metadata: Metadata = { title: "Pokemon" };

export default function PokemonPage() {
  return (
    <div className="pokemon fade-in">
      <div className="kicker pixel neon-yellow">▸ POKEMON</div>
      <h1 className="about-title">POKEMON COUNTER</h1>
      <PokemonCounter />
    </div>
  );
}
