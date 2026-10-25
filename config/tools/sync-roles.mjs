#!/usr/bin/env bun
import { readFileSync, copyFileSync, existsSync, readdirSync } from "node:fs"
import { dirname, join, basename } from "node:path"

const HERE = dirname(new URL(import.meta.url).pathname)
const BASE = dirname(HERE)
const AGENTS_DIR = join(BASE, "agents")
const ASSETS_DIR = join(BASE, "skills", "pdca-dotnet", "assets", "opencode-agents")

const USAGE = `sync-roles — keep the host PDCA role agents identical to the canonical role assets

  config/skills/pdca-dotnet/assets/opencode-agents/*.md   canonical (vendored from the skills repo)
  config/agents/*.md                                      installed mirror

Canonical role definitions (frontmatter, permission and body) are authored in the skills
repo: the six shared roles in skills/pdca, the pdca-security-auditor specialist in
skills/pdca-coder and skills/pdca-dotnet; all of them reach this snapshot only through
vendor-skills.mjs. The host agents are their byte-identical mirrors — the same rule the
skills repo enforces between skills/pdca and the overlays.

So --fix never writes into config/skills (a local edit there fails vendor-skills --check);
it copies the canonical asset over the host agent. Host-specific tweaks belong in the
profile (config/profiles/*.jsonc, block "agent"), not in the mirrored file.

Usage:
  bun tools/sync-roles.mjs [--check]   report drift, exit 1 if any (default)
  bun tools/sync-roles.mjs --fix       copy canonical assets over the host agents
  bun tools/sync-roles.mjs --help
`

const args = process.argv.slice(2)
if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(USAGE)
  process.exit(0)
}
const fix = args.includes("--fix")

// A renamed or missing assets dir would silently turn this gate into a no-op:
// listRoles() would find nothing to compare and report a clean exit 0.
for (const dir of [AGENTS_DIR, ASSETS_DIR]) {
  if (!existsSync(dir)) {
    console.error(`sync-roles: missing directory ${dir}`)
    console.error("  (renamed role assets? point ASSETS_DIR at the new name)")
    process.exit(2)
  }
}

const md = (dir) => readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => basename(f, ".md"))
const agents = md(AGENTS_DIR)
const assets = md(ASSETS_DIR)
const shared = agents.filter((r) => assets.includes(r)).sort()
const onlyAssets = assets.filter((r) => !agents.includes(r)).sort()

function firstDifference(canonical, mirror) {
  const c = canonical.split("\n")
  const m = mirror.split("\n")
  for (let i = 0; i < Math.max(c.length, m.length); i++) {
    if (c[i] !== m[i]) return `line ${i + 1} differs`
  }
  return "trailing bytes differ"
}

let drift = 0
let changed = 0

for (const role of shared) {
  const canonicalPath = join(ASSETS_DIR, role + ".md")
  const mirrorPath = join(AGENTS_DIR, role + ".md")
  const canonical = readFileSync(canonicalPath, "utf8")
  const mirror = readFileSync(mirrorPath, "utf8")
  if (canonical === mirror) {
    process.stdout.write(`ok    ${role}\n`)
    continue
  }
  drift++
  process.stdout.write(`DRIFT ${role}: ${firstDifference(canonical, mirror)}\n`)
  if (fix) {
    copyFileSync(canonicalPath, mirrorPath)
    changed++
    process.stdout.write(`      fixed -> ${mirrorPath}\n`)
  }
}

for (const r of onlyAssets) process.stdout.write(`note  ${r}: only in assets (no host agent)\n`)

if (fix) {
  process.stdout.write(`\n${changed} agent(s) refreshed, ${drift} drifted\n`)
  process.exit(changed === drift ? 0 : 1)
}
process.exit(drift ? 1 : 0)
