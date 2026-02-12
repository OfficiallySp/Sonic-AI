"""
Asset Generator for Sonic Clone
Creates sprites, sounds, and music - run this before first gameplay.
Executes automatically if assets are missing, or run manually: python generate_assets.py
"""

import os
import sys
import struct
import math
import wave

# Try to import pygame for sprite generation
try:
    import pygame
    HAS_PYGAME = True
except ImportError:
    HAS_PYGAME = False

# Create directories
ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets")
SPRITES_DIR = os.path.join(ASSETS_DIR, "sprites")
SOUNDS_DIR = os.path.join(ASSETS_DIR, "sounds")
MUSIC_DIR = os.path.join(ASSETS_DIR, "music")

for d in [ASSETS_DIR, SPRITES_DIR, SOUNDS_DIR, MUSIC_DIR]:
    os.makedirs(d, exist_ok=True)


def generate_wav(output_path, frequency, duration, volume=0.3, wave_type="sine"):
    """Generate a simple WAV file with a tone."""
    sample_rate = 44100
    n_samples = int(sample_rate * duration)
    
    with wave.open(output_path, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        max_amplitude = 32767 * volume
        frames = []
        for i in range(n_samples):
            t = i / sample_rate
            if wave_type == "sine":
                value = math.sin(2 * math.pi * frequency * t)
            elif wave_type == "square":
                value = 1 if (math.sin(2 * math.pi * frequency * t) >= 0) else -1
            else:
                value = math.sin(2 * math.pi * frequency * t)
            # Apply envelope (fade out)
            envelope = 1 - (i / n_samples) * 0.5
            sample = int(max_amplitude * value * envelope)
            sample = max(-32768, min(32767, sample))
            frames.append(struct.pack('<h', sample))
        
        wav_file.writeframes(b''.join(frames))


def generate_sounds():
    """Generate all sound effects."""
    print("Generating sound effects...")
    
    # Jump - ascending chirp
    sr = 44100
    dur = 0.15
    with wave.open(os.path.join(SOUNDS_DIR, "jump.wav"), 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        frames = []
        for i in range(int(sr * dur)):
            t = i / sr
            freq = 400 + (1200 * (i / (sr * dur)))
            val = int(32767 * 0.2 * math.sin(2 * math.pi * freq * t) * (1 - i/(sr*dur)))
            val = max(-32768, min(32767, val))
            frames.append(struct.pack('<h', val))
        w.writeframes(b''.join(frames))
    
    # Ring - bright ping
    generate_wav(os.path.join(SOUNDS_DIR, "ring.wav"), 880, 0.1, 0.25)
    
    # Enemy defeat - crunch
    with wave.open(os.path.join(SOUNDS_DIR, "enemy.wav"), 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(44100)
        frames = []
        for i in range(4410):
            t = i / 44100
            val = int(32767 * 0.2 * (math.sin(440*t) + 0.5*math.sin(220*t)) * (1 - i/4410))
            val = max(-32768, min(32767, val))
            frames.append(struct.pack('<h', val))
        w.writeframes(b''.join(frames))
    
    # Spin dash charge
    generate_wav(os.path.join(SOUNDS_DIR, "spindash.wav"), 200, 0.08, 0.15)
    
    # Hit - low thud
    generate_wav(os.path.join(SOUNDS_DIR, "hit.wav"), 150, 0.3, 0.35)
    
    # Checkpoint
    generate_wav(os.path.join(SOUNDS_DIR, "checkpoint.wav"), 523, 0.2, 0.2)
    
    # Goal
    with wave.open(os.path.join(SOUNDS_DIR, "goal.wav"), 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(44100)
        frames = []
        for note in [523, 659, 784, 1047]:
            for i in range(2205):
                t = i / 44100
                val = int(32767 * 0.2 * math.sin(2 * math.pi * note * t) * (1 - i/2205))
                val = max(-32768, min(32767, val))
                frames.append(struct.pack('<h', val))
        w.writeframes(b''.join(frames))
    
    print("  [OK] Sound effects created")


def generate_music():
    """Generate simple chiptune-style background music."""
    print("Generating background music...")
    
    # Simple melody - Green Hill Zone inspired
    notes = [
        (261, 0.25), (293, 0.25), (329, 0.25), (349, 0.25),
        (392, 0.5), (349, 0.25), (329, 0.25), (293, 0.25),
        (261, 0.5), (261, 0.25), (293, 0.25), (329, 0.25),
        (349, 0.25), (392, 0.5), (440, 0.25), (392, 0.25),
        (349, 0.5), (261, 0.25), (293, 0.25), (329, 0.25),
        (349, 0.25), (392, 0.5), (349, 0.25), (329, 0.25),
        (261, 1.0),
    ]
    
    sr = 44100
    frames = []
    for freq, duration in notes:
        n = int(sr * duration)
        for i in range(n):
            t = i / sr
            envelope = 0.5 * (1 - math.cos(math.pi * i / n))  # Soft attack/release
            val = int(32767 * 0.12 * envelope * math.sin(2 * math.pi * freq * t))
            val = max(-32768, min(32767, val))
            frames.append(struct.pack('<h', val))
    
    # Add some silence between loops
    for _ in range(int(sr * 0.5)):
        frames.append(struct.pack('<h', 0))
    
    output_path = os.path.join(MUSIC_DIR, "green_hill.ogg")
    # Save as WAV first (ogg requires additional library)
    wav_path = os.path.join(MUSIC_DIR, "green_hill.wav")
    with wave.open(wav_path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(b''.join(frames))
    
    # Try to convert to OGG for smaller size (optional)
    try:
        import subprocess
        if sys.platform != "win32":
            subprocess.run(["ffmpeg", "-y", "-i", wav_path, "-c:a", "libvorbis", output_path], 
                         capture_output=True, check=False)
    except Exception:
        pass
    
    # Game uses WAV if OGG doesn't exist
    print("  [OK] Background music created (green_hill.wav)")


def generate_sprites():
    """Generate sprite images using Pygame."""
    if not HAS_PYGAME:
        print("  Skipping sprites (pygame not installed) - using inline graphics")
        return
    
    print("Generating sprites...")
    pygame.init()
    
    # Sonic - running animation frames (simplified blue blob with legs)
    sonic_size = 32
    for i in range(4):
        surf = pygame.Surface((sonic_size, sonic_size))
        surf.set_colorkey((0, 0, 0))
        # Body - blue oval
        pygame.draw.ellipse(surf, (0, 112, 192), (4, 8, 24, 20))
        # Head
        pygame.draw.circle(surf, (0, 112, 192), (20, 12), 8)
        # Legs (animated)
        leg_offset = (i % 2) * 4 - 2
        pygame.draw.rect(surf, (0, 112, 192), (8, 22 + leg_offset, 6, 8))
        pygame.draw.rect(surf, (0, 112, 192), (18, 22 - leg_offset, 6, 8))
        # Eye
        pygame.draw.circle(surf, (255, 255, 255), (22, 10), 2)
        pygame.draw.circle(surf, (0, 0, 0), (23, 10), 1)
        pygame.image.save(surf, os.path.join(SPRITES_DIR, f"sonic_run_{i}.png"))
    
    # Sonic - rolling/spin ball
    surf = pygame.Surface((sonic_size, sonic_size))
    surf.set_colorkey((0, 0, 0))
    pygame.draw.circle(surf, (0, 112, 192), (16, 16), 14)
    pygame.draw.ellipse(surf, (50, 150, 220), (8, 10, 16, 12))  # Highlight
    pygame.image.save(surf, os.path.join(SPRITES_DIR, "sonic_roll.png"))
    
    # Ring
    surf = pygame.Surface((20, 20))
    surf.set_colorkey((0, 0, 0))
    pygame.draw.ellipse(surf, (255, 215, 0), (2, 8, 16, 4), 2)
    pygame.image.save(surf, os.path.join(SPRITES_DIR, "ring.png"))
    
    # Enemy (crab-like badnik)
    surf = pygame.Surface((32, 32))
    surf.set_colorkey((0, 0, 0))
    pygame.draw.ellipse(surf, (220, 20, 60), (4, 8, 24, 20))
    pygame.draw.rect(surf, (220, 20, 60), (2, 20, 8, 8))
    pygame.draw.rect(surf, (220, 20, 60), (22, 20, 8, 8))
    pygame.draw.circle(surf, (255, 255, 255), (16, 14), 3)
    pygame.image.save(surf, os.path.join(SPRITES_DIR, "enemy.png"))
    
    # Block tiles
    for name, color in [("grass", (34, 139, 34)), ("dirt", (139, 90, 43)), 
                        ("stone", (128, 128, 128)), ("checkpoint", (255, 255, 255))]:
        surf = pygame.Surface((32, 32))
        surf.fill(color)
        if name == "grass":
            pygame.draw.rect(surf, (50, 160, 50), (0, 0, 32, 4))
        pygame.draw.rect(surf, (0, 0, 0), (0, 0, 32, 32), 1)
        pygame.image.save(surf, os.path.join(SPRITES_DIR, f"tile_{name}.png"))
    
    # Goal post
    surf = pygame.Surface((48, 64))
    surf.set_colorkey((0, 0, 0))
    pygame.draw.rect(surf, (255, 255, 255), (0, 0, 8, 64))
    pygame.draw.rect(surf, (255, 0, 0), (8, 0, 40, 16))
    pygame.draw.circle(surf, (255, 215, 0), (28, 8), 6)
    pygame.image.save(surf, os.path.join(SPRITES_DIR, "goal.png"))
    
    pygame.quit()
    print("  [OK] Sprites created")


def main():
    print("=" * 50)
    print("Sonic Clone - Asset Generator")
    print("=" * 50)
    generate_sounds()
    generate_music()
    generate_sprites()
    print("\nAll assets generated successfully!")
    print("Run the game with: python main.py")


if __name__ == "__main__":
    main()
