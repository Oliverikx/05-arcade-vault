"use client";

import { useState } from "react";

const MAX_ID = 1025;
const spriteUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

function randomId(except?: number) {
  let id: number;
  do {
    id = 1 + Math.floor(Math.random() * MAX_ID);
  } while (id === except);
  return id;
}

export function PokemonCounter() {
  const [count, setCount] = useState(0);
  const [id, setId] = useState(25);

  return (
    <button
      type="button"
      className="pokemon-card"
      onClick={() => {
        setCount((c) => c + 1);
        setId((cur) => randomId(cur));
      }}
    >
      <span className="pokemon-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={spriteUrl(id)} alt={`Pokemon #${id}`} />
      </span>
      <span className="pokemon-id pixel">#{id}</span>
      <span className="pokemon-count pixel neon-yellow" aria-live="polite">
        {count}
      </span>
      <span className="pokemon-hint pixel">CLICK TO CATCH</span>
    </button>
  );
}
