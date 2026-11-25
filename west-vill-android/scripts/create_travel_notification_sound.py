#!/usr/bin/env python3
"""Create WEST-VILL's original PDA-radio travel alert (no sampled or borrowed audio)."""
import math
import struct
import sys
import wave

RATE = 44100
DURATION = 3.45
COUNT = int(RATE * DURATION)
audio = [0.0] * COUNT

def envelope(i, start, length, attack=0.012, release=0.16):
    t = i / RATE - start
    if t < 0 or t > length:
        return 0.0
    return min(1.0, t / attack) * min(1.0, (length - t) / release)

def add_tone(start, length, freq, gain, harmonics=(1.0, 0.32, 0.12), sweep=0.0, wobble=0.0):
    begin = int(start * RATE)
    end = min(COUNT, int((start + length) * RATE))
    phase = 0.0
    for i in range(begin, end):
        local = i / RATE - start
        hz = freq + sweep * local + wobble * math.sin(2 * math.pi * 4.1 * local)
        phase += 2 * math.pi * hz / RATE
        tone = 0.0
        for h, level in enumerate(harmonics, 1):
            tone += level * math.sin(h * phase + 0.035 * h * math.sin(phase * 0.13))
        audio[i] += gain * tone * envelope(i, start, length)

def add_static(start, length, gain, seed, decay=0.0):
    state = seed & 0x7fffffff
    begin = int(start * RATE)
    end = min(COUNT, int((start + length) * RATE))
    # Filtered, irregular radio-noise bursts: deterministic and reproducible.
    low = 0.0
    for i in range(begin, end):
        state = (1103515245 * state + 12345) & 0x7fffffff
        white = (state / 1073741824.0) - 1.0
        low = 0.78 * low + 0.22 * white
        local = i / RATE - start
        fade = math.exp(-decay * local) if decay else 1.0
        audio[i] += gain * (0.72 * white + 0.28 * low) * fade * envelope(i, start, length, 0.004, 0.07)

def add_thump(start, freq, gain, length=0.24):
    begin = int(start * RATE)
    end = min(COUNT, int((start + length) * RATE))
    for i in range(begin, end):
        local = (i - begin) / RATE
        audio[i] += gain * math.sin(2 * math.pi * freq * local) * math.exp(-local * 17)

# Low powered-device hum: the sound has weight, not a musical three-note motif.
add_tone(0.00, 3.30, 57, 0.20, (1.0, 0.42, 0.16), sweep=2.0, wobble=1.8)
add_tone(0.05, 2.95, 113, 0.105, (1.0, 0.28, 0.08), sweep=-1.5)

# Device wakes up; a short burst of radio static opens the channel.
add_static(0.08, 0.36, 0.19, 431, decay=2.0)
add_thump(0.12, 48, 0.22, 0.30)
add_tone(0.40, 0.34, 690, 0.10, (1.0, 0.24), sweep=-210)
add_tone(0.54, 0.48, 385, 0.17, (1.0, 0.42, 0.15), sweep=42, wobble=3.0)

# Radio carrier sweeps through interference, then locks onto a signal.
add_static(0.91, 0.24, 0.17, 992, decay=1.0)
add_tone(1.02, 0.62, 248, 0.18, (1.0, 0.48, 0.16), sweep=24)
add_tone(1.18, 0.25, 820, 0.075, (1.0, 0.20), sweep=-360)
add_static(1.68, 0.20, 0.13, 1729, decay=3.0)

# Final confirmed signal: broad, slightly distorted midrange plus a deep tactile pulse.
add_tone(1.92, 0.88, 294, 0.21, (1.0, 0.52, 0.20, 0.07), sweep=-12, wobble=1.4)
add_tone(2.08, 0.62, 440, 0.095, (1.0, 0.30, 0.10), sweep=-18)
add_thump(2.00, 64, 0.25, 0.38)
add_static(2.88, 0.18, 0.075, 2718, decay=5.0)
add_tone(3.00, 0.31, 174, 0.15, (1.0, 0.34, 0.12), sweep=-18)

# Soft edge fades and gentle saturation keep it present without a harsh peak.
frames = bytearray()
peak = max(0.001, max(abs(x) for x in audio))
scale = 0.91 / peak
fade_in = int(0.012 * RATE)
fade_out = int(0.20 * RATE)
for i, sample in enumerate(audio):
    edge = min(1.0, i / fade_in, (COUNT - 1 - i) / fade_out)
    shaped = math.tanh(sample * 1.22) * scale * max(0.0, edge)
    frames.extend(struct.pack("<h", int(max(-1.0, min(1.0, shaped)) * 32767)))

target = sys.argv[1] if len(sys.argv) > 1 else "app/src/main/res/raw/westvill_viaje.wav"
with wave.open(target, "wb") as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes(frames)
print("Created original WEST-VILL PDA radio alert: %s (%d bytes)" % (target, len(frames)))
