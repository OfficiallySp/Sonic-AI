# Sonic: Emerald Rush

A 2D Sonic the Hedgehog clone built entirely with JavaScript and HTML5 Canvas. No external dependencies, no build tools, no installation required.

## Quick Start

1. **Open `index.html` in any modern web browser** (Chrome, Firefox, Edge, Safari)
   - Just double-click the file, or drag it into your browser
   - No server required - runs directly from the file system

2. **That's it!** The game loads instantly with all assets generated procedurally.

## Controls

| Action | Keys |
|--------|------|
| Move Left/Right | Arrow Keys or A/D |
| Jump | Space or Z |
| Crouch | Down Arrow or S |
| Roll | Down Arrow while running |
| Spin Dash | Crouch + press Space repeatedly to charge, release Down to launch |
| Pause | Escape or P |
| Confirm/Start | Enter |

## Game Features

### Gameplay
- **Momentum Physics**: Sonic accelerates and decelerates with realistic momentum. Build up speed for maximum velocity!
- **Spin Dash**: Charge up while crouching, then release for a burst of speed
- **Rolling**: Press down while running fast to curl into a ball - destroys enemies on contact
- **Ring System**: Collect rings for points. Getting hit scatters your rings. Collect 100 rings for an extra life. Having 0 rings when hit means death.
- **Score System**: Points from rings (+10 each), enemies (+100 each), and time/ring bonuses at level end
- **Lives System**: Start with 3 lives. Lose a life by falling into pits or getting hit with no rings.

### Levels
1. **Emerald Valley** (Act 1) - Lush green hills inspired by Green Hill Zone. Rolling terrain, palm trees, and gentle introduction to mechanics.
2. **Neon Factory** (Act 2) - Dark industrial zone with metallic platforms. Harder enemy placement and trickier platforming.
3. **Sky Sanctuary** (Act 3) - Sunset temple floating above the clouds. Marble platforms, classical columns, long spring chains, and a sky-high bonus route over a climactic temple plateau.

### Enemies
- **Crawler** (red bug robot): Patrols ground left and right. Jump on or roll into to destroy.
- **Flyer** (blue wasp robot): Flies in sine-wave patterns. Jump on from above or roll into to destroy.

### Items
- **Rings**: Golden rings floating in the air. Collect for points and protection.
- **Springs**: Yellow springs that launch Sonic high into the air.
- **Checkpoints**: Blue/red poles. Touch to save your respawn position.
- **Goal Post**: Spinning sign at the end of each level.

### Sound
All sound effects and music are generated procedurally using the Web Audio API:
- Jump, ring collection, spin dash, enemy destruction
- Hurt, spring bounce, checkpoint activation
- Level complete fanfare, game over theme
- Background music loops for each level

## Technical Details

### Architecture
```
index.html        - Entry point with canvas element
js/
  engine.js       - Core systems (config, input, sound, camera, utilities)
  graphics.js     - Procedural sprite generation using Canvas 2D API
  world.js        - Level data, tile system, entity classes
  player.js       - Sonic character physics and state machine
  game.js         - Game loop, state machine, UI screens
```

### No External Assets
All game assets (sprites, tiles, backgrounds, sound effects, music) are generated procedurally at runtime using:
- **Canvas 2D API** for all graphics (characters, tiles, backgrounds, UI)
- **Web Audio API** for all sound effects and music (oscillators, noise, envelopes)

This means:
- Zero external dependencies
- No image files or audio files to load
- Instant startup
- Tiny download size

### Physics
The game uses a fixed-timestep (60 FPS) physics loop with:
- Momentum-based acceleration and deceleration
- Separate ground/air movement parameters
- Tile-based collision detection
- Variable jump height (release jump early for short hops)
- Rolling physics with reduced friction
- Spin dash charge-and-release mechanics

### Browser Compatibility
Works in all modern browsers that support:
- HTML5 Canvas
- Web Audio API
- ES6 JavaScript

Tested in Chrome, Firefox, Edge, and Safari.

## Tips
- Build up speed on slopes and flat sections - Sonic's momentum is your best friend
- Use Spin Dash to blast through enemies and reach high platforms
- Look for upper paths - they often have more rings and are faster
- Springs can launch you to secret platform areas with extra rings
- Roll into enemies instead of jumping on them for a smoother flow
- Collect 100 rings for an extra life!
