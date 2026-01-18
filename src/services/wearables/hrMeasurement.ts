export type HeartRateSensorContactStatus = 'not_supported' | 'not_detected' | 'detected';

export interface HeartRateMeasurement {
  heartRate: number;
  sensorContact: HeartRateSensorContactStatus;
  energyExpended?: number;
  rrIntervalsMs: number[];
}

export function parseHeartRateMeasurement(value: DataView): HeartRateMeasurement {
  if (value.byteLength < 2) {
    throw new Error('Heart Rate Measurement payload too short');
  }

  const flags = value.getUint8(0);
  const hrIs16Bit = (flags & 0x01) !== 0;
  const sensorContactBits = (flags >> 1) & 0x03;
  const energyExpendedPresent = (flags & 0x08) !== 0;
  const rrIntervalsPresent = (flags & 0x10) !== 0;

  let sensorContact: HeartRateSensorContactStatus = 'not_supported';
  if (sensorContactBits === 0b01) sensorContact = 'not_detected';
  if (sensorContactBits === 0b10 || sensorContactBits === 0b11) sensorContact = 'detected';

  let p = 1;

  const heartRate = hrIs16Bit ? value.getUint16(p, true) : value.getUint8(p);
  p += hrIs16Bit ? 2 : 1;

  let energyExpended: number | undefined;
  if (energyExpendedPresent) {
    if (p + 1 >= value.byteLength) {
      throw new Error('Heart Rate Measurement missing Energy Expended');
    }
    energyExpended = value.getUint16(p, true);
    p += 2;
  }

  const rrIntervalsMs: number[] = [];
  if (rrIntervalsPresent) {
    while (p + 1 < value.byteLength) {
      // RR-Interval is in 1/1024 seconds units.
      const rr1024 = value.getUint16(p, true);
      rrIntervalsMs.push((rr1024 * 1000) / 1024);
      p += 2;
    }
  }

  return { heartRate, sensorContact, energyExpended, rrIntervalsMs };
}

