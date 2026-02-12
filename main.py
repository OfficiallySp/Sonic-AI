"""Sonic-style 2D platformer built with pygame.

This game is intentionally self-contained and beginner-friendly:
- Run `python generate_assets.py` once to create all art/audio/level files.
- Run `python main.py` to play.
"""

from __future__ import annotations

import json
import math
import random
import sys
from dataclasses import dataclass
from pathlib import Path

import pygame


# Window and simulation tuning.
SCREEN_WIDTH = 960
SCREEN_HEIGHT = 540
TARGET_FPS = 60

GRAVITY = 1900.0
RUN_ACCEL = 2100.0
AIR_ACCEL = 900.0
GROUND_FRICTION = 1600.0
ROLL_FRICTION = 520.0
AIR_DRAG = 60.0
TOP_SPEED = 520.0
TOP_ROLL_SPEED = 760.0
JUMP_SPEED = -760.0

SPINDASH_CHARGE_RATE = 880.0
SPINDASH_MIN_POWER = 400.0
SPINDASH_MAX_POWER = 980.0

PLAYER_INVINCIBILITY = 1.8
RING_SCATTER_LIFETIME = 4.0

STATE_TITLE = "title"
STATE_PLAYING = "playing"
STATE_LEVEL_CLEAR = "level_clear"
STATE_GAME_OVER = "game_over"
STATE_GAME_COMPLETE = "game_complete"

ASSETS_DIR = Path(__file__).parent / "assets"
MAGENTA = (255, 0, 255)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def approach(value: float, target: float, delta: float) -> float:
    if value < target:
        return min(value + delta, target)
    if value > target:
        return max(value - delta, target)
    return target


def ensure_assets_exist() -> None:
    required_files = [
        ASSETS_DIR / "levels" / "level1.json",
        ASSETS_DIR / "levels" / "level2.json",
        ASSETS_DIR / "sprites" / "sonic_idle.bmp",
        ASSETS_DIR / "sprites" / "ring.bmp",
        ASSETS_DIR / "sounds" / "jump.wav",
        ASSETS_DIR / "music" / "zone1_theme.wav",
    ]
    if all(path.exists() for path in required_files):
        return

    print("Assets missing. Generating assets...")
    try:
        from generate_assets import main as generate_assets_main
    except Exception as exc:  # pragma: no cover - startup fallback
        raise RuntimeError("Failed to import generate_assets.py") from exc
    generate_assets_main()


@dataclass
class Ring:
    x: float
    y: float
    collected: bool = False

    @property
    def rect(self) -> pygame.Rect:
        return pygame.Rect(int(self.x), int(self.y), 16, 16)


@dataclass
class ScatteredRing:
    x: float
    y: float
    vx: float
    vy: float
    lifetime: float = RING_SCATTER_LIFETIME

    @property
    def rect(self) -> pygame.Rect:
        return pygame.Rect(int(self.x), int(self.y), 16, 16)

    def update(self, dt: float, solids: list[pygame.Rect]) -> None:
        self.lifetime -= dt
        self.vy += GRAVITY * 0.8 * dt
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.vx *= 0.99

        ring_rect = self.rect
        for solid in solids:
            if not ring_rect.colliderect(solid):
                continue
            if self.vy > 0 and ring_rect.bottom <= solid.top + 20:
                ring_rect.bottom = solid.top
                self.y = float(ring_rect.y)
                self.vy = -abs(self.vy) * 0.45
                if abs(self.vy) < 40:
                    self.vy = 0
            elif self.vy < 0 and ring_rect.top >= solid.bottom - 16:
                ring_rect.top = solid.bottom
                self.y = float(ring_rect.y)
                self.vy *= -0.4


@dataclass
class Enemy:
    x: float
    y: float
    patrol_min: float
    patrol_max: float
    vx: float = 90.0
    vy: float = 0.0
    alive: bool = True

    @property
    def rect(self) -> pygame.Rect:
        return pygame.Rect(int(self.x), int(self.y), 32, 24)

    def update(self, dt: float, solids: list[pygame.Rect]) -> None:
        if not self.alive:
            return

        self.x += self.vx * dt
        if self.x < self.patrol_min:
            self.x = self.patrol_min
            self.vx = abs(self.vx)
        elif self.x > self.patrol_max:
            self.x = self.patrol_max
            self.vx = -abs(self.vx)

        self.vy += GRAVITY * dt
        self.y += self.vy * dt
        body = self.rect
        for solid in solids:
            if body.colliderect(solid) and self.vy > 0 and body.bottom <= solid.top + 24:
                body.bottom = solid.top
                self.y = float(body.y)
                self.vy = 0.0


@dataclass
class Checkpoint:
    x: float
    y: float
    activated: bool = False


class Player:
    """Handles Sonic-like movement, jump, rolling, and spin dash."""

    def __init__(self, x: float, y: float) -> None:
        self.width = 24
        self.normal_height = 32
        self.roll_height = 24
        self.x = x
        self.y = y
        self.vx = 0.0
        self.vy = 0.0
        self.on_ground = False
        self.rolling = False
        self.spindash_charging = False
        self.spindash_power = 0.0
        self.facing = 1
        self.invincible_timer = 0.0
        self.control_lock = 0.0
        self.anim_timer = 0.0

    @property
    def height(self) -> int:
        return self.roll_height if self.rolling else self.normal_height

    @property
    def rect(self) -> pygame.Rect:
        return pygame.Rect(int(self.x), int(self.y), self.width, self.height)

    @property
    def center_x(self) -> float:
        return self.x + self.width * 0.5

    @property
    def center_y(self) -> float:
        return self.y + self.height * 0.5

    def set_rolling(self, rolling: bool) -> None:
        if rolling == self.rolling:
            return
        delta = self.normal_height - self.roll_height
        if rolling:
            self.y += delta
        else:
            self.y -= delta
        self.rolling = rolling

    def can_unroll(self, solids: list[pygame.Rect]) -> bool:
        if not self.rolling:
            return True
        delta = self.normal_height - self.roll_height
        test_rect = pygame.Rect(int(self.x), int(self.y - delta), self.width, self.normal_height)
        return not any(test_rect.colliderect(solid) for solid in solids)

    def reset_to(self, x: float, y: float) -> None:
        self.x = x
        self.y = y
        self.vx = 0.0
        self.vy = 0.0
        self.on_ground = False
        self.rolling = False
        self.spindash_charging = False
        self.spindash_power = 0.0
        self.control_lock = 0.5
        self.invincible_timer = 1.0

    def apply_hurt_knockback(self, source_x: float) -> None:
        direction = -1 if self.center_x < source_x else 1
        self.vx = 320.0 * direction
        self.vy = -520.0
        self.spindash_charging = False
        self.spindash_power = 0.0
        self.set_rolling(True)
        self.control_lock = 0.4
        self.invincible_timer = PLAYER_INVINCIBILITY
        self.on_ground = False

    def is_attacking(self) -> bool:
        return self.rolling or not self.on_ground

    def _move_horizontal(self, dt: float, solids: list[pygame.Rect]) -> None:
        self.x += self.vx * dt
        body = self.rect
        for solid in solids:
            if not body.colliderect(solid):
                continue
            if self.vx > 0:
                body.right = solid.left
            elif self.vx < 0:
                body.left = solid.right
            self.x = float(body.x)
            self.vx = 0.0

    def _move_vertical(self, dt: float, solids: list[pygame.Rect]) -> None:
        self.y += self.vy * dt
        body = self.rect
        self.on_ground = False
        for solid in solids:
            if not body.colliderect(solid):
                continue
            if self.vy > 0 and body.bottom <= solid.top + 28:
                body.bottom = solid.top
                self.y = float(body.y)
                self.vy = 0.0
                self.on_ground = True
            elif self.vy < 0 and body.top >= solid.bottom - 20:
                body.top = solid.bottom
                self.y = float(body.y)
                self.vy = 0.0

    def update(
        self,
        dt: float,
        keys: pygame.key.ScancodeWrapper,
        jump_pressed: bool,
        solids: list[pygame.Rect],
        play_sound: callable,
    ) -> None:
        self.anim_timer += dt
        self.invincible_timer = max(0.0, self.invincible_timer - dt)
        self.control_lock = max(0.0, self.control_lock - dt)

        move_left = keys[pygame.K_LEFT] or keys[pygame.K_a]
        move_right = keys[pygame.K_RIGHT] or keys[pygame.K_d]
        down = keys[pygame.K_DOWN] or keys[pygame.K_s]

        axis = 0
        if move_left:
            axis -= 1
        if move_right:
            axis += 1

        if self.control_lock <= 0.0:
            if axis != 0 and not self.spindash_charging:
                self.facing = axis

            if self.on_ground and down and jump_pressed and abs(self.vx) < 140:
                if not self.spindash_charging:
                    play_sound("spindash")
                self.spindash_charging = True
                self.spindash_power = clamp(self.spindash_power + 280, 0, SPINDASH_MAX_POWER)
                self.set_rolling(True)

            if self.spindash_charging:
                self.spindash_power = clamp(
                    self.spindash_power + SPINDASH_CHARGE_RATE * dt, 0.0, SPINDASH_MAX_POWER
                )
                self.vx *= 0.86
                if not down:
                    launch_speed = max(SPINDASH_MIN_POWER, self.spindash_power)
                    self.vx = launch_speed * self.facing
                    self.spindash_charging = False
                    self.spindash_power = 0.0
                    self.set_rolling(True)
            else:
                accel = RUN_ACCEL if self.on_ground else AIR_ACCEL
                if self.rolling:
                    accel *= 0.45
                self.vx += axis * accel * dt

                if axis == 0:
                    if self.on_ground:
                        friction = ROLL_FRICTION if self.rolling else GROUND_FRICTION
                        self.vx = approach(self.vx, 0.0, friction * dt)
                    else:
                        self.vx = approach(self.vx, 0.0, AIR_DRAG * dt)

                if self.on_ground and down and abs(self.vx) > 160 and not self.rolling:
                    self.set_rolling(True)
                if self.on_ground and not down and abs(self.vx) < 120 and self.rolling and self.can_unroll(solids):
                    self.set_rolling(False)

                if jump_pressed and self.on_ground:
                    self.vy = JUMP_SPEED
                    self.on_ground = False
                    self.set_rolling(True)
                    play_sound("jump")

        speed_cap = TOP_ROLL_SPEED if self.rolling else TOP_SPEED
        self.vx = clamp(self.vx, -speed_cap, speed_cap)
        self.vy += GRAVITY * dt

        self._move_horizontal(dt, solids)
        self._move_vertical(dt, solids)

        # If we stopped rolling and can stand, restore normal shape.
        if self.on_ground and not down and abs(self.vx) < 90 and self.rolling and self.can_unroll(solids):
            self.set_rolling(False)

    def choose_sprite_name(self) -> str:
        if self.spindash_charging:
            return "sonic_roll_1"
        if not self.on_ground:
            return "sonic_jump"
        if self.rolling:
            frame = int(self.anim_timer * 18) % 2
            return f"sonic_roll_{frame}"
        if abs(self.vx) < 80:
            return "sonic_idle"
        frame = int(self.anim_timer * max(8, abs(self.vx) / 26.0)) % 3
        return f"sonic_run_{frame}"


class AssetManager:
    def __init__(self) -> None:
        self.sprites: dict[str, pygame.Surface] = {}
        self.sounds: dict[str, pygame.mixer.Sound] = {}
        self.audio_enabled = pygame.mixer.get_init() is not None
        self._load_sprites()
        self._load_sounds()

    def _load_sprite(self, filename: str, use_colorkey: bool = True) -> pygame.Surface:
        path = ASSETS_DIR / "sprites" / filename
        image = pygame.image.load(str(path)).convert()
        if use_colorkey:
            image.set_colorkey(MAGENTA)
        return image

    def _load_sprites(self) -> None:
        sprite_map = {
            "sonic_idle": "sonic_idle.bmp",
            "sonic_run_0": "sonic_run_0.bmp",
            "sonic_run_1": "sonic_run_1.bmp",
            "sonic_run_2": "sonic_run_2.bmp",
            "sonic_jump": "sonic_jump.bmp",
            "sonic_roll_0": "sonic_roll_0.bmp",
            "sonic_roll_1": "sonic_roll_1.bmp",
            "ring": "ring.bmp",
            "enemy": "enemy.bmp",
            "tile_ground": "tile_ground.bmp",
            "goal_post": "goal_post.bmp",
            "checkpoint": "checkpoint.bmp",
            "title_logo": "title_logo.bmp",
        }
        for key, filename in sprite_map.items():
            self.sprites[key] = self._load_sprite(filename, use_colorkey=True)

        greenhill = self._load_sprite("bg_greenhill.bmp", use_colorkey=False)
        marble = self._load_sprite("bg_marble.bmp", use_colorkey=False)
        self.sprites["bg_greenhill"] = pygame.transform.scale(greenhill, (640, SCREEN_HEIGHT))
        self.sprites["bg_marble"] = pygame.transform.scale(marble, (640, SCREEN_HEIGHT))

    def _load_sounds(self) -> None:
        if not self.audio_enabled:
            return

        sound_map = {
            "jump": "jump.wav",
            "ring": "ring.wav",
            "destroy": "destroy.wav",
            "hurt": "hurt.wav",
            "spindash": "spindash.wav",
            "checkpoint": "checkpoint.wav",
            "goal": "goal.wav",
        }
        for key, filename in sound_map.items():
            path = ASSETS_DIR / "sounds" / filename
            self.sounds[key] = pygame.mixer.Sound(str(path))

    def play_sound(self, name: str) -> None:
        sound = self.sounds.get(name)
        if sound is not None:
            sound.play()

    def play_music(self, filename: str) -> None:
        if not self.audio_enabled:
            return
        path = ASSETS_DIR / "music" / filename
        pygame.mixer.music.load(str(path))
        pygame.mixer.music.play(-1)

    def stop_music(self) -> None:
        if self.audio_enabled:
            pygame.mixer.music.stop()


class SonicCloneGame:
    def __init__(self) -> None:
        ensure_assets_exist()

        pygame.mixer.pre_init(44_100, -16, 1, 512)
        pygame.init()
        try:
            pygame.mixer.init()
        except pygame.error:
            # Game still runs if no audio device is available.
            pass

        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("Sonic Clone - 2D Platformer")
        self.clock = pygame.time.Clock()
        self.assets = AssetManager()

        self.font = pygame.font.SysFont("consolas", 24, bold=True)
        self.big_font = pygame.font.SysFont("consolas", 52, bold=True)

        self.level_paths = [
            ASSETS_DIR / "levels" / "level1.json",
            ASSETS_DIR / "levels" / "level2.json",
        ]

        self.level_index = 0
        self.level_name = ""
        self.level_theme = "greenhill"
        self.level_music = "zone1_theme.wav"
        self.level_width = 4000
        self.level_height = SCREEN_HEIGHT
        self.goal_x = 3600
        self.level_timer = 0.0

        self.platforms: list[pygame.Rect] = []
        self.rings: list[Ring] = []
        self.scattered_rings: list[ScatteredRing] = []
        self.enemies: list[Enemy] = []
        self.checkpoints: list[Checkpoint] = []

        self.player = Player(120, 300)
        self.spawn_point = (120.0, 300.0)
        self.camera_x = 0.0

        self.lives = 3
        self.score = 0
        self.ring_count = 0

        self.state = STATE_TITLE
        self.clear_bonus = 0
        self.state_timer = 0.0

    def start_new_game(self) -> None:
        self.level_index = 0
        self.lives = 3
        self.score = 0
        self.ring_count = 0
        self.load_level(self.level_index)
        self.state = STATE_PLAYING
        self.state_timer = 0.0

    def load_level(self, index: int) -> None:
        level_data = json.loads(self.level_paths[index].read_text(encoding="utf-8"))
        self.level_name = level_data["name"]
        self.level_theme = level_data["theme"]
        self.level_music = level_data["music"]
        self.level_width = int(level_data["width"])
        self.level_height = int(level_data["height"])
        self.goal_x = float(level_data["goal_x"])
        self.level_timer = 0.0
        self.state_timer = 0.0
        self.clear_bonus = 0

        start_x, start_y = level_data["start"]
        self.spawn_point = (float(start_x), float(start_y))
        self.player.reset_to(*self.spawn_point)
        self.player.control_lock = 0.0
        self.player.invincible_timer = 0.0

        self.platforms = [pygame.Rect(*platform) for platform in level_data["platforms"]]
        # World boundary floor catches any edge cases with movement.
        self.platforms.append(pygame.Rect(-200, self.level_height, self.level_width + 400, 300))

        self.rings = [Ring(float(x), float(y)) for x, y in level_data["rings"]]
        self.scattered_rings = []
        self.enemies = [
            Enemy(
                x=float(enemy["x"]),
                y=float(enemy["y"]),
                patrol_min=float(enemy["min_x"]),
                patrol_max=float(enemy["max_x"]),
            )
            for enemy in level_data["enemies"]
        ]
        self.checkpoints = [Checkpoint(float(x), float(y)) for x, y in level_data["checkpoints"]]
        self.camera_x = clamp(self.player.center_x - SCREEN_WIDTH * 0.45, 0, max(0, self.level_width - SCREEN_WIDTH))

        try:
            self.assets.play_music(self.level_music)
        except pygame.error:
            # Keep going even if a machine cannot play music.
            pass

    def lose_life(self) -> None:
        self.lives -= 1
        self.ring_count = 0
        self.scattered_rings.clear()
        if self.lives <= 0:
            self.assets.stop_music()
            self.state = STATE_GAME_OVER
            self.state_timer = 0.0
            return

        self.player.reset_to(*self.spawn_point)

    def spawn_scattered_rings(self, amount: int) -> None:
        amount = min(amount, 20)
        origin_x = self.player.center_x - 8
        origin_y = self.player.center_y - 8
        for index in range(amount):
            # Spread in a fan shape so rings bounce out dramatically.
            angle = math.radians(15 + (150 / max(1, amount - 1)) * index)
            speed = random.uniform(220, 420)
            vx = math.cos(angle) * speed * random.choice([-1.0, 1.0])
            vy = -math.sin(angle) * speed - random.uniform(80, 220)
            self.scattered_rings.append(ScatteredRing(origin_x, origin_y, vx, vy))

    def hurt_player(self, source_x: float) -> None:
        if self.player.invincible_timer > 0:
            return

        if self.ring_count > 0:
            self.spawn_scattered_rings(self.ring_count)
            self.ring_count = 0
            self.player.apply_hurt_knockback(source_x)
            self.assets.play_sound("hurt")
        else:
            self.lose_life()
            self.assets.play_sound("hurt")

    def clear_level(self) -> None:
        time_bonus = max(0, 50_000 - int(self.level_timer * 125))
        ring_bonus = self.ring_count * 100
        self.clear_bonus = time_bonus + ring_bonus
        self.score += self.clear_bonus + 5000
        self.assets.play_sound("goal")
        self.state = STATE_LEVEL_CLEAR
        self.state_timer = 0.0

    def advance_level(self) -> None:
        self.level_index += 1
        self.ring_count = 0
        if self.level_index >= len(self.level_paths):
            self.assets.stop_music()
            self.state = STATE_GAME_COMPLETE
            self.state_timer = 0.0
            return
        self.load_level(self.level_index)
        self.state = STATE_PLAYING

    def _update_playing(self, dt: float, keys: pygame.key.ScancodeWrapper, jump_pressed: bool) -> None:
        self.level_timer += dt
        self.player.update(dt, keys, jump_pressed, self.platforms, self.assets.play_sound)

        if self.player.y > self.level_height + 180:
            self.lose_life()
            return

        for checkpoint in self.checkpoints:
            if checkpoint.activated:
                continue
            if self.player.center_x >= checkpoint.x:
                checkpoint.activated = True
                self.spawn_point = (checkpoint.x - 20.0, checkpoint.y - self.player.normal_height)
                self.assets.play_sound("checkpoint")

        for ring in self.rings:
            if ring.collected:
                continue
            if self.player.rect.colliderect(ring.rect):
                ring.collected = True
                self.ring_count += 1
                self.score += 100
                self.assets.play_sound("ring")

        for scattered in list(self.scattered_rings):
            scattered.update(dt, self.platforms)
            if scattered.lifetime <= 0:
                self.scattered_rings.remove(scattered)
                continue
            if self.player.rect.colliderect(scattered.rect):
                self.scattered_rings.remove(scattered)
                self.ring_count += 1
                self.score += 50
                self.assets.play_sound("ring")

        for enemy in self.enemies:
            enemy.update(dt, self.platforms)
            if not enemy.alive:
                continue
            if not self.player.rect.colliderect(enemy.rect):
                continue

            stomp_hit = self.player.vy > 90 and self.player.rect.bottom <= enemy.rect.top + 16
            if stomp_hit or self.player.is_attacking():
                enemy.alive = False
                self.player.vy = -420
                self.player.on_ground = False
                self.score += 1000
                self.assets.play_sound("destroy")
            else:
                self.hurt_player(enemy.rect.centerx)

        if self.player.center_x >= self.goal_x:
            self.clear_level()
            return

        camera_target = self.player.center_x - SCREEN_WIDTH * 0.42 + self.player.vx * 0.15
        max_camera = max(0.0, self.level_width - SCREEN_WIDTH)
        self.camera_x = clamp(approach(self.camera_x, camera_target, 1200 * dt), 0.0, max_camera)

    def update(self, dt: float, keys: pygame.key.ScancodeWrapper, jump_pressed: bool, confirm_pressed: bool) -> None:
        self.state_timer += dt

        if self.state == STATE_TITLE:
            if confirm_pressed:
                self.start_new_game()
            return

        if self.state == STATE_PLAYING:
            self._update_playing(dt, keys, jump_pressed)
            return

        if self.state == STATE_LEVEL_CLEAR:
            if confirm_pressed or self.state_timer >= 2.5:
                self.advance_level()
            return

        if self.state in (STATE_GAME_OVER, STATE_GAME_COMPLETE):
            if confirm_pressed:
                self.state = STATE_TITLE
                self.state_timer = 0.0
            return

    def draw_background(self) -> None:
        bg_key = "bg_greenhill" if self.level_theme == "greenhill" else "bg_marble"
        background = self.assets.sprites[bg_key]
        bg_width = background.get_width()

        # Parallax movement keeps the scene feeling fast.
        parallax = -(self.camera_x * 0.30) % bg_width
        for offset in range(-1, SCREEN_WIDTH // bg_width + 3):
            self.screen.blit(background, (parallax + offset * bg_width, 0))

    def draw_world(self) -> None:
        self.draw_background()

        tile = self.assets.sprites["tile_ground"]
        tile_w, tile_h = tile.get_size()
        left_edge = self.camera_x - tile_w
        right_edge = self.camera_x + SCREEN_WIDTH + tile_w

        for platform in self.platforms:
            if platform.bottom < 0 or platform.top > SCREEN_HEIGHT:
                continue
            if platform.right < left_edge or platform.left > right_edge:
                continue
            for x in range(platform.left, platform.right, tile_w):
                for y in range(platform.top, platform.bottom, tile_h):
                    self.screen.blit(tile, (x - self.camera_x, y))

        goal_post = self.assets.sprites["goal_post"]
        goal_x = self.goal_x - self.camera_x
        self.screen.blit(goal_post, (goal_x, self.level_height - goal_post.get_height() - 80))

        checkpoint_sprite = self.assets.sprites["checkpoint"]
        for checkpoint in self.checkpoints:
            screen_pos = (checkpoint.x - self.camera_x, checkpoint.y - checkpoint_sprite.get_height())
            self.screen.blit(checkpoint_sprite, screen_pos)
            flag_color = (80, 240, 120) if checkpoint.activated else (235, 85, 70)
            pygame.draw.circle(
                self.screen,
                flag_color,
                (int(screen_pos[0] + checkpoint_sprite.get_width() * 0.5), int(screen_pos[1] + 9)),
                4,
            )

        ring_sprite = self.assets.sprites["ring"]
        for ring in self.rings:
            if ring.collected:
                continue
            self.screen.blit(ring_sprite, (ring.x - self.camera_x, ring.y))

        for ring in self.scattered_rings:
            self.screen.blit(ring_sprite, (ring.x - self.camera_x, ring.y))

        enemy_sprite = self.assets.sprites["enemy"]
        for enemy in self.enemies:
            if not enemy.alive:
                continue
            draw_sprite = enemy_sprite if enemy.vx >= 0 else pygame.transform.flip(enemy_sprite, True, False)
            self.screen.blit(draw_sprite, (enemy.x - self.camera_x, enemy.y))

        # Flicker while invincible to communicate temporary damage immunity.
        if self.player.invincible_timer <= 0 or int(self.player.invincible_timer * 20) % 2 == 0:
            player_sprite = self.assets.sprites[self.player.choose_sprite_name()]
            if self.player.facing < 0:
                player_sprite = pygame.transform.flip(player_sprite, True, False)
            draw_x = self.player.x - self.camera_x
            draw_y = self.player.y
            if self.player.rolling and player_sprite.get_height() != self.player.height:
                draw_y -= max(0, player_sprite.get_height() - self.player.height)
            self.screen.blit(player_sprite, (draw_x, draw_y))

    def draw_hud(self) -> None:
        hud_color = (255, 255, 255)
        info = [
            f"SCORE {self.score:06d}",
            f"RINGS {self.ring_count:03d}",
            f"LIVES {self.lives}",
            f"TIME {int(self.level_timer):03d}",
        ]
        for idx, text in enumerate(info):
            label = self.font.render(text, True, hud_color)
            self.screen.blit(label, (18, 12 + idx * 28))

        level_label = self.font.render(self.level_name, True, (245, 220, 90))
        self.screen.blit(level_label, (SCREEN_WIDTH - level_label.get_width() - 18, 14))

    def draw_title(self) -> None:
        self.screen.fill((15, 22, 45))
        logo = self.assets.sprites["title_logo"]
        self.screen.blit(logo, ((SCREEN_WIDTH - logo.get_width()) // 2, 120))

        title = self.big_font.render("SONIC CLONE", True, (255, 255, 255))
        self.screen.blit(title, ((SCREEN_WIDTH - title.get_width()) // 2, 70))

        lines = [
            "Arrow Keys / A,D: Move",
            "Space / Z: Jump",
            "Hold Down + Jump: Charge Spin Dash, Release Down to launch",
            "Down while running: Roll attack",
            "Press Enter to Start",
        ]
        for i, line in enumerate(lines):
            color = (235, 235, 235) if i < 4 else (255, 220, 90)
            msg = self.font.render(line, True, color)
            self.screen.blit(msg, ((SCREEN_WIDTH - msg.get_width()) // 2, 260 + i * 34))

    def draw_level_clear(self) -> None:
        self.draw_world()
        self.draw_hud()
        overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 150))
        self.screen.blit(overlay, (0, 0))

        title = self.big_font.render("LEVEL CLEAR!", True, (245, 240, 120))
        self.screen.blit(title, ((SCREEN_WIDTH - title.get_width()) // 2, 150))

        bonus_lines = [
            f"Ring Bonus: {self.ring_count * 100}",
            f"Time Bonus: {max(0, 50_000 - int(self.level_timer * 125))}",
            f"Total Bonus: {self.clear_bonus}",
            "Press Enter for next zone",
        ]
        for i, line in enumerate(bonus_lines):
            color = (255, 255, 255) if i < 3 else (245, 220, 90)
            msg = self.font.render(line, True, color)
            self.screen.blit(msg, ((SCREEN_WIDTH - msg.get_width()) // 2, 250 + i * 34))

    def draw_end_screen(self, game_complete: bool) -> None:
        self.screen.fill((20, 20, 30))
        title_text = "YOU WIN!" if game_complete else "GAME OVER"
        title_color = (120, 245, 145) if game_complete else (245, 100, 100)

        title = self.big_font.render(title_text, True, title_color)
        self.screen.blit(title, ((SCREEN_WIDTH - title.get_width()) // 2, 170))

        score_label = self.font.render(f"Final Score: {self.score}", True, (255, 255, 255))
        self.screen.blit(score_label, ((SCREEN_WIDTH - score_label.get_width()) // 2, 270))

        prompt = self.font.render("Press Enter to return to title", True, (245, 220, 90))
        self.screen.blit(prompt, ((SCREEN_WIDTH - prompt.get_width()) // 2, 330))

    def draw(self) -> None:
        if self.state == STATE_TITLE:
            self.draw_title()
            return
        if self.state == STATE_PLAYING:
            self.draw_world()
            self.draw_hud()
            return
        if self.state == STATE_LEVEL_CLEAR:
            self.draw_level_clear()
            return
        if self.state == STATE_GAME_OVER:
            self.draw_end_screen(game_complete=False)
            return
        if self.state == STATE_GAME_COMPLETE:
            self.draw_end_screen(game_complete=True)
            return

    def run(self) -> None:
        running = True
        while running:
            dt = self.clock.tick(TARGET_FPS) / 1000.0
            jump_pressed = False
            confirm_pressed = False

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key in (pygame.K_ESCAPE,):
                        running = False
                    if event.key in (pygame.K_SPACE, pygame.K_z):
                        jump_pressed = True
                    if event.key in (pygame.K_RETURN, pygame.K_KP_ENTER):
                        confirm_pressed = True

            keys = pygame.key.get_pressed()
            self.update(dt, keys, jump_pressed, confirm_pressed)
            self.draw()
            pygame.display.flip()

        pygame.quit()
        sys.exit(0)


def main() -> None:
    SonicCloneGame().run()


if __name__ == "__main__":
    main()
