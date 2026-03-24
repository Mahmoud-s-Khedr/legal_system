import { afterEach, describe, expect, it } from "vitest";
import tsupConfig from "../tsup.config";

const ORIGINAL_BUILD_TARGET = process.env.ELMS_BUILD_TARGET;
const ORIGINAL_LIFECYCLE_EVENT = process.env.npm_lifecycle_event;

afterEach(() => {
  process.env.ELMS_BUILD_TARGET = ORIGINAL_BUILD_TARGET;
  process.env.npm_lifecycle_event = ORIGINAL_LIFECYCLE_EVENT;
});

describe("tsup desktop config detection", () => {
  it("uses desktop output for build:desktop lifecycle", () => {
    delete process.env.ELMS_BUILD_TARGET;
    process.env.npm_lifecycle_event = "build:desktop";

    expect(tsupConfig({}).outDir).toBe("dist/desktop");
  });

  it("uses cloud output for standard build lifecycle", () => {
    delete process.env.ELMS_BUILD_TARGET;
    process.env.npm_lifecycle_event = "build";

    expect(tsupConfig({}).outDir).toBe("dist/cloud");
  });
});
