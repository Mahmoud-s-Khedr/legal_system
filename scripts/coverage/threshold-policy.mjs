const PHASES = ["week1", "week2", "week3", "week4"];

const DATE_WINDOWS = [
  { phase: "week1", start: "2026-04-22", end: "2026-04-28" },
  { phase: "week2", start: "2026-04-29", end: "2026-05-05" },
  { phase: "week3", start: "2026-05-06", end: "2026-05-12" },
  { phase: "week4", start: "2026-05-13", end: null }
];

const PHASE_THRESHOLDS = {
  week1: {
    "@elms/backend": { lines: 30, branches: 60, functions: 60, statements: 30 },
    "@elms/frontend": { lines: 5, branches: 20, functions: 20, statements: 5 },
    "@elms/shared": { lines: 70, branches: 65, functions: 70, statements: 70 }
  },
  week2: {
    "@elms/backend": { lines: 45, branches: 60, functions: 62, statements: 45 },
    "@elms/frontend": { lines: 25, branches: 30, functions: 35, statements: 25 },
    "@elms/shared": { lines: 70, branches: 65, functions: 70, statements: 70 }
  },
  week3: {
    "@elms/backend": { lines: 60, branches: 62, functions: 65, statements: 60 },
    "@elms/frontend": { lines: 50, branches: 45, functions: 55, statements: 50 },
    "@elms/shared": { lines: 70, branches: 65, functions: 70, statements: 70 }
  },
  week4: {
    "@elms/backend": { lines: 70, branches: 65, functions: 70, statements: 70 },
    "@elms/frontend": { lines: 70, branches: 65, functions: 70, statements: 70 },
    "@elms/shared": { lines: 70, branches: 65, functions: 70, statements: 70 }
  }
};

export function resolveCoveragePhase(now = new Date()) {
  const override = process.env.ELMS_COVERAGE_PHASE?.trim().toLowerCase();
  if (override) {
    if (!PHASES.includes(override)) {
      throw new Error(
        `Invalid ELMS_COVERAGE_PHASE=\"${process.env.ELMS_COVERAGE_PHASE}\". Expected one of: ${PHASES.join(", ")}`
      );
    }
    return override;
  }

  const dateOverride = process.env.ELMS_COVERAGE_DATE?.trim();
  const isoDate = dateOverride || now.toISOString().slice(0, 10);

  for (const window of DATE_WINDOWS) {
    if (isoDate < window.start) {
      return "week1";
    }
    if (window.end === null || (isoDate >= window.start && isoDate <= window.end)) {
      return window.phase;
    }
  }

  return "week4";
}

export function getPackageCoverageThresholds(packageName, now = new Date()) {
  const phase = resolveCoveragePhase(now);
  const packageThresholds = PHASE_THRESHOLDS[phase][packageName];
  if (!packageThresholds) {
    throw new Error(`No coverage thresholds configured for package \"${packageName}\" in phase \"${phase}\".`);
  }
  return packageThresholds;
}

export function getCoveragePolicySnapshot(now = new Date()) {
  const phase = resolveCoveragePhase(now);
  return {
    activePhase: phase,
    thresholds: PHASE_THRESHOLDS[phase],
    phases: PHASE_THRESHOLDS
  };
}
