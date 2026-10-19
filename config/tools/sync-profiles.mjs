#!/usr/bin/env bun
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"

// sync-profiles — copy profiles from the snapshot repo to the installed config,
// but never silently clobber an installed copy that has unsynced edits.
//
// Why: profiles used to be edited directly in ~/.config/opencode/profiles/.
// A later `cp config/profiles/* ~/.config/opencode/profiles/` (or the recovery
// rsync) then reverted those edits without any warning. mtime alone is not
// enough: the repo file can be newer while the installed file still carries
// local changes. The guard therefore records the hash of the last successful
// sync and refuses to overwrite an installed file whose hash differs from it.
//
// Usage:
//   bun tools/sync-profiles.mjs                 report drift (default; exit 1 drift, 2 local edits)
//   bun tools/sync-profiles.mjs --fix           copy safe files; refuse local edits (exit 2)
//   bun tools/sync-profiles.mjs --fix --force   overwrite even local edits
//   bun tools/sync-profiles.mjs --source DIR --target DIR
//   bun tools/sync-profiles.mjs --help

const HERE = dirname(new URL(import.meta.url).pathname)
const REPO_CONFIG = dirname(HERE)
const DEFAULT_SOURCE = join(REPO_CONFIG, "profiles")
const DEFAULT_TARGET = join(
  process.env.OPENCODE_CONFIG_DIR || join(homedir(), ".config", "opencode"),
  "profiles",
)

const args = process.argv.slice(2)
const HELP = args.includes("--help") || args.includes("-h")
const FIX = args.includes("--fix")
const FORCE = args.includes("--force")

function takeValue(flag) {
  const i = args.findIndex((a) => a === flag || a.startsWith(`${flag}=`))
  if (i < 0) return null
  if (args[i].includes("=")) return args[i].slice(args[i].indexOf("=") + 1)
  return args[i + 1] ?? null
}

const SOURCE = resolve(takeValue("--source") || DEFAULT_SOURCE)
const TARGET = resolve(takeValue("--target") || DEFAULT_TARGET)
// Keep the state outside the profile directory for the real install: a careless
// `rsync --delete` must not be able to erase the baseline that proves the copy
// would lose local edits. Custom targets are self-contained for tests/scratch.
const STATE_DIR =
  process.env.OPENCODE_STATE_DIR || join(homedir(), ".local", "state", "opencode")
const STATE_FILE =
  TARGET === DEFAULT_TARGET ? join(STATE_DIR, "sync-profiles.json") : join(TARGET, ".sync-profiles.json")

const USAGE = `sync-profiles — safe sync of profiles from the snapshot repo to the installed config

  source  ${SOURCE}
  target  ${TARGET}

A profile is copied only when the installed file is unchanged since the last
successful sync. If the installed file differs from the last recorded hash
(local edit), the copy is refused and the role/model diff is printed; the next
\`rsync\` would otherwise silently revert it.

Usage:
  bun tools/sync-profiles.mjs                 report drift, exit 1 (drift) / 2 (local edit)
  bun tools/sync-profiles.mjs --fix           copy safe profiles, exit 2 if any local edit
  bun tools/sync-profiles.mjs --fix --force   overwrite local edits too (explicit override)
  bun tools/sync-profiles.mjs --source DIR --target DIR
  bun tools/sync-profiles.mjs --help
`

if (HELP) {
  console.log(USAGE)
  process.exit(0)
}

if (SOURCE === TARGET) {
  console.error("sync-profiles: source and target are the same directory.")
  console.error("Run it from the snapshot repo (config/tools/…) or pass --source/--target.")
  process.exit(2)
}

if (!existsSync(SOURCE)) {
  console.error(`sync-profiles: source not found: ${SOURCE}`)
  process.exit(2)
}

mkdirSync(TARGET, { recursive: true })

// ---------------------------------------------------------------- JSONC parse
// Only needed for the human-readable agent diff; a parse failure is not fatal.
function stripComments(text) {
  let out = ""
  let i = 0
  let inStr = false
  let esc = false
  while (i < text.length) {
    const c = text[i]
    if (inStr) {
      out += c
      if (esc) esc = false
      else if (c === "\\") esc = true
      else if (c === '"') inStr = false
      i++
      continue
    }
    if (c === '"') {
      inStr = true
      out += c
      i++
      continue
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++
      continue
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}

function stripTrailingCommas(text) {
  let out = ""
  let i = 0
  let inStr = false
  let esc = false
  while (i < text.length) {
    const c = text[i]
    if (inStr) {
      out += c
      if (esc) esc = false
      else if (c === "\\") esc = true
      else if (c === '"') inStr = false
      i++
      continue
    }
    if (c === '"') {
      inStr = true
      out += c
      i++
      continue
    }
    if (c === ",") {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j])) j++
      if (text[j] === "}" || text[j] === "]") {
        i++
        continue
      }
    }
    out += c
    i++
  }
  return out
}

function parseJsonc(text) {
  return JSON.parse(stripTrailingCommas(stripComments(text)))
}

// ------------------------------------------------------------------- helpers
const sha = (text) => createHash("sha256").update(text).digest("hex")
const short = (h) => (h ? h.slice(0, 12) : "-")
const fmtTime = (path) => {
  try {
    return statSync(path).mtime.toISOString().replace("T", " ").slice(0, 19)
  } catch {
    return "-"
  }
}

function readState() {
  if (!existsSync(STATE_FILE)) return { version: 1, files: {} }
  try {
    const state = JSON.parse(readFileSync(STATE_FILE, "utf8"))
    return { version: 1, files: state.files || {} }
  } catch {
    return { version: 1, files: {} }
  }
}

function writeState(state) {
  mkdirSync(dirname(STATE_FILE), { recursive: true })
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)
}

function modelOf(role) {
  if (!role || typeof role !== "object") return "(none)"
  const model = role.model ?? role.providerID ?? "(none)"
  const variant = role.variant ? `#${role.variant}` : ""
  return `${model}${variant}`
}

function agentDiff(repoDoc, installedDoc) {
  const repo = repoDoc?.agent || repoDoc?.agents || {}
  const installed = installedDoc?.agent || installedDoc?.agents || {}
  const keys = [...new Set([...Object.keys(repo), ...Object.keys(installed)])].sort()
  return keys
    .filter((key) => JSON.stringify(repo[key]) !== JSON.stringify(installed[key]))
    .map((key) => `    ${key}: installed=${modelOf(installed[key])}  repo=${modelOf(repo[key])}`)
}

function unifiedDiff(installedPath, repoPath, file) {
  const result = spawnSync(
    "diff",
    ["-u", "--label", `${file} (installed)`, "--label", `${file} (repo)`, installedPath, repoPath],
    { encoding: "utf8" },
  )
  return result.stdout?.trimEnd() || ""
}

// ---------------------------------------------------------------------- main
const repoFiles = readdirSync(SOURCE).filter((f) => f.endsWith(".jsonc")).sort()
const installedFiles = new Set(
  existsSync(TARGET) ? readdirSync(TARGET).filter((f) => f.endsWith(".jsonc")) : [],
)
const state = readState()

let ok = 0
let drift = 0
let danger = 0

for (const file of repoFiles) {
  installedFiles.delete(file)
  const repoPath = join(SOURCE, file)
  const installedPath = join(TARGET, file)
  const repoText = readFileSync(repoPath, "utf8")

  if (!existsSync(installedPath)) {
    console.log(`${file}: NEW — installed profile does not exist`)
    if (FIX) {
      writeFileSync(installedPath, repoText)
      state.files[file] = { sha256: sha(repoText), syncedAt: new Date().toISOString() }
      console.log("  copied")
    } else {
      drift++
    }
    continue
  }

  const installedText = readFileSync(installedPath, "utf8")
  const same = repoText === installedText
  const lastSha = state.files[file]?.sha256
  const installedSha = sha(installedText)
  const localEdit = lastSha ? installedSha !== lastSha : null
  const repoNewer =
    statSync(repoPath).mtimeMs > statSync(installedPath).mtimeMs

  if (same) {
    console.log(`${file}: OK`)
    ok++
    if (FIX) state.files[file] = { sha256: installedSha, syncedAt: new Date().toISOString() }
    continue
  }

  // No recorded baseline: only the repo-newer direction is potentially safe,
  // and even that is unproven. Treat it as a local edit and require --force.
  const unknown = localEdit === null
  const unsafe = localEdit === true || unknown

  const label = unsafe ? "LOCAL-EDIT" : "DRIFT"
  console.log(`${file}: ${label}`)
  console.log(`  repo       ${fmtTime(repoPath)}  sha256:${short(sha(repoText))}`)
  console.log(`  installed  ${fmtTime(installedPath)}  sha256:${short(installedSha)}`)

  let repoDoc = null
  let installedDoc = null
  try {
    repoDoc = parseJsonc(repoText)
    installedDoc = parseJsonc(installedText)
  } catch {
    // fall through to a raw diff
  }
  const roles = repoDoc && installedDoc ? agentDiff(repoDoc, installedDoc) : []
  if (roles.length) {
    console.log("  agent:")
    for (const line of roles) console.log(line)
  }

  if (unsafe && !FORCE) {
    const reason = unknown
      ? "no sync state recorded; cannot prove the installed copy has no local edits"
      : lastSha
        ? "installed file differs from the last successful sync"
        : "no sync state recorded"
    console.log(`  refused: ${reason}`)
    if (repoNewer) {
      console.log("  note: the repo file is newer, but that does not prove the installed copy is untouched")
    }
    const diff = unifiedDiff(installedPath, repoPath, file)
    if (diff) {
      console.log(diff)
    } else if (!roles.length) {
      console.log("  (binary or unparsable diff; inspect both files manually)")
    }
    console.log("  fix: move the change into the repo, or use --fix --force to overwrite")
    danger++
    continue
  }

  if (unsafe && FORCE) {
    console.log("  forced overwrite (--force)")
  }

  if (FIX) {
    writeFileSync(installedPath, repoText)
    state.files[file] = { sha256: sha(repoText), syncedAt: new Date().toISOString() }
    console.log("  copied")
    ok++
  } else {
    console.log("  fix: bun tools/sync-profiles.mjs --fix")
    drift++
  }
}

for (const extra of installedFiles) {
  console.log(`${extra}: installed-only (not managed by ${SOURCE})`)
}

if (FIX) {
  writeState(state)
  console.log(
    danger
      ? `\nsync-profiles: ${ok} synced/ok, ${danger} refused (local edits)`
      : `\nsync-profiles: ${ok} synced/ok`,
  )
  process.exit(danger ? 2 : 0)
}

console.log(
  `\nsync-profiles: ${ok} ok, ${drift} drift, ${danger} local edit${danger === 1 ? "" : "s"}`,
)
if (danger) {
  console.log("Run --fix to sync safe files; local edits need --fix --force or a repo edit.")
  process.exit(2)
}
if (drift) {
  console.log("Run --fix to copy the repo versions.")
  process.exit(1)
}
process.exit(0)
