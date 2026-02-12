"""
Sonic the Hedgehog Clone - Enemy (Badnik) System
Basic enemies that move around and can be defeated by jumping or rolling.
"""

import pygame
from config import TILE_SIZE


class Enemy(pygame.sprite.Sprite):
    """Basic badnik enemy - patrols and can be destroyed by Sonic."""
    
    def __init__(self, x, y, width=32, height=24, patrol_distance=64):
        super().__init__()
        self.rect = pygame.Rect(x, y, width, height)
        self.start_x = x
        self.patrol_distance = patrol_distance
        self.vel_x = 2
        self.destroyed = False
        self.defeated = False  # For scoring
        self.width = width
        self.height = height
        
    def update(self, tiles, player):
        """Update enemy movement and check for player collision."""
        if self.destroyed:
            return
            
        # Patrol back and forth
        self.rect.x += self.vel_x
        
        if self.rect.x <= self.start_x:
            self.rect.x = self.start_x
            self.vel_x = 2
        elif self.rect.x >= self.start_x + self.patrol_distance:
            self.rect.x = self.start_x + self.patrol_distance
            self.vel_x = -2
            
        # Tile collision - reverse direction
        for tile in tiles:
            if self.rect.colliderect(tile.rect):
                if self.vel_x > 0:
                    self.rect.right = tile.rect.left
                else:
                    self.rect.left = tile.rect.right
                self.vel_x = -self.vel_x
                break
                
        # Check if player defeats us (jumping on or rolling into)
        if self.rect.colliderect(player.rect):
            # Player landing on top = defeat
            if player.vel_y > 0 and player.rect.bottom - player.vel_y <= self.rect.top + 8:
                self.destroyed = True
                self.defeated = True
                return "defeated"
            # Player rolling into us = defeat
            elif player.rolling and player.get_speed() >= 6:
                self.destroyed = True
                self.defeated = True
                return "defeated"
            # Otherwise player takes damage
            elif not player.invincible:
                return "hit_player"
                
        return None
    
    def draw(self, surface, camera_x, sprites=None):
        """Draw the enemy."""
        if self.destroyed:
            return
            
        x = self.rect.x - camera_x
        y = self.rect.y
        
        if sprites and "enemy" in sprites and sprites.get("enemy"):
            img = sprites.get("enemy")
            if img:
                surface.blit(img, (x, y))
                return
                
        # Fallback: draw simple shape (crab-like)
        color = (220, 20, 60)
        pygame.draw.ellipse(surface, color, (x, y + 4, self.width, self.height - 8))
        pygame.draw.rect(surface, color, (x + 2, y + self.height - 12, 10, 10))
        pygame.draw.rect(surface, color, (x + self.width - 12, y + self.height - 12, 10, 10))
        pygame.draw.circle(surface, (255, 255, 255), (x + 16, y + 10), 3)


class EnemyCrab(Enemy):
    """Crab-like badnik - moves slower, shorter patrol."""
    
    def __init__(self, x, y):
        super().__init__(x, y, width=28, height=20, patrol_distance=48)
        self.vel_x = 1


class EnemyBuzz(Enemy):
    """Faster flying-type badnik - longer patrol."""
    
    def __init__(self, x, y):
        super().__init__(x, y, width=24, height=24, patrol_distance=96)
        self.vel_x = 3
