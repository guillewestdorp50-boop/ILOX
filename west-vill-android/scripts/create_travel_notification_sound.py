#!/usr/bin/env python3
"""Generate an original WEST-VILL objective-confirmation PDA sound.

Sonic direction: compact mission-complete UI feedback — a dry device tick,
a three-step electronic confirmation, and a short resonant lock-in. It uses
rounded mid/high tones and metallic partials, not a whistle or long siren glide.
"""
import math
import random
import struct
import sys
import wave

RATE = 44100
PITCH_SHIFT_SEMITONES = 5
PITCH_RATIO = 2 ** (PITCH_SHIFT_SEMITONES / 12)
DURATION = 1.28
COUNT = int(RATE * DURATION)
audio = [0.0] * COUNT
rng = random.Random(2711)

def add_tone(start, length, hz, gain, decay=7.0, detune=0.0, metallic=0.0):
    begin = int(start * RATE)
    end = min(COUNT, int((start + length) * RATE))
    phase_a = phase_b = 0.0
    for i in range(begin, end):
        t = (i - begin) / RATE
        phase_a += 2 * math.pi * (hz * PITCH_RATIO) / RATE
        phase_b += 2 * math.pi * (hz * PITCH_RATIO * (1.0 + detune)) / RATE
        attack = min(1.0, t / 0.006)
        env = attack * math.exp(-decay * t / max(0.01, length))
        # A slightly detuned body plus an inharmonic upper partial gives
        # a compact PDA/electronic-metal character instead of a clean whistle.
        body = 0.72 * math.sin(phase_a) + 0.28 * math.sin(phase_b + 0.2)
        edge = math.sin(phase_a * 2.73 + 0.4) * metallic
        audio[i] += gain * env * (body + edge)

def add_tick(start, gain=0.13, length=0.035):
    begin = int(start * RATE)
    end = min(COUNT, int((start + length) * RATE))
    for i in range(begin, end):
        t = (i - begin) / RATE
        env = math.exp(-t * 105.0)
        # Tiny filtered-noise click with a short resonant body.
        noise = rng.uniform(-1.0, 1.0)
        ring = math.sin(2 * math.pi * 1850 * PITCH_RATIO * t) * 0.35
        audio[i] += gain * env * (noise * 0.55 + ring)

# Device response: two restrained mechanical/electronic taps.
add_tick(0.025, 0.12, 0.028)
add_tick(0.105, 0.075, 0.024)

# Three compact confirmation steps. The tones are discrete and percussive:
# no continuous upward whistle and no alarm-like sweep.
add_tone(0.15, 0.24, 740, 0.38, decay=5.8, detune=0.006, metallic=0.10)
add_tone(0.34, 0.28, 988, 0.34, decay=5.2, detune=-0.004, metallic=0.12)
add_tone(0.57, 0.43, 1245, 0.31, decay=4.0, detune=0.003, metallic=0.16)

# Quiet resonant confirmation bed and a final short lock-in click.
add_tone(0.62, 0.48, 622, 0.105, decay=5.0, detune=0.002, metallic=0.08)
add_tick(0.91, 0.055, 0.022)

peak = max(0.001, max(abs(x) for x in audio))
scale = 0.82 / peak
frames = bytearray()
fade_out = int(0.12 * RATE)
for i, sample in enumerate(audio):
    edge = min(1.0, (COUNT - 1 - i) / fade_out)
    # Gentle saturation adds density without making the alert piercing.
    shaped = math.tanh(sample * 1.18) * scale * max(0.0, edge)
    frames.extend(struct.pack("<h", int(max(-1.0, min(1.0, shaped)) * 32767)))

target = sys.argv[1] if len(sys.argv) > 1 else "app/src/main/res/raw/westvill_viaje.wav"
with wave.open(target, "wb") as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes(frames)
print("Created original WEST-VILL PDA objective-style confirmation: %s (%d bytes)" % (target, len(frames)))
