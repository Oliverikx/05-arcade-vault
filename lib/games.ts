export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
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
    short: "Grow without biting your own tail.",
    long: "A snake of light crawls the grid hunting magenta cores. Every bite makes it longer and faster. One wrong move and it devours itself.",
    cat: "ARCADE",
    cover: "cover-snake",
    color: "green",
    plays: "9.1K",
  },
  {
    id: "chomper",
    title: "CHOMPER",
    short: "Gobble dots and escape the ghosts.",
    long: "A hungry circle patrols a maze collecting glowing dots. Four specters chase it, but every so often a pill appears that turns the tables.",
    cat: "ARCADE",
    cover: "cover-glot",
    color: "yellow",
    plays: "27.2K",
  },
  {
    id: "invaders",
    title: "INVADERS",
    short: "Defend the planet from alien rows.",
    long: "Waves of hostile pixels descend formation after formation. Slide your cannon sideways and fire with precision before they touch the surface.",
    cat: "SHOOTER",
    cover: "cover-invaders",
    color: "green",
    plays: "18.0K",
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
  {
    id: "froggy",
    title: "FROGGY",
    short: "Cross the pixel highway.",
    long: "Hop between lanes of speeding cars and drifting logs on the river. Reach the lily pads before time runs out.",
    cat: "ARCADE",
    cover: "cover-rana",
    color: "green",
    plays: "6.4K",
  },
  {
    id: "pixel-duel",
    title: "PIXEL DUEL",
    short: "Two paddles. One ball. Maximum reflexes.",
    long: "The purest duel: two vertical paddles fight over a glowing ball. Play solo against the CPU or local two-player.",
    cat: "VERSUS",
    cover: "cover-duelo",
    color: "cyan",
    plays: "4.2K",
  },
];

export const CATS: ("ALL" | Category)[] = [
  "ALL",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}
