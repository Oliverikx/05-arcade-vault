# game-planner — suggestion log

Status legend: suggested | accepted | rejected | implemented

| Date       | Game            | Category | Slot       | Score | Status      | Reason                                             |
| ---------- | --------------- | -------- | ---------- | ----- | ----------- | -------------------------------------------------- |
| 2026-10-20 | arkanoid        | ARCADE   | arkanoid   | n/a   | implemented | Baseline (pre-existing)                            |
| 2026-10-20 | asteroids       | SHOOTER  | asteroids  | n/a   | implemented | Baseline (pre-existing)                            |
| 2026-10-20 | tetris          | PUZZLE   | tetris     | n/a   | implemented | Baseline (pre-existing)                            |
| 2026-10-20 | snake           | ARCADE   | snake      | n/a   | implemented | Baseline (pre-existing)                            |
| 2026-10-20 | pixel-duel      | VERSUS   | pixel-duel | 35/35 | suggested   | VERSUS has 0 games; Pong vs CPU                    |
| 2026-10-20 | invaders        | SHOOTER  | invaders   | 30/35 | suggested   | Runner-up; SHOOTER 1 game, slot                    |
| 2026-10-20 | 2048            | PUZZLE   | none       | 30/35 | suggested   | PUZZLE 1 game; no slot (lost tie)                  |
| 2026-10-20 | froggy          | ARCADE   | froggy     | 22/35 | suggested   | ARCADE already 2                                   |
| 2026-10-20 | chomper         | ARCADE   | chomper    | 20/35 | suggested   | ARCADE already 2; maze/AI heavy                    |
| 2026-10-20 | minesweeper     | PUZZLE   | none       | 33/35 | suggested   | Cursor+Space reveal+F flag, 3 lives, bigger boards |
| 2026-10-20 | connect-four    | VERSUS   | none       | 33/35 | suggested   | Minimax CPU, 3 lives                               |
| 2026-10-20 | gem-swap        | PUZZLE   | none       | 31/35 | suggested   | Match-3, moves limit                               |
| 2026-10-20 | columns         | PUZZLE   | none       | 31/35 | suggested   | Close to tetris                                    |
| 2026-10-20 | slider-15       | PUZZLE   | none       | 31/35 | suggested   | Sliding tiles                                      |
| 2026-10-20 | air-hockey      | VERSUS   | none       | 31/35 | suggested   | Solo vs CPU                                        |
| 2026-10-20 | light-cycles    | VERSUS   | none       | 31/35 | suggested   | Overlaps snake feel                                |
| 2026-10-20 | pill-pop        | PUZZLE   | none       | 29/35 | suggested   | Generic name, trademark risk                       |
| 2026-10-20 | galaga          | SHOOTER  | none       | 28/35 | suggested   | SHOOTER classic                                    |
| 2026-10-20 | missile-command | SHOOTER  | none       | 28/35 | suggested   | SHOOTER classic                                    |
| 2026-10-20 | tank-duel       | VERSUS   | none       | 27/35 | suggested   | Hardest (CPU AI)                                   |
| 2026-10-20 | neon-flap       | ARCADE   | none       | 26/35 | suggested   | Flappy-style                                       |
| 2026-10-20 | centipede       | SHOOTER  | none       | 26/35 | suggested   | SHOOTER classic                                    |
| 2026-10-20 | neon-runner     | ARCADE   | none       | 24/35 | suggested   | Dino Run-style                                     |
| 2026-10-20 | robotron        | SHOOTER  | none       | 24/35 | suggested   | Twin-stick on keyboard                             |
| 2026-10-20 | defender        | SHOOTER  | none       | 24/35 | suggested   | Scrolling world                                    |
| 2026-10-20 | sky-hop         | ARCADE   | none       | 22/35 | suggested   | ARCADE already 2                                   |
| 2026-10-20 | bomber          | ARCADE   | none       | 20/35 | suggested   | ARCADE already 2                                   |
| 2026-10-20 | barrel-climb    | ARCADE   | none       | 18/35 | suggested   | ARCADE already 2; platformer physics               |

## Entries

### 2026-10-20

- Counts: ARCADE 2, PUZZLE 1, SHOOTER 1, VERSUS 0.
- Candidates: pixel-duel 35, invaders 30, 2048 30, froggy 22, chomper 20.
- Pick: pixel-duel. Runner-up: invaders (tie with 2048 broken by placeholder slot).
- Why: biggest category gap, simplest engine, most recognizable.
- Note: catalog `long` for pixel-duel mentions local two-player; must be rewritten to solo vs CPU.
- Status: suggested.

### 2026-10-20 (batch 2: 20 user-supplied candidates)

- Score = gap*3+ease*2+pop*2 /35. Merged with existing invaders 30, 2048 30, froggy 22, chomper 20.
- Pixel-duel 35 reconfirmed (rewrite catalog `long`, drop local 2P). New: minesweeper 33, connect-four 33, gem-swap/columns/slider-15/air-hockey/light-cycles 31, pill-pop 29, galaga/missile-command 28, tank-duel 27, neon-flap/centipede 26, neon-runner/robotron/defender 24, sky-hop 22, bomber 20, barrel-climb 18.
- Top: pixel-duel; next minesweeper/connect-four.
- Status: all suggested.
