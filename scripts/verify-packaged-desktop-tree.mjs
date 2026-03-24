#!/usr/bin/env node
import { resolve } from "node:path";

import { findPackagedDesktopTreeRoot, verifyPackagedDesktopTree } from "./desktop-resource-contract.mjs";

const args = process.argv.slice(2);
const searchRootFlagIndex = args.indexOf("--search-root");

if (searchRootFlagIndex !== -1) {
  const searchRoot = args[searchRootFlagIndex + 1];

  if (!searchRoot) {
    console.error("Usage: node scripts/verify-packaged-desktop-tree.mjs --search-root <dir>");
    process.exit(1);
  }

  try {
    const resolvedRoot = findPackagedDesktopTreeRoot(resolve(searchRoot));
    console.log(`Packaged desktop resources verified at ${resolvedRoot}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  process.exit(0);
}

const bundleRoot = args[0];

if (!bundleRoot) {
  console.error("Usage: node scripts/verify-packaged-desktop-tree.mjs <bundle-root>");
  console.error("   or: node scripts/verify-packaged-desktop-tree.mjs --search-root <dir>");
  process.exit(1);
}

try {
  verifyPackagedDesktopTree(resolve(bundleRoot));
  console.log(`Packaged desktop resources verified at ${resolve(bundleRoot)}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
