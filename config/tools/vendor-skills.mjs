#!/usr/bin/env bun
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"

// vendor-skills — the only supported way to get a skill/plugin into this
// snapshot, and the gate that notices when it was edited here instead.
//
// Source of truth:
//   skills repo  (AlexeyShirshov/skills, default ../../skills)
//     opencode/<skill>/            ->  config/skills/<skill>/
//     opencode/plugins/<plugin>/   ->  config/plugins/<plugin>/
//   this repo (config/)            ->  ~/.config/opencode/  (deploy only, explicit)
//
// Rules enforced here (AGENTS.md §Источник истины):
//   1. Skills and plugins are edited ONLY in the skills repo, tested, committed
//      and pushed there; `--fix` refuses a dirty or unpushed source.
//   2. `config/skills/**` and `config/plugins/<vendored>` are copies. Editing
//      them here is drift -> `--check` exits 1.
//   3. Nothing is written to the host by this tool. A host copy that lags the
//      snapshot is reported as PENDING DEPLOY (informational), never fixed.
//
// Usage:
//   bun config/tools/vendor-skills.mjs --check     # exit 0 ok / 1 drift / 2 no source
//   bun config/tools/vendor-skills.mjs --fix       # copy source -> snapshot + update lock
//   bun config/tools/vendor-skills.mjs --check --host ~/.config/opencode
//
// Env: SKILLS_REPO=/path/to/skills  OPENCODE_CONFIG_DIR=~/.config/opencode

const SCRIPT_DIR = import.meta.dir
const CONFIG_ROOT = resolve(SCRIPT_DIR, "..")
const REPO_ROOT = resolve(CONFIG_ROOT, "..")
const LOCK_PATH = join(REPO_ROOT, "skills.lock.json")

const SOURCE_REPO = process.env.SKILLS_REPO
  ? resolve(process.env.SKILLS_REPO)
  : resolve(REPO_ROOT, "..", "skills")
const HOST_DIR = resolve(
  process.env.OPENCODE_CONFIG_DIR || join(homedir(), ".config", "opencode"),
)

// What this snapshot vendors from the skills repo. A new skill/plugin is added
// here only after it exists (committed + pushed) upstream.
const ITEMS = [
  { kind: "skill", name: "pdca", source: "opencode/pdca", target: "config/skills/pdca" },
  { kind: "skill", name: "pdca-entry", source: "opencode/pdca-entry", target: "config/skills/pdca-entry" },
  { kind: "skill", name: "pdca-coder", source: "opencode/pdca-coder", target: "config/skills/pdca-coder" },
  { kind: "skill", name: "pdca-collection", source: "opencode/pdca-collection", target: "config/skills/pdca-collection" },
  { kind: "skill", name: "pdca-dotnet", source: "opencode/pdca-dotnet", target: "config/skills/pdca-dotnet" },
  { kind: "skill", name: "pdca-incremental", source: "opencode/pdca-incremental", target: "config/skills/pdca-incremental" },
  { kind: "plugin", name: "git-status", source: "opencode/plugins/git-status", target: "config/plugins/git-status" },
  { kind: "plugin", name: "zen-failover", source: "opencode/plugins/zen-failover", target: "config/plugins/zen-failover" },
  { kind: "plugin", name: "clear-session", source: "opencode/plugins/clear-session", target: "config/plugins/clear-session" },
]

// Runtime noise that never belongs to a vendored tree.
const IGNORED = new Set(["__pycache__", "node_modules", ".git", ".pdca", ".DS_Store"])
const IGNORED_SUFFIX = [".pyc", ".pyo", ".swp", ".log"]

const args = process.argv.slice(2)
const check = args.includes("--check")
const fix = args.includes("--fix")
const allowDirty = args.includes("--allow-dirty")
const allowUnpushed = args.includes("--allow-unpushed")
const hostArg = args.indexOf("--host")
const hostDir = hostArg >= 0 ? resolve(args[hostArg + 1] ?? "") : HOST_DIR

if (check === fix) {
  console.error("vendor-skills: pass exactly one of --check or --fix")
  process.exit(2)
}

if (!existsSync(SOURCE_REPO)) {
  console.error(`vendor-skills: skills repo not found: ${SOURCE_REPO}`)
  console.error("  set SKILLS_REPO=/path/to/skills (expected: ../skills next to this repo)")
  process.exit(2)
}

function git(cwd, ...cmd) {
  const r = spawnSync("git", ["-C", cwd, ...cmd], { encoding: "utf8" })
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() }
}

function walk(root, base = root, acc = []) {
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (IGNORED.has(entry.name)) continue
    if (IGNORED_SUFFIX.some((s) => entry.name.endsWith(s))) continue
    const full = join(root, entry.name)
    if (entry.isDirectory()) walk(full, base, acc)
    else if (entry.isFile()) acc.push(relative(base, full))
  }
  return acc
}

function treeHash(root) {
  if (!existsSync(root)) return null
  const files = walk(root)
  const h = createHash("sha256")
  for (const file of files) {
    h.update(file)
    h.update("\0")
    h.update(createHash("sha256").update(readFileSync(join(root, file))).digest("hex"))
    h.update("\n")
  }
  return { hash: h.digest("hex"), files }
}

function diffTrees(sourceRoot, targetRoot) {
  const a = treeHash(sourceRoot)
  const b = treeHash(targetRoot)
  const problems = []
  if (!a) problems.push(`missing in source: ${sourceRoot}`)
  if (!b) problems.push(`missing in snapshot: ${targetRoot}`)
  if (!a || !b) return { problems, changed: true }
  const aSet = new Set(a.files)
  const bSet = new Set(b.files)
  for (const f of a.files) {
    if (!bSet.has(f)) problems.push(`only in source: ${f}`)
    else if (readFileSync(join(sourceRoot, f)).compare(readFileSync(join(targetRoot, f))) !== 0)
      problems.push(`differs: ${f}`)
  }
  for (const f of b.files) if (!aSet.has(f)) problems.push(`only in snapshot: ${f}`)
  return { problems, changed: problems.length > 0 }
}

function readLock() {
  if (!existsSync(LOCK_PATH)) return null
  try {
    return JSON.parse(readFileSync(LOCK_PATH, "utf8"))
  } catch {
    return null
  }
}

const lock = readLock()
const head = git(SOURCE_REPO, "rev-parse", "HEAD")
const branch = git(SOURCE_REPO, "rev-parse", "--abbrev-ref", "HEAD")
const status = git(SOURCE_REPO, "status", "--porcelain")
const upstream = git(SOURCE_REPO, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")

// Source sanity: the snapshot may only take committed, pushed content.
const dirtyPaths = status.ok && status.out
  ? status.out.split("\n").filter(Boolean)
  : []
const sourceDirty = dirtyPaths.length > 0
const pushed = upstream.ok
  ? git(SOURCE_REPO, "merge-base", "--is-ancestor", "HEAD", upstream.out).ok
  : false

if (check) {
  let failed = false
  const lines = []

  if (sourceDirty) {
    failed = true
    lines.push(`SOURCE DIRTY — ${SOURCE_REPO} has uncommitted changes:`)
    for (const p of dirtyPaths.slice(0, 10)) lines.push(`  ${p}`)
    if (dirtyPaths.length > 10) lines.push(`  … ${dirtyPaths.length - 10} more`)
  }
  if (upstream.ok && !pushed) {
    failed = true
    lines.push(`SOURCE UNPUSHED — HEAD is not on ${upstream.out}`)
  }
  if (!upstream.ok) lines.push("SOURCE NO UPSTREAM — cannot confirm HEAD is pushed")

  if (lock && head.ok && lock.commit !== head.out) {
    lines.push(`SOURCE AHEAD — lock pins ${lock.commit.slice(0, 8)}, skills HEAD is ${head.out.slice(0, 8)}; re-run --fix to take it`)
  }

  for (const item of ITEMS) {
    const sourceRoot = join(SOURCE_REPO, item.source)
    const targetRoot = join(REPO_ROOT, item.target)
    const { problems, changed } = diffTrees(sourceRoot, targetRoot)
    const locked = lock?.items?.[`${item.kind}/${item.name}`]
    const current = treeHash(targetRoot)?.hash ?? null
    if (locked && current && locked.hash !== current)
      problems.push("snapshot edited after vendoring (hash differs from skills.lock.json)")
    if (changed || (locked && current && locked.hash !== current)) {
      failed = true
      lines.push(`DRIFT ${item.kind}/${item.name}:`)
      for (const p of problems.slice(0, 8)) lines.push(`  ${p}`)
      if (problems.length > 8) lines.push(`  … ${problems.length - 8} more`)
    }
  }

  // Host is downstream by design: lag is PENDING DEPLOY, not an error.
  const pending = []
  if (hostDir && existsSync(hostDir)) {
    for (const item of ITEMS.filter((i) => i.kind === "skill")) {
      const snapshot = join(REPO_ROOT, item.target)
      const host = join(hostDir, "skills", item.name)
      if (!existsSync(host)) pending.push(`${item.name} (absent on host)`)
      else {
        const { problems } = diffTrees(snapshot, host)
        if (problems.length) pending.push(`${item.name} (${problems.length} path(s))`)
      }
    }
    for (const item of ITEMS.filter((i) => i.kind === "plugin")) {
      const snapshot = join(REPO_ROOT, item.target)
      const host = join(hostDir, "plugins", item.name)
      if (!existsSync(host)) pending.push(`${item.name} (absent on host)`)
      else {
        const { problems } = diffTrees(snapshot, host)
        if (problems.length) pending.push(`${item.name} (${problems.length} path(s))`)
      }
    }
  }

  if (lines.length) {
    console.error("vendor-skills: " + (failed ? "FAIL" : "WARN"))
    for (const l of lines) console.error("  " + l)
  }
  if (pending.length) {
    console.log("PENDING DEPLOY (host lags the snapshot; deploy explicitly, never " +
      "by this tool):")
    for (const p of pending) console.log("  " + p)
  }
  if (failed) {
    console.error("\nFix in the skills repo, then: bun config/tools/vendor-skills.mjs --fix")
    process.exit(1)
  }
  if (!lines.length && !pending.length) console.log("vendor-skills: OK — snapshot matches source and host")
  process.exit(0)
}

// --fix
if (sourceDirty && !allowDirty) {
  console.error("vendor-skills: refusing to vendor a dirty source — commit in the skills repo first")
  for (const p of dirtyPaths.slice(0, 10)) console.error("  " + p)
  process.exit(1)
}
if (upstream.ok && !pushed && !allowUnpushed) {
  console.error(`vendor-skills: refusing to vendor unpushed HEAD — push to ${upstream.out} first`)
  console.error("  (override for a deliberate local bootstrap: --allow-unpushed)")
  process.exit(1)
}
if (!upstream.ok && !allowUnpushed) {
  console.error("vendor-skills: source branch has no upstream — cannot confirm the content is pushed")
  console.error("  (override: --allow-unpushed)")
  process.exit(1)
}
if (!head.ok) {
  console.error("vendor-skills: source is not a git repository", SOURCE_REPO)
  process.exit(1)
}

const items = {}
for (const item of ITEMS) {
  const sourceRoot = join(SOURCE_REPO, item.source)
  const targetRoot = join(REPO_ROOT, item.target)
  if (!existsSync(sourceRoot)) {
    console.error(`vendor-skills: missing source ${item.source} in ${SOURCE_REPO}`)
    process.exit(1)
  }
  rmSync(targetRoot, { recursive: true, force: true })
  cpSync(sourceRoot, targetRoot, {
    recursive: true,
    filter: (src) => {
      const name = src.split("/").pop()
      return !IGNORED.has(name) && !IGNORED_SUFFIX.some((s) => name.endsWith(s))
    },
  })
  items[`${item.kind}/${item.name}`] = {
    source: item.source,
    target: item.target,
    hash: treeHash(targetRoot).hash,
  }
  console.log(`vendored ${item.kind}/${item.name} <- ${item.source}`)
}

const nextLock = {
  source: "github.com/AlexeyShirshov/skills",
  branch: branch.ok ? branch.out : null,
  commit: head.out,
  vendoredAt: new Date().toISOString(),
  items,
}
writeFileSync(LOCK_PATH, JSON.stringify(nextLock, null, 2) + "\n")
console.log(`lock updated: ${relative(REPO_ROOT, LOCK_PATH)} @ ${head.out.slice(0, 8)}`)
