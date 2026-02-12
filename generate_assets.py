"""Create simple pixel-art assets, sounds, music, and level data.

The generated assets are intentionally lightweight and license-safe so the
project can run out of the box on a fresh machine.
"""

from __future__ import annotations

import json
import math
import random
import struct
import wave
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).parent
ASSETS_DIR = ROOT / "assets"
SPRITES_DIR = ASSETS_DIR / "sprites"
SOUNDS_DIR = ASSETS_DIR / "sounds"
MUSIC_DIR = ASSETS_DIR / "music"
LEVELS_DIR = ASSETS_DIR / "levels"

MAGENTA = (255, 0, 255)


def ensure_directories() -> None:
    for directory in (SPRITES_DIR, SOUNDS_DIR, MUSIC_DIR, LEVELS_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def new_canvas(width: int, height: int, color: tuple[int, int, int]) -> list[list[tuple[int, int, int]]]:
    return [[color for _ in range(width)] for _ in range(height)]


def put_pixel(canvas: list[list[tuple[int, int, int]]], x: int, y: int, color: tuple[int, int, int]) -> None:
    if 0 <= y < len(canvas) and 0 <= x < len(canvas[0]):
        canvas[y][x] = color


def draw_rect(
    canvas: list[list[tuple[int, int, int]]],
    x: int,
    y: int,
    width: int,
    height: int,
    color: tuple[int, int, int],
) -> None:
    for yy in range(y, y + height):
        for xx in range(x, x + width):
            put_pixel(canvas, xx, yy, color)


def draw_circle(
    canvas: list[list[tuple[int, int, int]]],
    cx: int,
    cy: int,
    radius: int,
    color: tuple[int, int, int],
) -> None:
    radius_sq = radius * radius
    for yy in range(cy - radius, cy + radius + 1):
        for xx in range(cx - radius, cx + radius + 1):
            dx = xx - cx
            dy = yy - cy
            if dx * dx + dy * dy <= radius_sq:
                put_pixel(canvas, xx, yy, color)


def draw_ring(
    canvas: list[list[tuple[int, int, int]]],
    cx: int,
    cy: int,
    inner_radius: int,
    outer_radius: int,
    color: tuple[int, int, int],
) -> None:
    inner_sq = inner_radius * inner_radius
    outer_sq = outer_radius * outer_radius
    for yy in range(cy - outer_radius, cy + outer_radius + 1):
        for xx in range(cx - outer_radius, cx + outer_radius + 1):
            dx = xx - cx
            dy = yy - cy
            dist_sq = dx * dx + dy * dy
            if inner_sq <= dist_sq <= outer_sq:
                put_pixel(canvas, xx, yy, color)


def save_bmp(path: Path, canvas: list[list[tuple[int, int, int]]]) -> None:
    """Save a 24-bit uncompressed BMP file."""
    height = len(canvas)
    width = len(canvas[0])
    row_size = (width * 3 + 3) & ~3
    pixel_data_size = row_size * height
    file_size = 54 + pixel_data_size

    with path.open("wb") as bmp_file:
        bmp_file.write(b"BM")
        bmp_file.write(struct.pack("<I", file_size))
        bmp_file.write(struct.pack("<HH", 0, 0))
        bmp_file.write(struct.pack("<I", 54))
        bmp_file.write(struct.pack("<I", 40))  # DIB header size
        bmp_file.write(struct.pack("<i", width))
        bmp_file.write(struct.pack("<i", height))
        bmp_file.write(struct.pack("<H", 1))
        bmp_file.write(struct.pack("<H", 24))
        bmp_file.write(struct.pack("<I", 0))  # BI_RGB
        bmp_file.write(struct.pack("<I", pixel_data_size))
        bmp_file.write(struct.pack("<i", 2835))  # pixels/meter (~72 DPI)
        bmp_file.write(struct.pack("<i", 2835))
        bmp_file.write(struct.pack("<I", 0))
        bmp_file.write(struct.pack("<I", 0))

        padding = b"\x00" * (row_size - width * 3)
        for y in range(height - 1, -1, -1):  # BMP stores rows bottom-up
            row = canvas[y]
            for r, g, b in row:
                bmp_file.write(struct.pack("BBB", b, g, r))
            bmp_file.write(padding)


def create_sonic_idle() -> list[list[tuple[int, int, int]]]:
    c = new_canvas(24, 32, MAGENTA)
    blue = (25, 105, 245)
    skin = (255, 220, 170)
    red = (230, 40, 50)
    white = (245, 245, 245)
    black = (20, 20, 20)

    draw_circle(c, 12, 10, 7, blue)
    draw_circle(c, 12, 22, 8, blue)
    draw_circle(c, 12, 15, 4, skin)
    draw_rect(c, 10, 5, 2, 4, white)
    draw_rect(c, 12, 5, 2, 4, white)
    draw_rect(c, 11, 7, 1, 2, black)
    draw_rect(c, 13, 7, 1, 2, black)
    draw_rect(c, 8, 31, 4, 1, white)
    draw_rect(c, 13, 31, 4, 1, white)
    draw_rect(c, 8, 26, 4, 5, red)
    draw_rect(c, 13, 26, 4, 5, red)
    return c


def create_sonic_run(frame: int) -> list[list[tuple[int, int, int]]]:
    c = create_sonic_idle()
    clear = MAGENTA
    for y in range(24, 32):
        for x in range(6, 18):
            if c[y][x] == (230, 40, 50) or c[y][x] == (245, 245, 245):
                c[y][x] = clear

    offsets = [(-2, 2), (0, 0), (2, -2)][frame % 3]
    left_offset, right_offset = offsets
    draw_rect(c, 7 + left_offset, 26, 4, 5, (230, 40, 50))
    draw_rect(c, 12 + right_offset, 26, 4, 5, (230, 40, 50))
    draw_rect(c, 7 + left_offset, 31, 4, 1, (245, 245, 245))
    draw_rect(c, 12 + right_offset, 31, 4, 1, (245, 245, 245))
    return c


def create_sonic_jump() -> list[list[tuple[int, int, int]]]:
    c = new_canvas(24, 24, MAGENTA)
    blue = (25, 105, 245)
    skin = (255, 220, 170)
    draw_circle(c, 12, 12, 10, blue)
    draw_circle(c, 12, 12, 4, skin)
    draw_rect(c, 6, 19, 4, 3, (230, 40, 50))
    draw_rect(c, 14, 4, 4, 3, (230, 40, 50))
    return c


def create_sonic_roll(frame: int) -> list[list[tuple[int, int, int]]]:
    c = new_canvas(24, 24, MAGENTA)
    blue = (25, 105, 245)
    alt = (35, 130, 255)
    skin = (255, 220, 170)
    draw_circle(c, 12, 12, 10, blue if frame == 0 else alt)
    draw_ring(c, 12, 12, 4, 7, skin if frame == 0 else (240, 200, 140))
    return c


def create_enemy() -> list[list[tuple[int, int, int]]]:
    c = new_canvas(32, 24, MAGENTA)
    red = (210, 45, 35)
    dark = (40, 40, 40)
    yellow = (230, 210, 60)
    draw_circle(c, 16, 11, 9, red)
    draw_rect(c, 7, 18, 6, 4, dark)
    draw_rect(c, 19, 18, 6, 4, dark)
    draw_rect(c, 11, 9, 3, 3, yellow)
    draw_rect(c, 18, 9, 3, 3, yellow)
    draw_rect(c, 12, 10, 1, 1, dark)
    draw_rect(c, 19, 10, 1, 1, dark)
    return c


def create_ring_sprite() -> list[list[tuple[int, int, int]]]:
    c = new_canvas(16, 16, MAGENTA)
    draw_ring(c, 8, 8, 4, 6, (245, 210, 40))
    draw_ring(c, 8, 8, 5, 5, (255, 238, 120))
    return c


def create_tile_sprite() -> list[list[tuple[int, int, int]]]:
    random.seed(7)
    c = new_canvas(64, 64, (128, 88, 40))
    for y in range(0, 16):
        for x in range(64):
            green = 110 + ((x + y) % 20)
            c[y][x] = (60, green, 40)
    for y in range(16, 64):
        for x in range(64):
            jitter = random.randint(-12, 12)
            r = max(80, min(160, 130 + jitter))
            g = max(50, min(120, 90 + jitter // 2))
            b = max(25, min(80, 45 + jitter // 3))
            c[y][x] = (r, g, b)
    return c


def create_goal_post() -> list[list[tuple[int, int, int]]]:
    c = new_canvas(24, 96, MAGENTA)
    draw_rect(c, 10, 4, 4, 88, (230, 230, 230))
    draw_rect(c, 6, 8, 12, 5, (220, 40, 40))
    draw_rect(c, 7, 40, 10, 24, (245, 245, 245))
    draw_rect(c, 8, 41, 8, 22, (20, 20, 20))
    draw_rect(c, 9, 42, 6, 20, (245, 245, 245))
    return c


def create_checkpoint() -> list[list[tuple[int, int, int]]]:
    c = new_canvas(20, 72, MAGENTA)
    draw_rect(c, 9, 2, 2, 66, (220, 220, 220))
    draw_rect(c, 3, 8, 14, 6, (40, 130, 255))
    draw_ring(c, 10, 11, 2, 4, (245, 210, 40))
    return c


def create_logo() -> list[list[tuple[int, int, int]]]:
    c = new_canvas(320, 90, MAGENTA)
    draw_rect(c, 8, 8, 304, 74, (10, 40, 130))
    draw_rect(c, 12, 12, 296, 66, (35, 130, 245))
    draw_rect(c, 20, 22, 280, 46, (245, 210, 40))
    draw_rect(c, 28, 30, 264, 30, (20, 20, 20))
    # A simple stylized "SONIC CLONE"
    for x in range(44, 280):
        if x % 12 < 8:
            for y in range(36, 54):
                c[y][x] = (245, 245, 245)
    return c


def create_background_greenhill() -> list[list[tuple[int, int, int]]]:
    width = 640
    height = 360
    c = new_canvas(width, height, (100, 180, 255))
    for y in range(height):
        shade = int(40 * y / height)
        for x in range(width):
            c[y][x] = (100 - shade // 3, 180 - shade // 2, 255 - shade)

    # Distant hills
    for x in range(-80, width + 100, 120):
        draw_circle(c, x + 60, 280, 90, (75, 160, 90))
        draw_circle(c, x + 70, 290, 75, (60, 145, 75))

    # Clouds
    for cloud_x, cloud_y in [(90, 75), (260, 55), (470, 95)]:
        draw_circle(c, cloud_x, cloud_y, 18, (250, 250, 255))
        draw_circle(c, cloud_x + 20, cloud_y + 4, 16, (250, 250, 255))
        draw_circle(c, cloud_x - 20, cloud_y + 6, 14, (250, 250, 255))

    return c


def create_background_marble() -> list[list[tuple[int, int, int]]]:
    width = 640
    height = 360
    c = new_canvas(width, height, (48, 40, 72))
    for y in range(height):
        shade = int(50 * y / height)
        for x in range(width):
            c[y][x] = (48 + shade // 4, 40 + shade // 8, 72 + shade // 2)

    for x in range(20, width, 120):
        draw_rect(c, x, 120, 28, 220, (92, 84, 118))
        draw_rect(c, x + 2, 122, 24, 216, (70, 64, 98))
        draw_rect(c, x - 4, 110, 36, 12, (110, 100, 140))
    return c


def generate_sprites() -> None:
    save_bmp(SPRITES_DIR / "sonic_idle.bmp", create_sonic_idle())
    save_bmp(SPRITES_DIR / "sonic_run_0.bmp", create_sonic_run(0))
    save_bmp(SPRITES_DIR / "sonic_run_1.bmp", create_sonic_run(1))
    save_bmp(SPRITES_DIR / "sonic_run_2.bmp", create_sonic_run(2))
    save_bmp(SPRITES_DIR / "sonic_jump.bmp", create_sonic_jump())
    save_bmp(SPRITES_DIR / "sonic_roll_0.bmp", create_sonic_roll(0))
    save_bmp(SPRITES_DIR / "sonic_roll_1.bmp", create_sonic_roll(1))
    save_bmp(SPRITES_DIR / "ring.bmp", create_ring_sprite())
    save_bmp(SPRITES_DIR / "enemy.bmp", create_enemy())
    save_bmp(SPRITES_DIR / "tile_ground.bmp", create_tile_sprite())
    save_bmp(SPRITES_DIR / "goal_post.bmp", create_goal_post())
    save_bmp(SPRITES_DIR / "checkpoint.bmp", create_checkpoint())
    save_bmp(SPRITES_DIR / "title_logo.bmp", create_logo())
    save_bmp(SPRITES_DIR / "bg_greenhill.bmp", create_background_greenhill())
    save_bmp(SPRITES_DIR / "bg_marble.bmp", create_background_marble())


def write_wav(path: Path, samples: Iterable[float], sample_rate: int = 44_100) -> None:
    clipped = [max(-1.0, min(1.0, sample)) for sample in samples]
    pcm = b"".join(struct.pack("<h", int(sample * 32767)) for sample in clipped)
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm)


def make_tone(
    frequency: float,
    duration: float,
    sample_rate: int = 44_100,
    volume: float = 0.4,
    wave_type: str = "sine",
) -> list[float]:
    count = max(1, int(duration * sample_rate))
    result: list[float] = []
    for i in range(count):
        t = i / sample_rate
        phase = 2.0 * math.pi * frequency * t
        if wave_type == "square":
            base = 1.0 if math.sin(phase) >= 0 else -1.0
        elif wave_type == "triangle":
            base = 2.0 * abs(2.0 * ((frequency * t) % 1.0) - 1.0) - 1.0
        else:
            base = math.sin(phase)

        attack = min(1.0, i / max(1, int(sample_rate * 0.01)))
        release = min(1.0, (count - i) / max(1, int(sample_rate * 0.04)))
        envelope = min(attack, release)
        result.append(base * volume * envelope)
    return result


def make_chirp(
    start_freq: float,
    end_freq: float,
    duration: float,
    sample_rate: int = 44_100,
    volume: float = 0.5,
) -> list[float]:
    count = max(1, int(duration * sample_rate))
    result: list[float] = []
    phase = 0.0
    for i in range(count):
        progress = i / max(1, count - 1)
        freq = start_freq + (end_freq - start_freq) * progress
        phase += 2.0 * math.pi * freq / sample_rate
        value = math.sin(phase)
        envelope = min(1.0, i / (count * 0.15), (count - i) / (count * 0.2))
        result.append(value * volume * envelope)
    return result


def silence(duration: float, sample_rate: int = 44_100) -> list[float]:
    return [0.0] * max(1, int(duration * sample_rate))


def generate_sound_effects() -> None:
    jump = make_chirp(420, 760, 0.14, volume=0.6)
    ring = make_tone(1400, 0.05, volume=0.45) + make_tone(2000, 0.08, volume=0.3)
    destroy = make_tone(180, 0.08, volume=0.5, wave_type="square") + make_chirp(400, 120, 0.1, volume=0.45)
    hurt = make_chirp(550, 180, 0.24, volume=0.6)
    spin = make_tone(320, 0.11, volume=0.5, wave_type="triangle")
    checkpoint = make_tone(880, 0.09, volume=0.4) + make_tone(990, 0.09, volume=0.35)
    goal = make_tone(780, 0.12, volume=0.45) + make_tone(1040, 0.14, volume=0.35)

    write_wav(SOUNDS_DIR / "jump.wav", jump)
    write_wav(SOUNDS_DIR / "ring.wav", ring)
    write_wav(SOUNDS_DIR / "destroy.wav", destroy)
    write_wav(SOUNDS_DIR / "hurt.wav", hurt)
    write_wav(SOUNDS_DIR / "spindash.wav", spin)
    write_wav(SOUNDS_DIR / "checkpoint.wav", checkpoint)
    write_wav(SOUNDS_DIR / "goal.wav", goal)


NOTE_FREQ = {
    "C4": 261.63,
    "D4": 293.66,
    "E4": 329.63,
    "F4": 349.23,
    "G4": 392.00,
    "A4": 440.00,
    "B4": 493.88,
    "C5": 523.25,
    "D5": 587.33,
    "E5": 659.25,
    "G3": 196.00,
    "A3": 220.00,
    "B3": 246.94,
}


def compose_music(sequence: list[tuple[str, float]], bpm: int, wave_type: str = "triangle") -> list[float]:
    beat = 60.0 / bpm
    song: list[float] = []
    for note, beats in sequence:
        duration = beat * beats
        if note == "REST":
            song.extend(silence(duration))
        else:
            song.extend(make_tone(NOTE_FREQ[note], duration, volume=0.22, wave_type=wave_type))
    return song


def generate_music() -> None:
    theme_one = [
        ("E4", 0.5), ("G4", 0.5), ("A4", 0.5), ("E4", 0.5),
        ("D4", 0.5), ("E4", 0.5), ("G4", 0.5), ("A4", 0.5),
        ("C5", 0.5), ("B4", 0.5), ("A4", 0.5), ("G4", 0.5),
        ("E4", 1.0), ("REST", 0.5), ("G4", 0.5), ("A4", 1.0),
    ]
    theme_two = [
        ("A3", 0.5), ("C4", 0.5), ("E4", 0.5), ("A4", 0.5),
        ("G4", 0.5), ("E4", 0.5), ("D4", 0.5), ("C4", 0.5),
        ("B3", 0.5), ("D4", 0.5), ("F4", 0.5), ("A4", 0.5),
        ("G4", 1.0), ("REST", 0.5), ("E4", 0.5), ("C4", 1.0),
    ]

    write_wav(MUSIC_DIR / "zone1_theme.wav", compose_music(theme_one * 2, bpm=145, wave_type="triangle"))
    write_wav(MUSIC_DIR / "zone2_theme.wav", compose_music(theme_two * 2, bpm=132, wave_type="square"))


def ring_line(start_x: int, start_y: int, count: int, spacing: int) -> list[list[int]]:
    return [[start_x + i * spacing, start_y] for i in range(count)]


def ring_arc(center_x: int, center_y: int, radius: int, count: int) -> list[list[int]]:
    points: list[list[int]] = []
    for i in range(count):
        angle = math.pi * i / max(1, count - 1)
        x = int(center_x + math.cos(angle) * radius)
        y = int(center_y - math.sin(angle) * radius)
        points.append([x, y])
    return points


def generate_levels() -> None:
    level1_rings: list[list[int]] = []
    level1_rings += ring_line(250, 410, 10, 28)
    level1_rings += ring_line(980, 410, 12, 28)
    level1_rings += ring_arc(1680, 360, 110, 10)
    level1_rings += ring_line(2500, 280, 8, 24)
    level1_rings += ring_line(3320, 220, 9, 24)

    level2_rings: list[list[int]] = []
    level2_rings += ring_line(300, 405, 12, 26)
    level2_rings += ring_arc(1240, 330, 120, 12)
    level2_rings += ring_line(1980, 235, 12, 22)
    level2_rings += ring_line(2860, 295, 10, 24)
    level2_rings += ring_arc(3620, 300, 130, 12)

    level1 = {
        "name": "Emerald Sprint Zone",
        "theme": "greenhill",
        "background": "bg_greenhill.bmp",
        "music": "zone1_theme.wav",
        "width": 4300,
        "height": 540,
        "start": [120, 360],
        "goal_x": 4040,
        "platforms": [
            [0, 460, 740, 80],
            [860, 460, 620, 80],
            [1580, 460, 580, 80],
            [2240, 460, 640, 80],
            [2960, 460, 540, 80],
            [3600, 460, 700, 80],
            [460, 385, 220, 20],
            [1180, 355, 170, 20],
            [1500, 310, 160, 20],
            [1880, 320, 220, 20],
            [2460, 275, 200, 20],
            [3140, 220, 250, 20],
            [3440, 260, 160, 20],
        ],
        "rings": level1_rings,
        "enemies": [
            {"x": 620, "y": 432, "min_x": 520, "max_x": 700},
            {"x": 1090, "y": 432, "min_x": 980, "max_x": 1400},
            {"x": 1750, "y": 432, "min_x": 1640, "max_x": 2100},
            {"x": 2460, "y": 432, "min_x": 2320, "max_x": 2800},
            {"x": 3350, "y": 432, "min_x": 3080, "max_x": 3480},
        ],
        "checkpoints": [[1470, 390], [3000, 390]],
    }

    level2 = {
        "name": "Marble Dash Zone",
        "theme": "marble",
        "background": "bg_marble.bmp",
        "music": "zone2_theme.wav",
        "width": 4700,
        "height": 540,
        "start": [120, 360],
        "goal_x": 4420,
        "platforms": [
            [0, 460, 800, 80],
            [920, 460, 520, 80],
            [1540, 460, 500, 80],
            [2140, 460, 660, 80],
            [2920, 460, 560, 80],
            [3640, 460, 1060, 80],
            [480, 360, 180, 20],
            [1060, 310, 180, 20],
            [1320, 260, 180, 20],
            [1900, 245, 220, 20],
            [2520, 300, 190, 20],
            [3280, 250, 200, 20],
            [3860, 320, 220, 20],
        ],
        "rings": level2_rings,
        "enemies": [
            {"x": 520, "y": 432, "min_x": 160, "max_x": 760},
            {"x": 1160, "y": 432, "min_x": 980, "max_x": 1360},
            {"x": 1780, "y": 432, "min_x": 1600, "max_x": 1980},
            {"x": 2430, "y": 432, "min_x": 2240, "max_x": 2760},
            {"x": 3320, "y": 432, "min_x": 3000, "max_x": 3450},
            {"x": 4080, "y": 432, "min_x": 3700, "max_x": 4400},
        ],
        "checkpoints": [[1740, 390], [3320, 390]],
    }

    (LEVELS_DIR / "level1.json").write_text(json.dumps(level1, indent=2), encoding="utf-8")
    (LEVELS_DIR / "level2.json").write_text(json.dumps(level2, indent=2), encoding="utf-8")


def main() -> None:
    ensure_directories()
    generate_sprites()
    generate_sound_effects()
    generate_music()
    generate_levels()
    print("Assets generated in ./assets")


if __name__ == "__main__":
    main()
