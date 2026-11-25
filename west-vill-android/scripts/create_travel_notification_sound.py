#!/usr/bin/env python3
"""Generate WEST-VILL's original high-register industrial scanner travel alert."""
import math
import struct
import sys
import wave

RATE = 44100
DURATION = 2.35
COUNT = int(RATE * DURATION)
audio = [0.0] * COUNT

def sweep(start, length, low, high, gain, bend=0.0, flutter=0.0, phase_offset=0.0):
    begin = int(start * RATE)
    end = min(COUNT, int((start + length) * RATE))
    phase = phase_offset
    for i in range(begin, end):
        p = (i - begin) / max(1, end - begin - 1)
        # Smooth rising scanner glide, with a subtle acceleration near the end.
        curve = p + bend * p * (1.0 - p)
        hz = low + (high - low) * curve
        local = (i - begin) / RATE
        hz *= 1.0 + flutter * math.sin(2 * math.pi * 17.0 * local)
        phase += 2 * math.pi * hz / RATE
        attack = min(1.0, p / 0.055)
        release = min(1.0, (1.0 - p) / 0.12)
        env = max(0.0, attack * release)
        # Bright metallic partials, restrained so the upper register stays smooth.
        voice = (math.sin(phase)
                 + 0.24 * math.sin(2 * phase + 0.22)
                 + 0.075 * math.sin(3 * phase + 0.51))
        audio[i] += gain * voice * env

def chirp_cluster(start, length, low, high, gain, pulses=5):
    begin = int(start * RATE)
    end = min(COUNT, int((start + length) * RATE))
    phase = 0.0
    for i in range(begin, end):
        p = (i - begin) / max(1, end - begin - 1)
        hz = low + (high - low) * (p ** 0.82)
        phase += 2 * math.pi * hz / RATE
        # Rapid amplitude flutter creates the articulated "Tri-Ri-Ri" scan,
        # not separate musical notes.
        gate = 0.72 + 0.28 * math.sin(2 * math.pi * pulses * p) ** 2
        env = min(1.0, p / 0.035) * min(1.0, (1.0 - p) / 0.09)
        carrier = math.sin(phase) + 0.18 * math.sin(2 * phase + 0.3)
        audio[i] += gain * carrier * gate * max(0.0, env)

# Three tightly connected scan articulations climb in pitch, then resolve
# into one long, bright electronic carrier: "TriRiRirieeeee".
chirp_cluster(0.04, 0.36, 1850, 2850, 0.46, pulses=4)
chirp_cluster(0.32, 0.40, 2250, 3450, 0.43, pulses=5)
chirp_cluster(0.63, 0.43, 2650, 3900, 0.40, pulses=6)

# Industrial scanner lock: sustained high glide with a fine metallic shimmer.
sweep(0.98, 1.05, 2850, 4250, 0.39, bend=0.18, flutter=0.0025)
sweep(1.10, 0.88, 3420, 4480, 0.13, bend=-0.10, flutter=0.0015, phase_offset=0.7)

# A tiny high-frequency confirmation tick and a soft, short tail.
sweep(1.88, 0.23, 4050, 3650, 0.20, bend=0.0)
sweep(2.08, 0.20, 3200, 2850, 0.10, bend=0.0)

peak = max(0.001, max(abs(x) for x in audio))
scale = 0.88 / peak
frames = bytearray()
fade_in = int(0.012 * RATE)
fade_out = int(0.16 * RATE)
for i, sample in enumerate(audio):
    edge = min(1.0, i / fade_in, (COUNT - 1 - i) / fade_out)
    # Soft saturation tames peaks without dulling the high register.
    shaped = math.tanh(sample * 1.05) * scale * max(0.0, edge)
    frames.extend(struct.pack("<h", int(max(-1.0, min(1.0, shaped)) * 32767)))

target = sys.argv[1] if len(sys.argv) > 1 else "app/src/main/res/raw/westvill_viaje.wav"
with wave.open(target, "wb") as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes(frames)
print("Created original WEST-VILL high-register scanner alert: %s (%d bytes)" % (target, len(frames)))
