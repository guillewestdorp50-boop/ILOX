#!/usr/bin/env python3
"""Generate the original WEST-VILL 'Madre' call: one long, descending, fading cry."""
import math
import struct
import sys
import wave

RATE = 44100
DURATION = 3.15
COUNT = int(RATE * DURATION)
audio = []
phase = 0.0
for i in range(COUNT):
    t = i / RATE
    p = i / max(1, COUNT - 1)
    # One forceful onset, a brief high crest, then a long descending lament.
    if p < 0.12:
        q = p / 0.12
        freq = 980.0 + 610.0 * q
    else:
        q = (p - 0.12) / 0.88
        freq = 1590.0 * math.exp(math.log(430.0 / 1590.0) * q)
    phase += 2.0 * math.pi * freq / RATE
    attack = min(1.0, t / 0.055)
    decay = math.exp(-2.05 * p)
    tail = max(0.0, (1.0 - p) ** 1.45)
    swell = 0.88 + 0.12 * math.sin(2.0 * math.pi * (2.2 * t))
    breath = 1.0 + 0.035 * math.sin(2.0 * math.pi * 5.1 * t)
    envelope = attack * decay * tail * swell * breath
    # Rich, slightly rough harmonics give it a mature, animal-like cry,
    # while a soft subharmonic body keeps it lower than the Pichón.
    fundamental = math.sin(phase)
    harmonics = (0.42 * math.sin(2.0 * phase + 0.18)
                 + 0.20 * math.sin(3.0 * phase + 0.44)
                 + 0.08 * math.sin(4.0 * phase + 0.7))
    rasp = 0.035 * math.sin(phase * 0.503 + 0.9)
    value = (fundamental + harmonics + rasp) * 0.58 * envelope
    # Gradually soften the upper harmonics as the cry descends.
    value *= 0.82 + 0.18 * (1.0 - p)
    audio.append(value)

peak = max(1.0, max(abs(x) for x in audio))
scale = 0.88 / peak
target = sys.argv[1] if len(sys.argv) > 1 else "app/src/main/res/raw/westvill_madre.wav"
with wave.open(target, "wb") as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    frames = bytearray()
    for sample in audio:
        softened = math.tanh(sample * 1.15) * scale
        frames.extend(struct.pack("<h", int(max(-1.0, min(1.0, softened)) * 32767)))
    wav.writeframes(frames)
print(f"Created {target} ({len(frames)} bytes)")
