"""
Sonic the Hedgehog Clone - Player (Sonic) Controller
Handles movement, physics, spin dash, rolling, and collision.
"""

import pygame
from config import (
    GRAVITY, MAX_FALL_SPEED, FRICTION, AIR_RESISTANCE,
    RUN_SPEED, JUMP_STRENGTH, ROLL_THRESHOLD, SPIN_DASH_CHARGE, SPIN_DASH_RELEASE,
    TILE_SIZE, COLLISION_TOLERANCE, RING_INVINCIBILITY_TIME
)


class Player(pygame.sprite.Sprite):
    """Sonic character with momentum-based physics and signature abilities."""
    
    def __init__(self, x, y):
        super().__init__()
        self.width = 28
        self.height = 32
        self.rect = pygame.Rect(x, y, self.width, self.height)
        self.vel_x = 0
        self.vel_y = 0
        self.facing_right = True
        self.on_ground = False
        self.rolling = False
        self.spin_dash_charging = False
        self.spin_dash_power = 0
        self.run_frame = 0
        self.frame_timer = 0
        self.invincible = False
        self.invincible_timer = 0
        self.invincible_flash = False
        
    def get_speed(self):
        """Return current horizontal speed (absolute value)."""
        return abs(self.vel_x)
    
    def handle_input(self, keys):
        """Process keyboard input for movement."""
        if self.spin_dash_charging:
            return  # No movement while charging
            
        if self.rolling:
            # Apply friction during roll
            self.vel_x *= FRICTION
            return
            
        if keys[pygame.K_LEFT]:
            self.facing_right = False
            if self.on_ground:
                self.vel_x -= RUN_SPEED * 0.5
                if self.vel_x < -RUN_SPEED:
                    self.vel_x = -RUN_SPEED
            else:
                self.vel_x -= RUN_SPEED * 0.3
        elif keys[pygame.K_RIGHT]:
            self.facing_right = True
            if self.on_ground:
                self.vel_x += RUN_SPEED * 0.5
                if self.vel_x > RUN_SPEED:
                    self.vel_x = RUN_SPEED
            else:
                self.vel_x += RUN_SPEED * 0.3
        else:
            if self.on_ground:
                self.vel_x *= FRICTION
            else:
                self.vel_x *= AIR_RESISTANCE
                
        if keys[pygame.K_UP] or keys[pygame.K_SPACE]:
            if self.on_ground:
                self.vel_y = JUMP_STRENGTH
                self.on_ground = False
                return "jump"
    
    def start_spin_dash(self):
        """Begin charging spin dash."""
        if self.on_ground and not self.rolling:
            self.spin_dash_charging = True
            self.spin_dash_power = 0
            return "spindash"
    
    def charge_spin_dash(self):
        """Add to spin dash charge."""
        if self.spin_dash_charging:
            self.spin_dash_power = min(SPIN_DASH_CHARGE, self.spin_dash_power + 2)
    
    def release_spin_dash(self):
        """Release spin dash - launch forward."""
        if self.spin_dash_charging:
            self.spin_dash_charging = False
            speed = SPIN_DASH_RELEASE + (self.spin_dash_power * 0.5)
            self.vel_x = speed if self.facing_right else -speed
            self.vel_y = 0
            self.rolling = True
            self.on_ground = False
            return "spindash_release"
    
    def update(self, tiles, dt):
        """Update physics and state."""
        # Invincibility timer (after being hit)
        if self.invincible:
            self.invincible_timer -= dt
            if self.invincible_timer <= 0:
                self.invincible = False
            else:
                self.invincible_flash = (self.invincible_timer // 100) % 2 == 0
        
        # Apply gravity
        if not self.on_ground:
            self.vel_y += GRAVITY
            self.vel_y = min(self.vel_y, MAX_FALL_SPEED)
        
        # Check if we should enter/exit rolling
        if self.on_ground and not self.spin_dash_charging:
            if self.get_speed() >= ROLL_THRESHOLD:
                self.rolling = True
            else:
                self.rolling = False
        elif not self.on_ground:
            self.rolling = True if self.get_speed() >= ROLL_THRESHOLD else False
        
        # Horizontal movement
        self.rect.x += int(self.vel_x)
        self._handle_tile_collision_x(tiles)
        
        # Vertical movement
        self.rect.y += int(self.vel_y)
        self.on_ground = False
        self._handle_tile_collision_y(tiles)
        
        # Animation frame
        self.frame_timer += dt
        if self.frame_timer > 80:
            self.frame_timer = 0
            self.run_frame = (self.run_frame + 1) % 4
        
        return None
    
    def _handle_tile_collision_x(self, tiles):
        """Resolve horizontal collisions with tiles."""
        for tile in tiles:
            if self.rect.colliderect(tile.rect):
                if self.vel_x > 0:
                    self.rect.right = tile.rect.left
                    self.vel_x = 0
                elif self.vel_x < 0:
                    self.rect.left = tile.rect.right
                    self.vel_x = 0
                if self.rolling:
                    self.rolling = False
    
    def _handle_tile_collision_y(self, tiles):
        """Resolve vertical collisions with tiles."""
        for tile in tiles:
            if self.rect.colliderect(tile.rect):
                if self.vel_y > 0:
                    self.rect.bottom = tile.rect.top
                    self.vel_y = 0
                    self.on_ground = True
                    if self.rolling and self.get_speed() < ROLL_THRESHOLD:
                        self.rolling = False
                elif self.vel_y < 0:
                    self.rect.top = tile.rect.bottom
                    self.vel_y = 0
    
    def hit(self):
        """Called when player is hit by enemy - lose rings, become invincible."""
        self.invincible = True
        self.invincible_timer = RING_INVINCIBILITY_TIME
        return "hit"
    
    def draw(self, surface, camera_x, sprites=None):
        """Draw the player."""
        if self.invincible and self.invincible_flash:
            return  # Flash effect - don't draw
        
        x = self.rect.x - camera_x
        y = self.rect.y
        
        if sprites and "sonic_run_0" in sprites:
            # Use sprite if available
            if self.rolling or self.spin_dash_charging:
                img = sprites.get("sonic_roll")
            else:
                img = sprites.get(f"sonic_run_{self.run_frame}")
            if img:
                img = pygame.transform.flip(img, not self.facing_right, False)
                surface.blit(img, (x, y))
                return
        
        # Fallback: draw simple shape
        color = (0, 112, 192)  # Sonic blue
        if self.rolling or self.spin_dash_charging:
            pygame.draw.circle(surface, color, (x + 14, y + 16), 14)
        else:
            rect = pygame.Rect(x, y, self.width, self.height)
            pygame.draw.ellipse(surface, color, rect)
            # Eye
            eye_x = x + 22 if self.facing_right else x + 6
            pygame.draw.circle(surface, (255, 255, 255), (eye_x, y + 12), 3)
