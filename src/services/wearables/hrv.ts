export interface HrvMetrics {
  rmssd: number;
  sdnn: number;
}

export function computeHrvFromRrMs(rrIntervalsMs: number[]): HrvMetrics | null {
  if (rrIntervalsMs.length < 2) return null;

  // RMSSD
  let diffSqSum = 0;
  for (let i = 1; i < rrIntervalsMs.length; i++) {
    const diff = rrIntervalsMs[i] - rrIntervalsMs[i - 1];
    diffSqSum += diff * diff;
  }
  const rmssd = Math.sqrt(diffSqSum / (rrIntervalsMs.length - 1));

  // SDNN
  const mean = rrIntervalsMs.reduce((a, b) => a + b, 0) / rrIntervalsMs.length;
  let varianceSum = 0;
  for (const rr of rrIntervalsMs) {
    const d = rr - mean;
    varianceSum += d * d;
  }
  const sdnn = Math.sqrt(varianceSum / rrIntervalsMs.length);

  return { rmssd, sdnn };
}

