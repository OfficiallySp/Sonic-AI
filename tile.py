"""
Sonic the Hedgehog Clone - Tile System
Platform tiles, checkpoints, and goal posts.
"""

import pygame
from config import TILE_SIZE, GRASS_GREEN, DIRT_BROWN, CHECKPOINT_WHITE


class Tile(pygame.sprite.Sprite):
    """Solid platform tile."""
    
    def __init__(self, x, y, tile_type="grass"):
        super().__init__()
        self.rect = pygame.Rect(x, y, TILE_SIZE, TILE_SIZE)
        self.tile_type = tile_type
        
        # Colors for different tile types
        self.colors = {
            "grass": GRASS_GREEN,
            "dirt": DIRT_BROWN,
            "stone": (128, 128, 128),
            "checkpoint": CHECKPOINT_WHITE,
        }
        self.color = self.colors.get(tile_type, GRASS_GREEN)
        
    def draw(self, surface, camera_x, sprites=None):
        """Draw the tile."""
        x = self.rect.x - camera_x
        y = self.rect.y
        
        if sprites and sprites.get(f"tile_{self.tile_type}"):
            img = sprites.get(f"tile_{self.tile_type}")
            if img:
                surface.blit(img, (x, y))
                return
                
        # Fallback: draw colored rectangle
        pygame.draw.rect(surface, self.color, (x, y, TILE_SIZE, TILE_SIZE))
        if self.tile_type == "grass":
            pygame.draw.rect(surface, (50, 160, 50), (x, y, TILE_SIZE, 4))
        pygame.draw.rect(surface, (0, 0, 0), (x, y, TILE_SIZE, TILE_SIZE), 1)


class Checkpoint(pygame.sprite.Sprite):
    """Checkpoint - saves progress when touched."""
    
    def __init__(self, x, y, width=32, height=64):
        super().__init__()
        self.rect = pygame.Rect(x, y, width, height)
        self.activated = False
        
    def draw(self, surface, camera_x, sprites=None):
        """Draw checkpoint post."""
        x = self.rect.x - camera_x
        y = self.rect.y
        color = (100, 255, 100) if self.activated else CHECKPOINT_WHITE
        pygame.draw.rect(surface, color, (x, y, 8, 64))
        pygame.draw.rect(surface, (255, 255, 0), (x + 8, y + 20, 24, 24))
        pygame.draw.rect(surface, (0, 0, 0), (x, y, 32, 64), 1)


class GoalPost(pygame.sprite.Sprite):
    """Goal post at end of level - touching wins the level."""
    
    def __init__(self, x, y):
        super().__init__()
        self.rect = pygame.Rect(x, y, 48, 64)
        
    def draw(self, surface, camera_x, sprites=None):
        """Draw goal post."""
        x = self.rect.x - camera_x
        y = self.rect.y
        
        if sprites and sprites.get("goal"):
            img = sprites.get("goal")
            if img:
                surface.blit(img, (x, y))
                return
                
        # Fallback: draw goal post
        pygame.draw.rect(surface, (255, 255, 255), (x, y, 8, 64))
        pygame.draw.rect(surface, (255, 0, 0), (x + 8, y, 40, 16))
        pygame.draw.circle(surface, (255, 215, 0), (x + 28, y + 8), 6)
        pygame.draw.rect(surface, (0, 0, 0), (x, y, 48, 64), 1)
