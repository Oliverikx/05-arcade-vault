import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/game-player";
import { GAMES, getGame } from "@/lib/games";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata(
  props: PageProps<"/games/[id]/play">,
): Promise<Metadata> {
  const { id } = await props.params;
  const game = getGame(id);
  if (!game) return {};
  return { title: `Playing ${game.title}`, description: game.short };
}

export default async function PlayPage(props: PageProps<"/games/[id]/play">) {
  const { id } = await props.params;
  const game = getGame(id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
