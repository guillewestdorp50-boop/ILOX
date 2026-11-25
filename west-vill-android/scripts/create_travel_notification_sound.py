#!/usr/bin/env python3
"""Generate WEST-VILL's distinctive, strong travel-alert notification sound."""
import math
import struct
import sys
import wave

RATE = 44100
DURATION = 1.55
audio = [0.0] * int(RATE * DURATION)

# A compact rising double-chime, a short breath, then a confident resolving ping.
# This is an original synthesized alert, not a bird call and not derived from Pichón.
notes = [
    (0.00, 0.23, 740.0, 0.78),
    (0.17, 0.25, 988.0, 0.82),
    (0.58, 0.34, 1318.5, 1.00),
    (0.83, 0.48, 1174.7, 0.92),
]
for start, length, freq, gain in notes:
    offset = int(start * RATE)
    count = int(length * RATE)
    attack = max(1, int(0.008 * RATE))
    release = max(1, int(0.105 * RATE))
    phase = 0.0
    for i in range(count):
        t = i / RATE
        env = min(1.0, i / attack, (count - 1 - i) / release)
        # Bell-like partials give the alert body and presence on phone speakers.
        phase += 2.0 * math.pi * freq / RATE
        tone = (math.sin(phase)
                + 0.48 * math.sin(2.01 * phase + 0.18)
                + 0.20 * math.sin(3.98 * phase + 0.42))
        # A subtle downward pitch drift keeps each chime warm rather than harsh.
        drift = math.exp(-t * 1.7)
        sample = tone * gain * env * (0.88 + 0.12 * drift)
        audio[offset + i] += sample

# Add a restrained low-frequency thump under the final chime for audibility.
start = int(0.83 * RATE)
count = int(0.18 * RATE)
for i in range(count):
    env = math.exp(-i / (0.045 * RATE))
    audio[start + i] += 0.16 * math.sin(2 * math.pi * 185 * i / RATE) * env

peak = max(1.0, max(abs(x) for x in audio))
scale = 0.94 / peak
frames = bytearray()
for sample in audio:
    shaped = math.tanh(sample * 1.25) * scale
    frames.extend(struct.pack("<h", int(max(-1.0, min(1.0, shaped)) * 32767)))

target = sys.argv[1] if len(sys.argv) > 1 else "app/src/main/res/raw/westvill_viaje.wav"
with wave.open(target, "wb") as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes(frames)
print(f"Created {target} ({len(frames)} bytes)")
