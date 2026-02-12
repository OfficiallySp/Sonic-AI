# Sonic Clone (2D, Pygame)

A complete, beginner-friendly Sonic-inspired side-scrolling platformer built with Python + Pygame.

## Features

- Physics-based side-scrolling movement with momentum
- Sonic-like actions: run, jump, roll, and spin dash
- Ring collection system with ring scatter on damage
- Lives system (starts at 3 lives)
- Score system (rings, enemy defeats, level bonuses)
- 2 full levels with different themes:
  - Emerald Sprint Zone (Green Hill-style)
  - Marble Dash Zone
- Badnik-style enemies
- Checkpoints and goal posts
- Sound effects + background music
- Title screen, level clear screen, game over, and full game completion screen

## Project Structure

- `main.py` - game loop, physics, gameplay systems, rendering, UI
- `generate_assets.py` - generates all sprites, sounds, music, and level JSON files
- `assets/sprites/` - character, enemy, ring, background, UI art
- `assets/sounds/` - jump/ring/hurt/etc SFX
- `assets/music/` - level background music
- `assets/levels/` - level data for both zones

## Setup (Windows / macOS / Linux)

1. Make sure Python 3.10+ is installed.
2. Open a terminal in this project folder.
3. Install dependency:

   ```bash
   pip install -r requirements.txt
   ```

4. Generate game assets (sprites, sounds, music, levels):

   ```bash
   python generate_assets.py
   ```

5. Run the game:

   ```bash
   python main.py
   ```

> `main.py` will auto-generate assets if they are missing, but running the generator manually first is recommended.

## Controls

- Move: `Left/Right` or `A/D`
- Jump: `Space` or `Z`
- Roll: hold `Down` while moving fast
- Spin Dash: hold `Down`, press `Jump` to charge, release `Down` to launch
- Confirm / Start / Continue: `Enter`
- Quit: `Esc`

## Scoring

- Ring pickup: +100
- Scattered ring pickup: +50
- Enemy destroyed: +1000
- Level clear bonus:
  - Ring bonus (`rings * 100`)
  - Time bonus (faster clear = higher score)
  - Stage clear bonus (+5000)

## Notes

- This project uses lightweight generated pixel art and synthesized WAV audio so it is fully self-contained.
- If your machine has no audio device, the game will still run (music/SFX will be disabled automatically).
