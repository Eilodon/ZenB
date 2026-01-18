import { describe, expect, it } from 'vitest';
import { parseHeartRateMeasurement } from './hrMeasurement';
import { computeHrvFromRrMs } from './hrv';
import { RingBuffer } from './ringBuffer';

describe('wearables/hrMeasurement', () => {
  it('parses HR8 + RR-intervals', () => {
    // Flags: RR-Interval present (bit4)
    // HR = 60 bpm
    // RR intervals: 1024 (1s), 512 (0.5s)
    const bytes = new Uint8Array([
      0x10, // flags
      60,   // HR (uint8)
      0x00, 0x04, // 1024 (1.0s)
      0x00, 0x02, // 512 (0.5s)
    ]);

    const dv = new DataView(bytes.buffer);
    const m = parseHeartRateMeasurement(dv);

    expect(m.heartRate).toBe(60);
    expect(m.sensorContact).toBe('not_supported');
    expect(m.rrIntervalsMs.length).toBe(2);
    expect(m.rrIntervalsMs[0]).toBeCloseTo(1000, 3);
    expect(m.rrIntervalsMs[1]).toBeCloseTo(500, 3);
  });

  it('parses HR16 + energy + sensor contact', () => {
    // Flags:
    // - bit0: HR value 16-bit
    // - bits1-2: sensor contact detected (0b10 -> bit2)
    // - bit3: energy expended present
    // - bit4: RR-interval present
    const flags = 0x01 | 0x04 | 0x08 | 0x10; // 0x1D

    const hr = 190; // uint16 LE
    const energy = 123; // uint16 LE
    const rr = 1024; // 1s in 1/1024s units

    const bytes = new Uint8Array([
      flags,
      hr & 0xff, (hr >> 8) & 0xff,
      energy & 0xff, (energy >> 8) & 0xff,
      rr & 0xff, (rr >> 8) & 0xff,
    ]);

    const m = parseHeartRateMeasurement(new DataView(bytes.buffer));
    expect(m.heartRate).toBe(190);
    expect(m.sensorContact).toBe('detected');
    expect(m.energyExpended).toBe(123);
    expect(m.rrIntervalsMs[0]).toBeCloseTo(1000, 3);
  });
});

describe('wearables/hrv', () => {
  it('computes zero HRV for constant RR', () => {
    const hrv = computeHrvFromRrMs([1000, 1000, 1000]);
    expect(hrv).not.toBeNull();
    expect(hrv!.rmssd).toBeCloseTo(0, 6);
    expect(hrv!.sdnn).toBeCloseTo(0, 6);
  });
});

describe('wearables/ringBuffer', () => {
  it('keeps last N values', () => {
    const rb = new RingBuffer<number>(3);
    rb.pushMany([1, 2, 3, 4]);
    expect(rb.toArray()).toEqual([2, 3, 4]);
  });
});

