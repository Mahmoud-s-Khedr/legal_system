type NumericArray = number[];

interface EndpointStats {
  count: number;
  errors: number;
  totalMs: number;
  samples: NumericArray;
}

interface DbStats {
  count: number;
  totalMs: number;
  slowCount: number;
  samples: NumericArray;
}

const MAX_SAMPLES_PER_KEY = 400;
const endpointStats = new Map<string, EndpointStats>();
const dbStats = new Map<string, DbStats>();

function clampSampleWindow(samples: NumericArray, value: number): void {
  samples.push(value);
  if (samples.length > MAX_SAMPLES_PER_KEY) {
    samples.shift();
  }
}

function percentile(samples: NumericArray, p: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const ordered = [...samples].sort((a, b) => a - b);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil((p / 100) * ordered.length) - 1));
  return Number(ordered[index]?.toFixed(2) ?? 0);
}

export function recordEndpointTiming(key: string, durationMs: number, isError: boolean): void {
  const current = endpointStats.get(key) ?? { count: 0, errors: 0, totalMs: 0, samples: [] };
  current.count += 1;
  current.totalMs += durationMs;
  if (isError) {
    current.errors += 1;
  }
  clampSampleWindow(current.samples, durationMs);
  endpointStats.set(key, current);
}

export function recordDbTiming(key: string, durationMs: number, slowThresholdMs: number): void {
  const current = dbStats.get(key) ?? { count: 0, totalMs: 0, slowCount: 0, samples: [] };
  current.count += 1;
  current.totalMs += durationMs;
  if (durationMs >= slowThresholdMs) {
    current.slowCount += 1;
  }
  clampSampleWindow(current.samples, durationMs);
  dbStats.set(key, current);
}

export function getPerformanceSnapshot() {
  const endpoints = Array.from(endpointStats.entries())
    .map(([key, stats]) => ({
      key,
      count: stats.count,
      errorRate: stats.count > 0 ? Number((stats.errors / stats.count).toFixed(4)) : 0,
      avgMs: stats.count > 0 ? Number((stats.totalMs / stats.count).toFixed(2)) : 0,
      p95Ms: percentile(stats.samples, 95),
      p99Ms: percentile(stats.samples, 99)
    }))
    .sort((a, b) => b.p95Ms - a.p95Ms)
    .slice(0, 30);

  const db = Array.from(dbStats.entries())
    .map(([key, stats]) => ({
      key,
      count: stats.count,
      avgMs: stats.count > 0 ? Number((stats.totalMs / stats.count).toFixed(2)) : 0,
      slowCount: stats.slowCount,
      p95Ms: percentile(stats.samples, 95),
      p99Ms: percentile(stats.samples, 99)
    }))
    .sort((a, b) => b.p95Ms - a.p95Ms)
    .slice(0, 30);

  return { endpoints, db };
}

