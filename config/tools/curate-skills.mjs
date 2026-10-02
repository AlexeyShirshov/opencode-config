#!/usr/bin/env bun
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  lstatSync,
  unlinkSync,
  readlinkSync,
  realpathSync,
} from "node:fs"
import { join, dirname, relative, resolve } from "node:path"
import { homedir } from "node:os"

const ROOT = process.env.OPENCODE_CONFIG_DIR || join(homedir(), ".config", "opencode")
const PLUGINS_SEG = join(".opencode", "plugins")

const USAGE = `curate-skills — register only the kept skills from a pack

Each pack is exposed to opencode as a folder of symlinks rebuilt from a keep-list;
the full pack stays untouched (readable on demand) and costs no context.

  dotnet       ${join(ROOT, "skills-deepseek")}
               -> ${join(ROOT, "skills-deepseek-curated")}   (keep-list ${join(ROOT, "skills-keep.txt")})
  superpowers  <plugin>/skills
               -> ${join(ROOT, "superpowers-skills-curated")}   (keep-list ${join(ROOT, "superpowers-skills-keep.txt")})

Usage:
  bun tools/curate-skills.mjs [--check] [--pack dotnet|superpowers]   report drift, exit 1 (default: all packs)
  bun tools/curate-skills.mjs --fix  [--pack ...]                     (re)build the symlink folders
  bun tools/curate-skills.mjs --help
`

function findSuperpowersSkills() {
  const root = join(homedir(), ".cache", "opencode", "packages")
  if (!existsSync(root)) return null
  const stack = readdirSync(root)
    .filter((e) => e.startsWith("superpowers@"))
    .map((e) => join(root, e))
  while (stack.length) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.name === "superpowers.js" && full.includes(PLUGINS_SEG)) {
        const skills = resolve(dirname(full), "..", "..", "skills")
        return existsSync(skills) ? skills : null
      }
    }
  }
  return null
}

function packs() {
  const list = [
    {
      name: "dotnet",
      pack: join(ROOT, "skills-deepseek"),
      curated: join(ROOT, "skills-deepseek-curated"),
      keep: join(ROOT, "skills-keep.txt"),
    },
  ]
  const sp = findSuperpowersSkills()
  if (sp) {
    list.push({
      name: "superpowers",
      pack: sp,
      curated: join(ROOT, "superpowers-skills-curated"),
      keep: join(ROOT, "superpowers-skills-keep.txt"),
    })
  }
  return list
}

function readKeep(file) {
  const names = []
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.replace(/#.*$/, "").trim()
    if (line) names.push(line)
  }
  return names
}

function isSymlink(p) {
  try {
    return lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

function linkWant(pack, name) {
  return relative(pack.curated, join(pack.pack, name))
}

function planPack(pack) {
  if (!existsSync(pack.pack)) return { pack, error: `pack not found: ${pack.pack}` }
  if (!existsSync(pack.keep)) return { pack, error: `keep-list not found: ${pack.keep}` }
  const keep = readKeep(pack.keep)
  const seen = new Set()
  const dupes = keep.filter((n) => (seen.has(n) ? true : (seen.add(n), false)))
  const missing = keep.filter((n) => !existsSync(join(pack.pack, n, "SKILL.md")))
  const desired = new Set(keep)
  const present = existsSync(pack.curated) ? readdirSync(pack.curated) : []
  const toRemove = present.filter((n) => !desired.has(n))
  const toFix = []
  for (const n of keep) {
    const link = join(pack.curated, n)
    const want = linkWant(pack, n)
    if (!isSymlink(link)) {
      toFix.push(n)
      continue
    }
    let cur = null
    try {
      cur = readlinkSync(link)
    } catch {}
    if (cur !== want || !existsSync(link)) toFix.push(n)
  }
  return { pack, keep, dupes, missing, present, toRemove, toFix }
}

const args = process.argv.slice(2)
if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(USAGE)
  process.exit(0)
}
const fix = args.includes("--fix")
const onlyIdx = args.indexOf("--pack")
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null

let drift = 0
let errors = 0

for (const pack of packs()) {
  if (only && only !== pack.name) continue
  const p = planPack(pack)
  if (p.error) {
    process.stdout.write(`[${pack.name}] ${p.error}\n`)
    errors++
    continue
  }
  const { keep, dupes, missing, present, toRemove, toFix } = p
  process.stdout.write(`[${pack.name}] pack=${pack.pack}\n`)
  process.stdout.write(`[${pack.name}] keep-list: ${keep.length} skills; curated: ${present.length} entries\n`)
  for (const d of dupes) process.stdout.write(`[${pack.name}] WARN  duplicate in keep-list: ${d}\n`)
  for (const m of missing) process.stdout.write(`[${pack.name}] ERROR missing in pack: ${m}\n`)
  if (toRemove.length) process.stdout.write(`[${pack.name}] stale   ${toRemove.length}: ${toRemove.join(", ")}\n`)
  if (toFix.length) process.stdout.write(`[${pack.name}] add/fix ${toFix.length}: ${toFix.join(", ")}\n`)
  errors += missing.length
  drift += dupes.length + toRemove.length + toFix.length

  if (fix) {
    if (missing.length) {
      process.stdout.write(`[${pack.name}] refusing to write: missing kept skills\n`)
      continue
    }
    mkdirSync(pack.curated, { recursive: true })
    let changed = 0
    for (const n of toRemove) {
      unlinkSync(join(pack.curated, n))
      changed++
    }
    for (const n of toFix) {
      const link = join(pack.curated, n)
      if (isSymlink(link)) unlinkSync(link)
      symlinkSync(linkWant(pack, n), link, "dir")
      changed++
    }
    process.stdout.write(`[${pack.name}] ${changed} change(s) applied -> ${pack.curated}\n`)
    if (keep[0]) {
      try {
        process.stdout.write(`[${pack.name}] realpath sample: ${realpathSync(join(pack.curated, keep[0]))}\n`)
      } catch {}
    }
  }
}

if (fix) {
  process.exit(errors ? 1 : 0)
}
process.stdout.write(drift || errors ? `\n${drift} change(s), ${errors} error(s) — run with --fix\n` : `\nup to date\n`)
process.exit(drift || errors ? 1 : 0)
