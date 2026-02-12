"""
Sonic the Hedgehog Clone - Main Game Loop
Handles game state, level progression, scoring, and rendering.
"""

import os
import pygame
from config import (
    SCREEN_WIDTH, SCREEN_HEIGHT, TILE_SIZE, FPS,
    INITIAL_LIVES, RING_SCORE, ENEMY_SCORE, TIME_BONUS_PER_SECOND,
    SKY_BLUE, GRASS_GREEN
)
from player import Player
from level import get_level
from ring import Ring, ScatteredRing


class Game:
    """Main game controller - manages state, levels, and rendering."""
    
    def __init__(self):
        pygame.init()
        pygame.mixer.init(frequency=44100, size=-16, channels=1, buffer=512)
        
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SCALED)
        pygame.display.set_caption("Sonic the Hedgehog - Clone")
        
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 36)
        self.title_font = pygame.font.Font(None, 72)
        
        # Game state
        self.state = "menu"  # menu, playing, level_complete, game_over
        self.lives = INITIAL_LIVES
        self.score = 0
        self.rings = 0
        self.current_level = 1
        self.checkpoint = None
        self.level_start_time = 0
        self.level_complete_timer = 0
        self.game_over_timer = 0
        
        # Load assets
        self.sprites = self._load_sprites()
        self.sounds = self._load_sounds()
        self._load_music()
        
        # Level data (set when loading level)
        self.level = None
        self.player = None
        self.camera_x = 0
        self.scattered_rings = []
        
    def _load_sprites(self):
        """Load or generate sprite images."""
        sprites = {}
        sprites_dir = os.path.join(os.path.dirname(__file__), "assets", "sprites")
        
        if os.path.exists(sprites_dir):
            for f in os.listdir(sprites_dir):
                if f.endswith(".png"):
                    path = os.path.join(sprites_dir, f)
                    key = f.replace(".png", "")
                    sprites[key] = pygame.image.load(path).convert_alpha()
        
        return sprites
    
    def _load_sounds(self):
        """Load sound effects."""
        sounds = {}
        sounds_dir = os.path.join(os.path.dirname(__file__), "assets", "sounds")
        
        if os.path.exists(sounds_dir):
            for name in ["jump", "ring", "enemy", "spindash", "hit", "checkpoint", "goal"]:
                path = os.path.join(sounds_dir, f"{name}.wav")
                if os.path.exists(path):
                    try:
                        sounds[name] = pygame.mixer.Sound(path)
                    except Exception:
                        pass
        
        return sounds
    
    def _load_music(self):
        """Load background music."""
        music_dir = os.path.join(os.path.dirname(__file__), "assets", "music")
        music_path = os.path.join(music_dir, "green_hill.wav")
        if os.path.exists(music_path):
            try:
                pygame.mixer.music.load(music_path)
            except Exception:
                pass
    
    def _play_sound(self, name):
        """Play a sound effect if available."""
        if name in self.sounds:
            self.sounds[name].play()
    
    def load_level(self, level_num):
        """Load a level and reset player position."""
        self.level = get_level(level_num)
        spawn = self.checkpoint if self.checkpoint else self.level["spawn"]
        self.player = Player(spawn[0], spawn[1])
        self.camera_x = 0
        self.scattered_rings = []
        self.level_start_time = pygame.time.get_ticks()
        
        # Reset rings for this level (keep score)
        self.rings = 0
        
        # Unpause music
        try:
            pygame.mixer.music.play(-1)
        except Exception:
            pass
    
    def _spawn_scattered_rings(self):
        """Spawn scattered rings when player is hit."""
        count = min(self.rings, 20)  # Max 20 rings scatter
        self.rings = 0
        x, y = self.player.rect.centerx, self.player.rect.centery
        
        for _ in range(count):
            self.scattered_rings.append(ScatteredRing(x, y))
        
        self._play_sound("hit")
    
    def update(self, dt, keys):
        """Update game state."""
        if self.state == "menu":
            return
        
        if self.state == "level_complete":
            self.level_complete_timer -= dt
            if self.level_complete_timer <= 0:
                self.current_level += 1
                if self.current_level > 2:
                    self.state = "menu"
                    self.current_level = 1
                else:
                    self.checkpoint = None
                    self.load_level(self.current_level)
                    self.state = "playing"
            return
        
        if self.state == "game_over":
            self.game_over_timer -= dt
            if self.game_over_timer <= 0:
                self.state = "menu"
            return
        
        if self.state != "playing":
            return
            
        # Spin dash handling (Down or C key)
        spin_key = keys[pygame.K_DOWN] or keys[pygame.K_c]
        if spin_key and self.player.on_ground:
            if not self.player.spin_dash_charging:
                self._play_sound("spindash")
            self.player.start_spin_dash()
            self.player.charge_spin_dash()
        elif self.player.spin_dash_charging:
            self.player.release_spin_dash()
            self._play_sound("spindash")
        
        # Normal input
        result = self.player.handle_input(keys)
        if result == "jump":
            self._play_sound("jump")
        
        self.player.update(self.level["tiles"], dt)
        
        # Collect scattered rings
        for ring in self.scattered_rings[:]:
            ring.update(self.level["tiles"], dt)
            if ring.collected:
                self.scattered_rings.remove(ring)
            elif self.player.rect.colliderect(ring.rect):
                self.rings += 1
                self.score += RING_SCORE
                ring.collected = True
                self.scattered_rings.remove(ring)
                self._play_sound("ring")
        
        # Ring collection
        for ring in self.level["rings"]:
            if not ring.collected and self.player.rect.colliderect(ring.rect):
                ring.collected = True
                self.rings += 1
                self.score += RING_SCORE
                self._play_sound("ring")
        
        # Checkpoint
        for cp in self.level["checkpoints"]:
            if not cp.activated and self.player.rect.colliderect(cp.rect):
                cp.activated = True
                self.checkpoint = (cp.rect.x + 64, cp.rect.y - 32)
                self._play_sound("checkpoint")
        
        # Goal
        if self.player.rect.colliderect(self.level["goal"].rect):
            time_bonus = max(0, (pygame.time.get_ticks() - self.level_start_time) // 1000)
            time_bonus = 300 - time_bonus
            self.score += max(0, time_bonus * TIME_BONUS_PER_SECOND)
            self.score += self.rings * 100  # Bonus for rings
            self._play_sound("goal")
            pygame.mixer.music.stop()
            self.state = "level_complete"
            self.level_complete_timer = 3000
            return
        
        # Enemies
        for enemy in self.level["enemies"]:
            result = enemy.update(self.level["tiles"], self.player)
            if result == "defeated":
                self.score += ENEMY_SCORE
                self._play_sound("enemy")
            elif result == "hit_player":
                if not self.player.invincible:
                    self.player.hit()
                    self._spawn_scattered_rings()
                    if self.rings == 0:
                        self.lives -= 1
                        if self.lives <= 0:
                            self.state = "game_over"
                            self.game_over_timer = 3000
                            pygame.mixer.music.stop()
                            self._play_sound("hit")
                        else:
                            self.player.invincible = True
                            self.player.invincible_timer = 2000
                            spawn = self.checkpoint if self.checkpoint else self.level["spawn"]
                            self.player.rect.x = spawn[0]
                            self.player.rect.y = spawn[1]
                            self.player.vel_x = 0
                            self.player.vel_y = 0
        
        # Update ring animations
        for ring in self.level["rings"]:
            ring.update(dt)
        
        # Camera
        target_x = self.player.rect.centerx - SCREEN_WIDTH // 2
        self.camera_x += (target_x - self.camera_x) * 0.1
        self.camera_x = max(0, min(self.camera_x, self.level["width"] - SCREEN_WIDTH))
    
    def draw(self):
        """Draw everything."""
        self.screen.fill(SKY_BLUE)
        
        if self.state == "menu":
            self._draw_menu()
            return
        
        if self.state == "level_complete":
            self._draw_level()
            self._draw_level_complete()
            return
        
        if self.state == "game_over":
            self._draw_game_over()
            return
        
        self._draw_level()
        self._draw_hud()
    
    def _draw_level(self):
        """Draw level elements."""
        # Parallax background (simple gradient)
        for y in range(0, SCREEN_HEIGHT, 4):
            shade = min(255, 135 + (y // 4))
            pygame.draw.line(self.screen, (135, 206, shade), (0, y), (SCREEN_WIDTH, y))
        
        # Clouds (decorative)
        for i in range(5):
            cx = (i * 200 - int(self.camera_x * 0.3) % 400) % (SCREEN_WIDTH + 100) - 50
            cy = 80 + i * 60
            pygame.draw.ellipse(self.screen, (255, 255, 255), (cx, cy, 80, 30))
        
        # Tiles
        for tile in self.level["tiles"]:
            if tile.rect.right > self.camera_x - 32 and tile.rect.left < self.camera_x + SCREEN_WIDTH + 32:
                tile.draw(self.screen, self.camera_x, self.sprites)
        
        # Checkpoints
        for cp in self.level["checkpoints"]:
            cp.draw(self.screen, self.camera_x, self.sprites)
        
        # Goal
        self.level["goal"].draw(self.screen, self.camera_x, self.sprites)
        
        # Rings
        for ring in self.level["rings"]:
            ring.draw(self.screen, self.camera_x, self.sprites)
        
        for ring in self.scattered_rings:
            ring.draw(self.screen, self.camera_x)
        
        # Enemies
        for enemy in self.level["enemies"]:
            enemy.draw(self.screen, self.camera_x, self.sprites)
        
        # Player
        self.player.draw(self.screen, self.camera_x, self.sprites)
    
    def _draw_hud(self):
        """Draw heads-up display."""
        # Score
        text = self.font.render(f"SCORE {self.score}", True, (255, 255, 255))
        self.screen.blit(text, (20, 20))
        
        # Rings
        text = self.font.render(f"x{self.rings}", True, (255, 215, 0))
        self.screen.blit(text, (SCREEN_WIDTH - 80, 20))
        if "ring" in self.sprites:
            self.screen.blit(self.sprites["ring"], (SCREEN_WIDTH - 100, 18))
        else:
            pygame.draw.ellipse(self.screen, (255, 215, 0), (SCREEN_WIDTH - 95, 22, 16, 8), 2)
        
        # Lives
        for i in range(self.lives):
            pygame.draw.circle(self.screen, (0, 112, 192), (30 + i * 25, 55), 8)
        
        # Level name
        text = self.font.render(self.level["name"], True, (255, 255, 255))
        self.screen.blit(text, (SCREEN_WIDTH // 2 - text.get_width() // 2, 20))
    
    def _draw_menu(self):
        """Draw main menu."""
        # Background
        self.screen.fill((20, 50, 100))
        for y in range(0, SCREEN_HEIGHT, 3):
            pygame.draw.line(self.screen, (30, 70, 140), (0, y), (SCREEN_WIDTH, y))
        
        title = self.title_font.render("SONIC", True, (0, 112, 192))
        sub = self.font.render("THE HEDGEHOG", True, (255, 255, 255))
        
        self.screen.blit(title, (SCREEN_WIDTH // 2 - title.get_width() // 2, 150))
        self.screen.blit(sub, (SCREEN_WIDTH // 2 - sub.get_width() // 2, 220))
        
        start = self.font.render("PRESS ENTER TO START", True, (255, 215, 0))
        self.screen.blit(start, (SCREEN_WIDTH // 2 - start.get_width() // 2, 350))
        
        ctrl = self.font.render("Arrow Keys: Move | C/Down: Spin Dash | Space: Jump", True, (200, 200, 200))
        self.screen.blit(ctrl, (SCREEN_WIDTH // 2 - ctrl.get_width() // 2, 450))
    
    def _draw_level_complete(self):
        """Draw level complete overlay."""
        overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))
        overlay.set_alpha(180)
        overlay.fill((0, 0, 0))
        self.screen.blit(overlay, (0, 0))
        
        text = self.title_font.render("LEVEL COMPLETE!", True, (255, 215, 0))
        self.screen.blit(text, (SCREEN_WIDTH // 2 - text.get_width() // 2, 250))
        
        next_text = "NEXT ZONE..." if self.current_level < 2 else "CONGRATULATIONS!"
        sub = self.font.render(next_text, True, (255, 255, 255))
        self.screen.blit(sub, (SCREEN_WIDTH // 2 - sub.get_width() // 2, 330))
    
    def _draw_game_over(self):
        """Draw game over screen."""
        self.screen.fill((40, 0, 0))
        text = self.title_font.render("GAME OVER", True, (255, 0, 0))
        self.screen.blit(text, (SCREEN_WIDTH // 2 - text.get_width() // 2, 250))
        
        score_text = self.font.render(f"FINAL SCORE: {self.score}", True, (255, 255, 255))
        self.screen.blit(score_text, (SCREEN_WIDTH // 2 - score_text.get_width() // 2, 350))
        
        sub = self.font.render("Press any key to continue...", True, (200, 200, 200))
        self.screen.blit(sub, (SCREEN_WIDTH // 2 - sub.get_width() // 2, 420))
    
    def start_game(self):
        """Start a new game from the menu."""
        self.lives = INITIAL_LIVES
        self.score = 0
        self.rings = 0
        self.current_level = 1
        self.checkpoint = None
        self.state = "playing"
        self.load_level(1)
    
    def handle_event(self, event):
        """Handle input events."""
        if event.type == pygame.KEYDOWN:
            if self.state == "menu":
                if event.key == pygame.K_RETURN or event.key == pygame.K_SPACE:
                    self.start_game()
            elif self.state == "game_over" or self.state == "level_complete":
                if event.key == pygame.K_RETURN or event.key == pygame.K_SPACE:
                    self.game_over_timer = 0
                    self.level_complete_timer = 0
