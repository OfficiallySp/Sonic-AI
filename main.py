#!/usr/bin/env python3
"""
Sonic the Hedgehog Clone - Main Entry Point
Run this file to start the game.
"""

import os
import sys


def ensure_assets():
    """Run asset generator if assets don't exist."""
    assets_dir = os.path.join(os.path.dirname(__file__), "assets")
    sounds_dir = os.path.join(assets_dir, "sounds")
    
    if not os.path.exists(sounds_dir) or not os.listdir(sounds_dir):
        print("Generating game assets (first run)...")
        try:
            import generate_assets
            generate_assets.main()
        except Exception as e:
            print(f"Warning: Could not generate assets: {e}")
            print("Game will run with fallback graphics.")


def main():
    """Start the Sonic clone game."""
    ensure_assets()
    
    import pygame
    from game import Game
    
    game = Game()
    clock = pygame.time.Clock()
    
    print("Sonic the Hedgehog Clone - Controls:")
    print("  Arrow Keys: Move")
    print("  Space/Up: Jump")
    print("  Down/C: Spin Dash (hold to charge, release to launch)")
    print("  Run fast to roll into a ball!")
    print()
    
    running = True
    while running:
        dt = clock.tick(60)
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            game.handle_event(event)
        
        keys = pygame.key.get_pressed()
        game.update(dt, keys)
        game.draw()
        
        pygame.display.flip()
    
    pygame.quit()
    sys.exit(0)


if __name__ == "__main__":
    main()
