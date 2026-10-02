#!/usr/bin/env bun
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs"
import { dirname, join, basename } from "node:path"

const HERE = dirname(new URL(import.meta.url).pathname)
const BASE = dirname(HERE)
const AGENTS_DIR = join(BASE, "agents")
const ASSETS_DIR = join(BASE, "skills", "pdca-dotnet", "assets", "agents")

const EXT_COMMENT = [
  "  # external_directory: add paths outside the project worktree if the task needs them, e.g.",
  '  #   "/tmp/**": allow',
]

const USAGE = `sync-roles — keep the pdca-dotnet role assets in sync with the host agents

  config/agents/*.md                              canonical settings (host)
  config/skills/pdca-dotnet/assets/agents/*.md    generated settings (portable)

The canonical settings are the frontmatter of config/agents/*.md (name, mode,
steps, # tier, permission). Assets receive a generated frontmatter with the same
settings minus external_directory (host-specific; replaced by a placeholder
comment). Descriptions and bodies stay per-language and are never touched.
Text parity cannot be generated — the tool only verifies body heading structure.

Usage:
  bun tools/sync-roles.mjs [--check]   report drift, exit 1 if any (default)
  bun tools/sync-roles.mjs --fix       rewrite asset frontmatter settings
  bun tools/sync-roles.mjs --help
`

function splitFm(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) throw new Error("missing frontmatter")
  return { front: m[1], body: m[2] }
}

function tierOf(front) {
  const m = front.match(/^#\s*tier:\s*(\S+)/m)
  return m ? m[1] : null
}

function yamlScalar(v) {
  const s = String(v)
  return /^[A-Za-z0-9_./-]+$/.test(s) ? s : JSON.stringify(s)
}

function serializePermission(perm) {
  const pad = "  "
  const out = []
  for (const [k, v] of Object.entries(perm)) {
    if (k === "external_directory") {
      out.push(...EXT_COMMENT)
      continue
    }
    if (v && typeof v === "object") {
      out.push(`${pad}${yamlScalar(k)}:`)
      for (const [k2, v2] of Object.entries(v)) out.push(`${pad}  ${yamlScalar(k2)}: ${yamlScalar(v2)}`)
    } else {
      out.push(`${pad}${yamlScalar(k)}: ${yamlScalar(v)}`)
    }
  }
  return out.join("\n")
}

function normPerm(perm) {
  const out = {}
  for (const [k, v] of Object.entries(perm || {})) {
    if (k === "external_directory") continue
    out[k] = v && typeof v === "object" ? { ...v } : v
  }
  return out
}

function headings(body) {
  return body
    .split("\n")
    .filter((l) => /^#{1,6}\s/.test(l.trim()))
    .map((l) => l.trim().split(/\s/)[0].length)
}

function stable(o) {
  if (Array.isArray(o)) return "[" + o.map(stable).join(",") + "]"
  if (o && typeof o === "object")
    return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + stable(o[k])).join(",") + "}"
  return JSON.stringify(o)
}

function listRoles() {
  const md = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => basename(f, ".md")) : [])
  const c = md(AGENTS_DIR)
  const a = md(ASSETS_DIR)
  return {
    shared: c.filter((r) => a.includes(r)).sort(),
    onlyConfig: c.filter((r) => !a.includes(r)).sort(),
    onlyAssets: a.filter((r) => !c.includes(r)).sort(),
  }
}

function load(dir, role) {
  const text = readFileSync(join(dir, role + ".md"), "utf8")
  const { front, body } = splitFm(text)
  return { text, front, body, yaml: Bun.YAML.parse(front), tier: tierOf(front) }
}

function compare(c, a) {
  const issues = []
  for (const k of ["name", "mode", "steps"]) {
    if (stable(c.yaml[k]) !== stable(a.yaml[k])) issues.push(`${k}: agent=${JSON.stringify(c.yaml[k])} asset=${JSON.stringify(a.yaml[k])}`)
  }
  if (c.tier !== a.tier) issues.push(`# tier: agent=${c.tier} asset=${a.tier}`)
  if (stable(normPerm(c.yaml.permission)) !== stable(normPerm(a.yaml.permission)))
    issues.push(`permission differs (excluding external_directory)`)
  const hc = headings(c.body)
  const ha = headings(a.body)
  if (stable(hc) !== stable(ha)) issues.push(`body headings differ: agent=[${hc}] asset=[${ha}]`)
  return issues
}

function regenerate(c, a) {
  const descLine = a.front.match(/^description:\s*.+$/m)
  if (!descLine) throw new Error("asset has no description")
  const fm = ["---", `name: ${yamlScalar(c.yaml.name)}`, descLine[0], `mode: ${yamlScalar(c.yaml.mode)}`]
  if (c.tier) fm.push(`# tier: ${c.tier}`)
  if (c.yaml.steps != null) fm.push(`steps: ${c.yaml.steps}`)
  fm.push("permission:", serializePermission(c.yaml.permission), "---")
  return fm.join("\n") + "\n" + a.body
}

const args = process.argv.slice(2)
if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(USAGE)
  process.exit(0)
}
const fix = args.includes("--fix")

const { shared, onlyAssets } = listRoles()
let drift = 0
let changed = 0

for (const role of shared) {
  const c = load(AGENTS_DIR, role)
  const a = load(ASSETS_DIR, role)
  const issues = compare(c, a)
  if (issues.length === 0) {
    process.stdout.write(`ok    ${role}\n`)
    continue
  }
  drift++
  process.stdout.write(`DRIFT ${role}\n`)
  for (const i of issues) process.stdout.write(`      - ${i}\n`)
  if (fix) {
    const out = regenerate(c, a)
    if (out !== a.text) {
      writeFileSync(join(ASSETS_DIR, role + ".md"), out)
      changed++
      process.stdout.write(`      fixed -> ${join(ASSETS_DIR, role + ".md")}\n`)
    }
  }
}

for (const r of onlyAssets) process.stdout.write(`note  ${r}: only in assets (no host agent)\n`)

if (fix) {
  process.stdout.write(`\n${changed} asset(s) rewritten, ${drift} drifted\n`)
  process.exit(drift && changed < drift ? 1 : 0)
}
process.exit(drift ? 1 : 0)
