export type Category = "ARCADE" | "PUZZLE" | "SHOOTER";
export type Accent = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;
  color: Accent;
  plays: string;
}

export const GAMES: Game[] = [
  {
    id: "arkanoid",
    title: "ARKANOID",
    short: "Bounce the ball and smash neon walls.",
    long: "Slide your paddle and bounce a glowing ball through five walls of neon bricks. Each wall is a new pattern and the ball gets faster every level. Clear all five to bank a bonus for every life left.",
    cat: "ARCADE",
    cover: "cover-arkanoid",
    color: "cyan",
    plays: "12.4K",
  },
  {
    id: "tetris",
    title: "TETRIS",
    short: "Fit the pieces before the ceiling crushes you.",
    long: "Eight shapes fall from the dark, including the hollow Screw. Rotate, drop and clear lines to charge energy, then spend it on abilities: hold, swap, undo, preview or slow time. Speed climbs every 10 lines.",
    cat: "PUZZLE",
    cover: "cover-tetris",
    color: "magenta",
    plays: "31.8K",
  },
  {
    id: "snake",
    title: "SNAKE",
    short: "Eat the fruit. Don't bite your tail.",
    long: "A snake of light crawls a neon grid hunting fruit. Every bite makes it longer and the pace faster. Hit a wall or your own tail and you lose a life; three lives and the run is over.",
    cat: "ARCADE",
    cover: "cover-snake",
    color: "green",
    plays: "9.1K",
  },
  {
    id: "asteroids",
    title: "ASTEROIDS",
    short: "Pulverize asteroids in zero gravity.",
    long: "Your triangular ship drifts in absolute vacuum. Shoot and rotate to split asteroids into ever smaller fragments. Grab power-ups for triple shot and a protective shield.",
    cat: "SHOOTER",
    cover: "cover-asteroids",
    color: "yellow",
    plays: "15.6K",
  },
];

export const CATS: ("ALL" | Category)[] = [
  "ALL",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
];

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}
