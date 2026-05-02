function profileStages(profile) {
  switch (profile) {
    case "smoke":
      return [{ duration: "20s", target: 3 }, { duration: "20s", target: 0 }];
    case "stress":
      return [{ duration: "30s", target: 20 }, { duration: "3m", target: 80 }, { duration: "30s", target: 0 }];
    case "spike":
      return [{ duration: "15s", target: 10 }, { duration: "20s", target: 120 }, { duration: "30s", target: 10 }, { duration: "20s", target: 0 }];
    case "soak":
      return [{ duration: "2m", target: 20 }, { duration: "30m", target: 20 }, { duration: "2m", target: 0 }];
    case "baseline":
    default:
      return [{ duration: "30s", target: 10 }, { duration: "2m", target: 30 }, { duration: "1m", target: 30 }, { duration: "30s", target: 0 }];
  }
}

export function buildOptions(prefix) {
  const profile = __ENV.PERF_PROFILE || "baseline";
  const p95 = Number(__ENV[`${prefix}_P95_MS`] ?? "800");
  const err = Number(__ENV[`${prefix}_ERR_RATE`] ?? "0.02");
  return {
    stages: profileStages(profile),
    thresholds: {
      http_req_duration: [`p(95)<${p95}`],
      errors: [`rate<${err}`]
    }
  };
}
