#!/usr/bin/env python3
"""Generate the short, high-pitched WEST-VILL 'Pichón' notification sound."""
import math
import struct
import sys
import wave

RATE = 44100
DURATION = 2.25
audio = [0.0] * int(RATE * DURATION)
calls = [
    (0.00, 0.62, 2050.0, 3650.0, 2450.0),
    (0.78, 0.48, 2250.0, 3900.0, 2650.0),
    (1.48, 0.34, 2500.0, 3500.0, 2200.0),
]
for index, (start, length, f0, peak, tail) in enumerate(calls):
    count = int(length * RATE)
    phase = 0.0
    attack = max(1, int(0.035 * RATE))
    release = max(1, int(0.080 * RATE))
    for i in range(count):
        p = i / max(1, count - 1)
        if p < 0.36:
            q = p / 0.36
            freq = math.exp(math.log(f0) * (1-q) + math.log(peak) * q)
        elif p < 0.78:
            q = (p - 0.36) / 0.42
            freq = math.exp(math.log(peak) * (1-q) + math.log(tail) * q)
        else:
            q = (p - 0.78) / 0.22
            freq = math.exp(math.log(tail) * (1-q) + math.log(tail * 0.88) * q)
        phase += 2.0 * math.pi * freq / RATE
        envelope = min(1.0, i / attack, (count - 1 - i) / release)
        amplitude = 0.58 if index < 2 else 0.43
        value = (math.sin(phase) + 0.32 * math.sin(2*phase + 0.2)
                 + 0.12 * math.sin(3*phase + 0.5)) * amplitude * max(0.0, envelope)
        audio[int(start * RATE) + i] += value

peak = max(1.0, max(abs(x) for x in audio))
scale = 0.88 / peak
output = bytearray()
for sample in audio:
    # Soft saturation keeps the sharp call clear without digital clipping.
    value = math.tanh(sample * 0.85) * scale
    output.extend(struct.pack("<h", int(max(-1.0, min(1.0, value)) * 32767)))

target = sys.argv[1] if len(sys.argv) > 1 else "app/src/main/res/raw/westvill_pichon.wav"
with wave.open(target, "wb") as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes(output)
print(f"Created {target} ({len(output)} bytes)")
