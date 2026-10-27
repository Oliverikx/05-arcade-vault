"use client";

import { useState, type ReactElement } from "react";

const MAX_ID = 1025;
const INITIAL_ID = 25;

function spriteUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function randomIdExcept(current: number): number {
  let id: number;
  do {
    id = 1 + Math.floor(Math.random() * MAX_ID);
  } while (id === current);
  return id;
}

export function PokemonCounter(): ReactElement {
  const [count, setCount] = useState(0);
  const [id, setId] = useState(INITIAL_ID);

  function handleClick(): void {
    setCount((c) => c + 1);
    setId(randomIdExcept);
  }

  return (
    <button type="button" className="pokemon-card" onClick={handleClick}>
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
