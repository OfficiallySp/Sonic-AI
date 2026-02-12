# Sonic the Hedgehog - Clone

A complete 2D side-scrolling platformer inspired by classic Sonic the Hedgehog, built with Python and Pygame.

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Pygame](https://img.shields.io/badge/Pygame-2.5+-green.svg)

## Features

- **Classic Sonic gameplay**: Running, jumping, spin dash, and rolling
- **Physics-based movement**: Momentum and speed-based mechanics
- **2 complete levels**: Green Hill Zone and Marble Hill Zone
- **Ring collection**: Collect rings, scatter when hit by enemies
- **Lives system**: Start with 3 lives
- **Score system**: Earn points from rings, enemies, and time bonuses
- **Enemies**: Defeat badniks by jumping on them or rolling into them
- **Checkpoints**: Save progress mid-level
- **Sound effects & music**: Jump, ring, enemy, spin dash, and background music

## Quick Start

### Prerequisites

- Python 3.8 or newer
- pip (Python package manager)

### Installation

1. **Clone or download** this project to your computer.

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the game**:
   ```bash
   python main.py
   ```

On first run, the game will automatically generate sprites, sounds, and music. You can also generate assets manually:

```bash
python generate_assets.py
```

### Windows Note

If you see encoding errors when generating assets, run the game with UTF-8 encoding:

```powershell
chcp 65001
python main.py
```

## Controls

| Key | Action |
|-----|--------|
| **Left Arrow** | Move left |
| **Right Arrow** | Move right |
| **Up Arrow** / **Space** | Jump |
| **Down Arrow** / **C** | Spin dash (hold to charge, release to launch) |

**Speed tip**: Run fast to automatically roll into a ball! Roll into enemies to defeat them.

## Game Mechanics

### Spin Dash
1. Stand still on the ground
2. Hold **Down** or **C**
3. Release to launch forward at high speed

### Defeating Enemies
- **Jump on them**: Land on top of an enemy to destroy it
- **Roll into them**: Build up speed and roll into enemies

### Rings
- Collect rings for points
- When hit by an enemy: rings scatter; collect them before they disappear
- Having no rings when hit = lose a life

### Checkpoints
- Touch the floating checkpoint posts to save your position
- Respawn at the last checkpoint when you lose a life

## Project Structure

```
aog/
├── main.py           # Entry point - run this to play
├── game.py           # Main game loop and state management
├── player.py         # Sonic character with physics
├── enemy.py          # Badnik enemies
├── ring.py           # Ring collection and scattering
├── level.py          # Level generation
├── tile.py           # Tiles, checkpoints, goal post
├── config.py         # Game constants and settings
├── generate_assets.py # Creates sprites, sounds, music
├── requirements.txt  # Python dependencies
├── assets/           # Generated game assets
│   ├── sprites/      # Character and tile images
│   ├── sounds/      # Sound effects
│   └── music/       # Background music
└── README.md         # This file
```

## Customization

Edit `config.py` to adjust:
- Screen size, gravity, jump strength
- Run speed, spin dash power
- Starting lives, scoring values

## Technical Details

- **Engine**: Pygame 2.5+
- **Resolution**: 1280x720 (scalable)
- **Frame rate**: 60 FPS
- **Level format**: Procedurally generated tile-based levels

## License

This is a fan-made educational project. Sonic the Hedgehog is a trademark of SEGA. No commercial use intended.

---

Enjoy the game! **Gotta go fast!**
