"""
Sonic the Hedgehog Clone - Game Configuration
All game constants and settings in one place for easy tuning.
"""

# Display settings
SCREEN_WIDTH = 1280
SCREEN_HEIGHT = 720
TILE_SIZE = 32
FPS = 60

# Physics
GRAVITY = 0.6
MAX_FALL_SPEED = 16
FRICTION = 0.85
AIR_RESISTANCE = 0.98

# Player movement
RUN_SPEED = 8
JUMP_STRENGTH = -14
ROLL_THRESHOLD = 6  # Speed needed to enter rolling state
SPIN_DASH_CHARGE = 20  # Max charge for spin dash
SPIN_DASH_RELEASE = 12  # Speed when spin dash is released

# Collision
COLLISION_TOLERANCE = 4  # Pixels of overlap allowed

# Game rules
INITIAL_LIVES = 3
RING_SCORE = 100
ENEMY_SCORE = 1000
TIME_BONUS_PER_SECOND = 50
RING_INVINCIBILITY_TIME = 2000  # ms after being hit

# Colors (Sonic-inspired palette)
SKY_BLUE = (135, 206, 235)
GRASS_GREEN = (34, 139, 34)
DIRT_BROWN = (139, 90, 43)
RING_GOLD = (255, 215, 0)
SONIC_BLUE = (0, 112, 192)
ENEMY_RED = (220, 20, 60)
CHECKPOINT_WHITE = (255, 255, 255)
GOAL_RED = (255, 0, 0)
