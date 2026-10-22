#!/usr/bin/env bun
// check-host-contract — host-side invariants for this repository.
//
// Why this file exists: skills may only test the `pdca-*` roles they describe.
// Everything here concerns artifacts that live *only* in opencode-config —
// `architect`/`coder`/`scout` briefs, `AGENTS.md` routing, profiles, README and
// the absence of project specifics. Those checks used to sit in the skills repo
// and broke it whenever this repo changed a word.
//
// Usage:
//   bun config/tools/check-host-contract.mjs [--json]
// Exit 1 on any violation.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { dirname, join, basename, relative } from "node:path"

const HERE = dirname(new URL(import.meta.url).pathname)
const ROOT = dirname(HERE) // config/
const AGENTS = join(ROOT, "agents")
const PROFILES = join(ROOT, "profiles")

const json = process.argv.includes("--json")
const problems = []
const fail = (msg) => problems.push(msg)

const read = (p) => readFileSync(p, "utf8")
const exists = (p) => existsSync(p)

const DEAD_ROLES = ["planner", "check", "escalate", "security-auditor"]
const AGENT_FILES = readdirSync(AGENTS).filter((f) => f.endsWith(".md"))
const agentIds = new Set(AGENT_FILES.map((f) => basename(f, ".md")))

function splitFront(text, where) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) {
    fail(`${where}: missing frontmatter`)
    return null
  }
  return { front: m[1], body: m[2] }
}

const unquote = (s) => s.replace(/^["']|["']$/g, "")

function parseJsonc(text) {
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, ""))
}

// Agents bound in any profile (used before the profile section is checked).
const BOUND_ELSEWHERE = new Set()
for (const f of readdirSync(PROFILES).filter((f) => f.endsWith(".jsonc"))) {
  try {
    for (const role of Object.keys(parseJsonc(read(join(PROFILES, f))).agent ?? {}))
      BOUND_ELSEWHERE.add(role)
  } catch {
    /* reported by the profile section */
  }
}

// Minimal YAML-ish reader for `- action: X / resource: Y / effect: Z` lists.
function v2Rules(front) {
  const rules = []
  let cur = null
  for (const line of front.split("\n")) {
    const a = line.match(/^\s*-\s*action:\s*(\S+)/)
    if (a) {
      cur = { action: unquote(a[1]), resource: null, effect: null }
      rules.push(cur)
      continue
    }
    const r = line.match(/^\s*resource:\s*(.+?)\s*$/)
    if (r && cur) cur.resource = unquote(r[1])
    const e = line.match(/^\s*effect:\s*(\S+)/)
    if (e && cur) cur.effect = unquote(e[1])
  }
  return rules
}

// Shorthand dialect used by the `pdca-*` briefs — `permission:` plus
// `action: effect` (resource `*`) or `action:` + nested `resource: effect`.
function shortRules(front) {
  const rules = []
  const lines = front.split("\n")
  const start = lines.findIndex((l) => /^permission:\s*$/.test(l))
  if (start === -1) return rules
  let base = null
  let cur = null
  for (const line of lines.slice(start + 1)) {
    if (!line.trim() || /^\s*#/.test(line)) continue
    if (!/^\s/.test(line)) break // the next top-level key closes the block
    const indent = line.match(/^\s*/)[0].length
    const m = line.match(/^\s*("?[^\s:"#]+"?)\s*:\s*(.*?)\s*$/)
    if (!m) continue
    if (base === null) base = indent
    const key = unquote(m[1])
    const val = unquote(m[2])
    if (indent <= base) {
      cur = val ? null : key
      if (val) rules.push({ action: key, resource: "*", effect: val })
    } else if (cur) {
      rules.push({ action: cur, resource: key, effect: val })
    }
  }
  return rules
}

// Last matching rule wins; `*` on either side matches anything.
function effective(rules, action, resource) {
  let eff = null
  for (const r of rules) {
    const a = r.action === action || r.action === "*"
    const s = r.resource === resource || r.resource === "*"
    if (a && s) eff = r.effect
  }
  return eff
}
function allowedResources(rules, action) {
  return rules
    .filter((r) => r.action === action && r.resource !== "*" && r.effect === "allow")
    .map((r) => r.resource)
}

// ── agents: shared frontmatter rules ────────────────────────────────────────
// Legacy V1 lens agents (dotnet-*, docfx-specialist) carry neither `mode:` nor
// `# tier:` and are not bound in profiles; they are left as they are. Every
// tiered or profile-bound agent must be well-formed.
for (const f of AGENT_FILES) {
  const where = `agents/${f}`
  const id = basename(f, ".md")
  const parsed = splitFront(read(join(AGENTS, f)), where)
  if (!parsed) continue
  const { front } = parsed
  if (!/^description:/m.test(front)) fail(`${where}: missing description`)
  if (/^model:/m.test(front)) fail(`${where}: model: must live in profiles, not in the brief`)
  const name = front.match(/^name:\s*(\S+)/m)?.[1]
  if (name && name !== id) fail(`${where}: name: ${name} != filename stem ${id}`)
  const tier = front.match(/^#\s*tier:\s*(\S+)/m)?.[1]
  const governed = tier !== undefined || BOUND_ELSEWHERE.has(id)
  if (!governed) continue
  if (!["cheap", "medium", "strong"].includes(tier)) fail(`${where}: missing/!= # tier: cheap|medium|strong`)
  const mode = front.match(/^mode:\s*(\S+)/m)?.[1]
  if (!["primary", "subagent"].includes(mode)) fail(`${where}: mode must be primary|subagent`)
}

// ── architect: env primary, never a PDCA role ───────────────────────────────
{
  const where = "agents/architect.md"
  const p = join(AGENTS, "architect.md")
  if (!exists(p)) fail(`${where}: missing`)
  else {
    const { front, body } = splitFront(read(p), where) ?? {}
    if (body) {
      const pdca = body.match(/pdca-(planner|check|escalate|executor|orchestrator|scout|security-auditor)/gi)
      if (pdca) fail(`${where}: mentions PDCA roles (${[...new Set(pdca)].join(", ")}); architect is an env agent`)
      for (const token of ["scout", "coder", "brainstorming"]) {
        if (!body.includes(token)) fail(`${where}: body no longer states the ${token} boundary`)
      }
    }
    if (front) {
      const rules = v2Rules(front)
      if (effective(rules, "*", "*") !== "deny") fail(`${where}: permissions must start from *: deny`)
      const sub = new Set(allowedResources(rules, "subagent"))
      if ([...sub].sort().join(",") !== "coder,scout")
        fail(`${where}: subagent allowlist must be exactly scout+coder, got [${[...sub].sort()}]`)
      if (allowedResources(rules, "skill").join(",") !== "brainstorming")
        fail(`${where}: skill allowlist must be exactly brainstorming`)
      for (const wide of ["read", "grep", "glob", "shell", "edit", "webfetch", "websearch"]) {
        if (effective(rules, wide, "*") !== "deny") fail(`${where}: ${wide} must be denied`)
      }
    }
  }
}

// ── coder: evidence → inner loop → git, and the inner-loop policy ───────────
{
  const where = "agents/coder.md"
  const p = join(AGENTS, "coder.md")
  if (!exists(p)) fail(`${where}: missing`)
  else {
    const body = splitFront(read(p), where)?.body ?? ""
    const evidence = body.indexOf("**Evidence, not claims")
    const inner = body.indexOf("**Inner loop")
    const git = body.indexOf("**Git.**")
    if (!(evidence >= 0 && inner > evidence && git > inner))
      fail(`${where}: expected Evidence → Inner loop → Git anchors in this order`)
    if (inner >= 0) {
      const bullet = body.slice(inner, git > inner ? git : undefined)
      for (const [label, re] of [
        ["affected subset", /affected|subset/i],
        ["unit runs", /unit/i],
        ["integration runs", /integration/i],
        ["--filter is not the criterion", /filter/i],
        ["boundary", /boundary/i],
        ["no whole-solution run", /whole solution/i],
        ["raw journal", /journal/i],
      ])
        if (!re.test(bullet)) fail(`${where}: inner-loop bullet lost: ${label}`)
    }
    for (const token of ["durable state", "defect history"])
      if (!body.toLowerCase().includes(token)) fail(`${where}: body lost "${token}"`)
  }
}

// ── scout: read-only, no subagents ──────────────────────────────────────────
{
  const where = "agents/scout.md"
  const p = join(AGENTS, "scout.md")
  const { front, body } = (exists(p) && splitFront(read(p), where)) || {}
  if (body && !/read-only/i.test(body)) fail(`${where}: body must state read-only`)
  if (front) {
    const rules = v2Rules(front)
    for (const action of ["edit", "subagent"]) {
      if (effective(rules, action, "*") !== "deny") fail(`${where}: ${action} must be denied`)
    }
  }
}

// ── pdca-orchestrator: dispatcher-only task allowlist ───────────────────────
{
  const where = "agents/pdca-orchestrator.md"
  const p = join(AGENTS, "pdca-orchestrator.md")
  const { front } = (exists(p) && splitFront(read(p), where)) || {}
  if (front) {
    const rules = shortRules(front)
    if (effective(rules, "task", "*") !== "deny") fail(`${where}: task must start from *: deny`)
    const expected = [
      "pdca-planner",
      "pdca-executor",
      "pdca-check",
      "pdca-escalate",
      "pdca-scout",
      "pdca-security-auditor",
      "docfx-specialist",
      "dotnet-*",
    ]
    const got = allowedResources(rules, "task").sort()
    if (got.join(",") !== expected.slice().sort().join(","))
      fail(`${where}: task allowlist drifted, got [${got}]`)
    // `write` is part of `edit` in V2, so only the real actions are pinned.
    for (const action of ["edit", "bash"])
      if (effective(rules, action, "*") !== "deny")
        fail(`${where}: ${action} must be denied (dispatcher only)`)
  }
}

// ── pdca-security-auditor: exactly three read-only skills ───────────────────
{
  const where = "agents/pdca-security-auditor.md"
  const p = join(AGENTS, "pdca-security-auditor.md")
  const { front } = (exists(p) && splitFront(read(p), where)) || {}
  if (front) {
    const rules = shortRules(front)
    if (effective(rules, "skill", "*") !== "deny") fail(`${where}: skill must start from *: deny`)
    const expected = ["dotnet-security-owasp", "dotnet-secrets-management", "dotnet-cryptography"]
    const got = allowedResources(rules, "skill").sort()
    if (got.join(",") !== expected.slice().sort().join(","))
      fail(`${where}: skill allowlist must be exactly three skills, got [${got}]`)
    if (effective(rules, "edit", "*") !== "deny") fail(`${where}: edit must be denied (read-only auditor)`)
  }
}

// ── retired bare roles must never come back ─────────────────────────────────
for (const role of DEAD_ROLES) {
  if (exists(join(AGENTS, `${role}.md`))) fail(`agents/${role}.md: retired role file is back`)
  if (role === "security-auditor" && exists(join(AGENTS, "lane.md")))
    fail("agents/lane.md: retired orchestrator name is back")
}
if (exists(join(AGENTS, "lane.md"))) fail("agents/lane.md: legacy orchestrator name is back")

// ── AGENTS.md: central routing wording ──────────────────────────────────────
{
  const where = "AGENTS.md"
  const p = join(ROOT, "AGENTS.md")
  if (!exists(p)) fail(`${where}: missing`)
  else {
    const text = read(p)
    for (const token of [
      "cheap orchestrator",
      "medium/strong primary",
      "does not dispatch the cycle",
      "rights of expensive roles are never widened",
      "skill pdca",
      "pdca-entry",
    ])
      if (!text.includes(token)) fail(`${where}: missing routing clause "${token}"`)
    for (const stale of ["picks the cycle variant", "Trigger phrases «по циклу»"])
      if (text.includes(stale)) fail(`${where}: stale wording "${stale}"`)
  }
}

// ── profiles: bindings must point at live agents ────────────────────────────
for (const f of readdirSync(PROFILES).filter((f) => f.endsWith(".jsonc"))) {
  const where = `profiles/${f}`
  let cfg
  try {
    cfg = parseJsonc(read(join(PROFILES, f)))
  } catch (e) {
    fail(`${where}: does not parse as JSONC (${e.message})`)
    continue
  }
  const bound = Object.keys(cfg.agent ?? {})
  for (const role of bound) {
    if (DEAD_ROLES.includes(role)) fail(`${where}: binds retired role "${role}"`)
    else if (!agentIds.has(role)) fail(`${where}: binds unknown agent "${role}"`)
  }
  for (const role of ["pdca-planner", "pdca-check", "pdca-escalate", "pdca-executor", "pdca-orchestrator"]) {
    if (!bound.includes(role)) fail(`${where}: no model binding for ${role}`)
  }
  for (const [role, spec] of Object.entries(cfg.agent ?? {})) {
    const model = spec?.model
    if (!model || !/^[\w.-]+\/[\w.-]+$/.test(model))
      fail(`${where}: ${role} has no provider/model id`)
  }
}

// ── curated always-on pack must not spend context on cycle skills ───────────
{
  const p = join(ROOT, "skills-keep.txt")
  if (exists(p)) {
    const lines = new Set(
      read(p).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")),
    )
    for (const skill of ["pdca", "pdca-coder", "pdca-dotnet"])
      if (lines.has(skill)) fail(`skills-keep.txt: cycle skill "${skill}" is in the always-on pack`)
  }
}

// ── README: deploy/contract summary stays accurate ──────────────────────────
{
  const p = join(dirname(ROOT), "README.md")
  if (exists(p)) {
    const text = read(p)
    for (const token of ["подробный контракт", "n/3", "ревизи", "ровно одна активная", "без вопросов", "# tier:"])
      if (!text.includes(token)) fail(`README.md: missing summary clause "${token}"`)
    if (!text.includes("rsync -a config/")) fail("README.md: deploy must copy without --delete")
    if (text.includes("~1460") || /контракт\s+~?\d+\s+строк/.test(text))
      fail("README.md: brittle line-count claim is back")
    if (text.includes("пустым `model:`")) fail("README.md: stale empty-model claim is back")
  }
}

// ── no project specifics above the config layer ─────────────────────────────
const SKIP_DIRS = new Set(["node_modules", ".git", "v1", "skills", "skills-deepseek", "tools"])
const PROJECT_RE = /\b(nextorm|webpdca)\b|лейн\s+T\d+|lane\s+T\d+/i
const TEXT_EXT = /\.(md|jsonc?|txt|mjs|js|ts|sh|py|ya?ml)$/
function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) scan(p)
      continue
    }
    if (!TEXT_EXT.test(entry)) continue
    const rel = relative(ROOT, p)
    read(p)
      .split("\n")
      .forEach((line, i) => {
        if (PROJECT_RE.test(line)) fail(`config/${rel}:${i + 1}: project-specific mention "${line.trim()}"`)
      })
  }
}
scan(ROOT)

// ── report ─────────────────────────────────────────────────────────────────
if (json) {
  console.log(JSON.stringify({ ok: problems.length === 0, problems }, null, 2))
} else if (problems.length) {
  console.error(`check-host-contract: ${problems.length} problem(s)`)
  for (const p of problems) console.error(`  ✗ ${p}`)
} else {
  console.log("check-host-contract: OK")
}
process.exit(problems.length ? 1 : 0)
