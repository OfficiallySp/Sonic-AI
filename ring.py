"""
Sonic the Hedgehog Clone - Ring System
Collectible rings that scatter when player is hit.
"""

import pygame
import math
import random
from config import TILE_SIZE, RING_GOLD


class Ring(pygame.sprite.Sprite):
    """Single collectible ring."""
    
    def __init__(self, x, y):
        super().__init__()
        self.rect = pygame.Rect(x, y, 20, 20)
        self.collected = False
        self.anim_frame = 0
        
    def update(self, dt):
        """Update animation."""
        self.anim_frame += dt * 0.01
        if self.anim_frame > 2 * math.pi:
            self.anim_frame -= 2 * math.pi
            
    def draw(self, surface, camera_x, sprites=None):
        """Draw the ring with rotation effect."""
        if self.collected:
            return
            
        x = self.rect.x - camera_x
        y = self.rect.y
        
        if sprites and "ring" in sprites and sprites.get("ring"):
            img = sprites.get("ring")
            if img:
                # Simple rotation simulation - scale width
                scale = abs(math.cos(self.anim_frame))
                w = max(4, int(20 * scale))
                img_scaled = pygame.transform.scale(img, (w, 20))
                surface.blit(img_scaled, (x + (20 - w) // 2, y))
                return
                
        # Fallback: draw ellipse
        scale = abs(math.cos(self.anim_frame))
        w = max(4, int(16 * scale))
        rect = pygame.Rect(x + (20 - w) // 2, y + 6, w, 8)
        pygame.draw.ellipse(surface, RING_GOLD, rect, 2)


class ScatteredRing(pygame.sprite.Sprite):
    """Ring that scatters when player is hit - physics enabled."""
    
    def __init__(self, x, y, vel_x=None, vel_y=None):
        super().__init__()
        self.rect = pygame.Rect(x, y, 16, 16)
        self.vel_x = vel_x if vel_x is not None else random.uniform(-8, 8)
        self.vel_y = vel_y if vel_y is not None else random.uniform(-12, -4)
        self.gravity = 0.5
        self.collected = False
        self.timer = 0
        self.max_timer = 120  # Disappear after 2 seconds
        
    def update(self, tiles, dt):
        """Update physics."""
        self.timer += dt
        if self.timer > self.max_timer:
            self.collected = True
            return
            
        self.vel_y += self.gravity
        self.rect.x += int(self.vel_x)
        self.rect.y += int(self.vel_y)
        
        # Bounce off ground
        for tile in tiles:
            if self.rect.colliderect(tile.rect):
                if self.vel_y > 0:
                    self.rect.bottom = tile.rect.top
                    self.vel_y = -self.vel_y * 0.5
                    self.vel_x *= 0.8
                else:
                    self.rect.top = tile.rect.bottom
                    self.vel_y = -self.vel_y * 0.5
                break
                
    def draw(self, surface, camera_x):
        """Draw scattered ring."""
        if self.collected:
            return
        x = self.rect.x - camera_x
        y = self.rect.y
        pygame.draw.ellipse(surface, RING_GOLD, (x, y, 16, 16), 2)
