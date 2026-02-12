"""
Sonic the Hedgehog Clone - Level System
Loads and manages level data, tiles, rings, enemies, checkpoints.
"""

import os
from tile import Tile, Checkpoint, GoalPost
from enemy import Enemy, EnemyCrab, EnemyBuzz
from ring import Ring


def _generate_level_1():
    """Generate Green Hill Zone - classic rolling hills."""
    tiles = []
    t = 32  # tile size
    
    # Ground base - continuous floor from 0 to 120 tiles
    for x in range(0, 120 * t, t):
        for row in range(4):
            tile_type = "grass" if row == 0 else "dirt"
            tiles.append((tile_type, x, 400 + row * t))
    
    # Hills - elevated platforms
    def add_hill(base_x, base_y, width, height):
        for w in range(width):
            for h in range(height + 1):
                tiles.append(("grass", base_x + w * t, base_y - h * t))
            for h in range(1):
                tiles.append(("dirt", base_x + w * t, base_y + t))
    
    add_hill(8 * t, 400, 4, 2)
    add_hill(18 * t, 400, 5, 3)
    add_hill(32 * t, 400, 4, 2)
    add_hill(48 * t, 400, 6, 4)
    add_hill(68 * t, 400, 4, 2)
    add_hill(82 * t, 400, 5, 3)
    
    # Floating platforms
    for px, py in [(12, 300), (38, 280), (58, 300), (75, 290)]:
        for w in range(3):
            tiles.append(("grass", px * t + w * t, py))
    
    # Rings
    rings = [(x * t + 16, 355) for x in range(6, 100, 6)]
    rings.extend([(14 * t, 260), (40 * t, 240), (60 * t, 260), (78 * t, 250)])
    
    # Enemies
    enemies = [(12, 368), (28, 368), (42, 368), (58, 368), (72, 368), (88, 368)]
    
    checkpoints = [(52 * t, 336)]
    goal_x = 112 * t
    spawn = (64, 368)
    
    return tiles, rings, enemies, checkpoints, goal_x, spawn


def _generate_level_2():
    """Generate Marble Hill Zone - stone/cave theme."""
    tiles = []
    t = 32
    
    # Ground - flat with occasional gaps
    for x in range(0, 120 * t, t):
        tile_x = x // t
        if 42 <= tile_x <= 48 or 72 <= tile_x <= 76:
            continue
        for row in range(4):
            tile_type = "stone" if row == 0 else "dirt"
            tiles.append((tile_type, x, 400 + row * t))
    
    # Bridges over gaps (cover skipped ground tiles)
    for w in range(9):
        tiles.append(("stone", 40 * t + w * t, 400))
    for w in range(7):
        tiles.append(("stone", 70 * t + w * t, 400))
    
    # Stone pillars
    for px in [15, 55, 95]:
        for h in range(3):
            tiles.append(("stone", px * t, 400 - (h + 1) * t))
            tiles.append(("stone", px * t + t, 400 - (h + 1) * t))
    
    # Platforms
    for px, py in [(25, 340), (45, 330), (65, 340), (85, 335)]:
        for w in range(3):
            tiles.append(("stone", px * t + w * t, py))
    
    rings = [(x * t + 16, 355) for x in range(5, 105, 5)]
    rings.extend([(26 * t, 300), (46 * t, 290), (66 * t, 300), (86 * t, 295)])
    
    enemies = [(18, 368), (38, 368), (62, 368), (82, 368)]
    
    checkpoints = [(60 * t, 336)]
    goal_x = 116 * t
    spawn = (64, 368)
    
    return tiles, rings, enemies, checkpoints, goal_x, spawn


def build_level(level_data):
    """Build level from generated data."""
    tiles_list, rings_list, enemies_list, checkpoints_list, goal_x, spawn = level_data
    
    tiles = []
    for tile_type, x, y in tiles_list:
        tiles.append(Tile(x, y, tile_type))
    
    rings = [Ring(x, y) for x, y in rings_list]
    
    enemies = []
    for i, (x, y) in enumerate(enemies_list):
        enemies.append(EnemyCrab(x * 32, y))
    
    checkpoints = [Checkpoint(x, y) for x, y in checkpoints_list]
    goal = GoalPost(goal_x, 336)
    
    max_x = max(t[1] for t in tiles_list) + 96 if tiles_list else 3840
    
    return {
        "tiles": tiles,
        "rings": rings,
        "enemies": enemies,
        "checkpoints": checkpoints,
        "goal": goal,
        "spawn": spawn,
        "width": max_x,
        "height": 720,
    }


def get_level(level_num):
    """Get level data by number (1-indexed)."""
    if level_num == 1:
        data = _generate_level_1()
        name, theme = "Green Hill Zone", "grass"
    elif level_num == 2:
        data = _generate_level_2()
        name, theme = "Marble Hill Zone", "stone"
    else:
        data = _generate_level_1()
        name, theme = "Green Hill Zone", "grass"
    
    level = build_level(data)
    level["name"] = name
    level["theme"] = theme
    return level
