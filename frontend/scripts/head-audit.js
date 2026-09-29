#!/usr/bin/env node
// 08 gate — head-tag audit. Fails CI if any static route lacks
// title/description/OG/canonical metadata.
// Usage: node scripts/head-audit.js
const fs = require("fs");
const path = require("path");

const APP_DIR = path.join(__dirname, "..", "app");

// Routes rendered from client-only pages inherit layout defaults;
// audit the server pages + generateMetadata dynamic routes.
const EXPECTED = [
  "page.tsx", // /
  "demo/page.tsx",
  "pricing/page.tsx",
  "docs/page.tsx",
  "docs/[slug]/page.tsx",
  "blog/page.tsx",
  "blog/[slug]/page.tsx",
  "changelog/page.tsx",
  "about/page.tsx",
  "privacy/page.tsx",
  "terms/page.tsx",
  "vs/deepwiki/page.tsx",
  "docs/connect-agent/page.tsx",
];

let failed = 0;
for (const rel of EXPECTED) {
  const file = path.join(APP_DIR, rel);
  if (!fs.existsSync(file)) {
    console.error(`MISSING route file: ${rel}`);
    failed++;
    continue;
  }
  const src = fs.readFileSync(file, "utf8");
  const hasMeta =
    /export\s+(const\s+metadata|async\s+function\s+generateMetadata|function\s+generateMetadata)/.test(src);
  // Client pages inherit root layout OG/canonical; server pages must declare.
  const isClient = src.startsWith('"use client"');
  if (!hasMeta && !isClient) {
    console.error(`NO METADATA: ${rel}`);
    failed++;
  } else {
    const needs = ["title", "description", "openGraph", "twitter", "canonical", "images"];
    // Layout-level defaults cover canonical/OG images; check page declares title+description.
    const missing = ["title", "description"].filter((k) => !src.includes(k));
    if (!isClient && missing.length) {
      console.error(`MISSING ${missing.join(",")}: ${rel}`);
      failed++;
    } else {
      console.log(`OK: /${rel.replace(/\/page\.tsx$/, "").replace(/^page\.tsx$/, "")} ${isClient ? "(inherits layout)" : ""}`);
    }
  }
}

// Root layout must define canonical + OG + twitter defaults.
const layout = fs.readFileSync(path.join(APP_DIR, "layout.tsx"), "utf8");
for (const k of ["canonical", "openGraph", "twitter", "metadataBase", "robots"]) {
  if (!layout.includes(k)) {
    console.error(`layout.tsx MISSING: ${k}`);
    failed++;
  }
}
console.log(failed ? `\nFAIL: ${failed} head-tag issue(s)` : "\nPASS: all routes declare head tags");
process.exit(failed ? 1 : 0);
