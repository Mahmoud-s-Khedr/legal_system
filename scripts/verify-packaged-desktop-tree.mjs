#!/usr/bin/env node
import { resolve } from "node:path";

import { verifyPackagedDesktopTree } from "./desktop-resource-contract.mjs";

const bundleRoot = process.argv[2];

if (!bundleRoot) {
  console.error("Usage: node scripts/verify-packaged-desktop-tree.mjs <bundle-root>");
  process.exit(1);
}

try {
  verifyPackagedDesktopTree(resolve(bundleRoot));
  console.log(`Packaged desktop resources verified at ${resolve(bundleRoot)}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
