#!/usr/bin/env node
// Two independent patches of the installed superpowers plugin. Idempotent —
// re-run after a superpowers update re-installs the plugin.
//
// 1. Bootstrap skip-list: the plugin injects the (large) `using-superpowers`
//    body into the first user message of every top-level session. `architect`
//    never drives the controller workflow and its context budget is dominated
//    by skill payload, so the bootstrap is pure overhead there. Override the
//    list with SUPERPOWERS_BOOTSTRAP_SKIP_AGENTS="a,b,c".
//
// 2. Skill curation: the plugin registers its entire `skills/` folder, so all
//    superpowers skills are advertised to every session. This points the
//    registration sites (V1 config hook + V2 setup) at a curated folder of
//    symlinks managed by tools/curate-skills.mjs, so only kept skills cost
//    context. The bootstrap is read from the full folder, so it keeps working
//    even though `using-superpowers` is not registered. Curated entries are
//    symlinks, so the registration loop also gets an explicit symlink
//    resolution — its `isDirectory()` check skips symlinked entries otherwise.
//
// The plugin is installed per opencode generation: V2 materializes git plugins
// under ~/.cache/opencode/npm/<slug>/<stamp>/node_modules/<pkg>, while older
// (V1-era) installs live under ~/.cache/opencode/packages/<spec>/node_modules/<pkg>.
// Every copy found in both roots is patched, because whichever copy the running
// generation loads must be patched — patching only `packages/` leaves the V2
// install registering the full `skills/` folder.
//
// Usage: node patch-superpowers.mjs [path/to/superpowers.js]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BOOTSTRAP_MARK = 'BOOTSTRAP_SKIP_AGENTS';
const CURATED_MARK = 'superpowersSkillsCuratedDir';
const PLUGINS_SEG = `.opencode${path.sep}plugins`;

// Cache roots that may hold an installed copy of the plugin: V2 installs git
// plugins into `npm/`, V1-era installs live in `packages/`.
const CACHE_ROOTS = ['npm', 'packages'].map((seg) =>
  path.join(os.homedir(), '.cache', 'opencode', seg),
);

// Every `superpowers.js` under `<root>/**/node_modules/<pkg>/.opencode/plugins`.
// Symlinked package dirs are followed; realpath bookkeeping keeps the walk
// cycle-free.
function findPlugins() {
  const found = [];
  const seen = new Set();
  const stack = CACHE_ROOTS.filter((root) => fs.existsSync(root));
  while (stack.length) {
    const dir = stack.pop();
    let real;
    try {
      real = fs.realpathSync(dir);
    } catch {
      continue;
    }
    if (seen.has(real)) continue;
    seen.add(real);
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name === 'superpowers.js' && full.includes(PLUGINS_SEG)) {
        found.push(full);
        continue;
      }
      let isDir = entry.isDirectory();
      if (!isDir && entry.isSymbolicLink()) {
        try {
          isDir = fs.statSync(full).isDirectory();
        } catch {
          isDir = false;
        }
      }
      if (isDir) stack.push(full);
    }
  }
  return found.sort();
}

const HELPERS_BLOCK = `  return _bootstrapCache.get(toolMapping);
};

// --- Bootstrap skip-list ----------------------------------------------------
//
// Some primaries drive the superpowers controller workflow and want the
// bootstrap; \`architect\` is a pure orchestrator whose context budget is
// already dominated by skill payload, so injecting the (large)
// using-superpowers body into every architect session is pure overhead. Skip
// it there. Override the list with
// SUPERPOWERS_BOOTSTRAP_SKIP_AGENTS="a,b,c".
const BOOTSTRAP_SKIP_AGENTS = new Set(
  (process.env.SUPERPOWERS_BOOTSTRAP_SKIP_AGENTS ?? 'architect')
    .split(',').map((s) => s.trim()).filter(Boolean),
);
const shouldSkipBootstrap = (agent) => !!agent && BOOTSTRAP_SKIP_AGENTS.has(agent);

// V2 session records expose the owning agent; V1 carries it on the message
// info. Returns undefined when the session cannot be read (fail open: inject).
const fetchSessionAgent = async (getSession, sessionID) => {
  if (!sessionID || typeof getSession !== 'function') return undefined;
  try {
    const result = await getSession(sessionID);
    if (!result || typeof result !== 'object' || Array.isArray(result)) return undefined;
    const session = 'data' in result ? result.data : result;
    return session && typeof session === 'object' && !Array.isArray(session)
      ? session.agent
      : undefined;
  } catch {
    return undefined;
  }
};

// --- Task-subagent (child session) detection --------------------------------`;

const BOOTSTRAP_PAIRS = [
  [
    `  return _bootstrapCache.get(toolMapping);
};

// --- Task-subagent (child session) detection --------------------------------`,
    HELPERS_BLOCK,
  ],
  [
    `      const firstUser = output.messages.find(m => m.info.role === 'user');
      if (!firstUser || !firstUser.parts.length) return;

      // Guard: skip if first user message already contains bootstrap.`,
    `      const firstUser = output.messages.find(m => m.info.role === 'user');
      if (!firstUser || !firstUser.parts.length) return;

      // Skip the controller bootstrap for pure-orchestrator agents (V1 carries
      // the agent on the user-message info).
      if (shouldSkipBootstrap(firstUser.info?.agent)) return;

      // Guard: skip if first user message already contains bootstrap.`,
  ],
  [
    `        if (firstUser?.content.some(p => p.type === 'text' && p.text && p.text.includes('EXTREMELY_IMPORTANT'))) return;

        // #2160: the context event carries the sessionID directly. Skip the`,
    `        if (firstUser?.content.some(p => p.type === 'text' && p.text && p.text.includes('EXTREMELY_IMPORTANT'))) return;

        // Skip the controller bootstrap for pure-orchestrator agents.
        if (shouldSkipBootstrap(await fetchSessionAgent(
          (id) => ctx.session.get({ sessionID: id }),
          event.sessionID,
        ))) return;

        // #2160: the context event carries the sessionID directly. Skip the`,
  ],
];

const CURATED_BLOCK = `const superpowersSkillsDir = path.resolve(__dirname, '../../skills');

// Curated registration: opencode only sees the skills symlinked into this
// folder (managed by tools/curate-skills.mjs). The bootstrap below still reads
// from the full superpowersSkillsDir, so it keeps working even though
// \`using-superpowers\` is not among the registered skills. Falls back to the
// full folder when the curated one is absent.
const superpowersSkillsCuratedDir = (() => {
  const curated = path.join(process.env.HOME || '', '.config', 'opencode', 'superpowers-skills-curated');
  try { return fs.existsSync(curated) ? curated : superpowersSkillsDir; } catch { return superpowersSkillsDir; }
})();`;

const CURATED_PAIRS = [
  [`const superpowersSkillsDir = path.resolve(__dirname, '../../skills');`, CURATED_BLOCK],
  [
    `      if (!config.skills.paths.includes(superpowersSkillsDir)) {
        config.skills.paths.push(superpowersSkillsDir);
      }`,
    `      if (!config.skills.paths.includes(superpowersSkillsCuratedDir)) {
        config.skills.paths.push(superpowersSkillsCuratedDir);
      }`,
  ],
  [
    `    if (fs.existsSync(superpowersSkillsDir)) {
      for (const entry of fs.readdirSync(superpowersSkillsDir, { withFileTypes: true })) {`,
    `    if (fs.existsSync(superpowersSkillsCuratedDir)) {
      for (const entry of fs.readdirSync(superpowersSkillsCuratedDir, { withFileTypes: true })) {`,
  ],
];

// The curated folder is a set of symlinks (built by tools/curate-skills.mjs), and
// `readdirSync` does not follow them — `entry.isDirectory()` is false for every
// entry, so without this the registration loop silently registers nothing.
const SYMLINK_MARK = 'curatedEntryIsDir';
const CURATED_SYMLINK_PAIRS = [
  [
    `        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;`,
    `        if (entry.name.startsWith('.')) continue;
        let curatedEntryIsDir = entry.isDirectory();
        if (!curatedEntryIsDir && entry.isSymbolicLink()) {
          try { curatedEntryIsDir = fs.statSync(path.join(superpowersSkillsCuratedDir, entry.name)).isDirectory(); } catch { curatedEntryIsDir = false; }
        }
        if (!curatedEntryIsDir) continue;`,
  ],
];

const PATCH_SETS = [
  ['bootstrap skip-list', BOOTSTRAP_MARK, BOOTSTRAP_PAIRS],
  ['skill curation', CURATED_MARK, CURATED_PAIRS],
  ['curated symlink follow', SYMLINK_MARK, CURATED_SYMLINK_PAIRS],
];

const targets = process.argv[2] ? [process.argv[2]] : findPlugins();
if (targets.length === 0) {
  console.error('superpowers plugin not found under:');
  for (const root of CACHE_ROOTS) console.error(`  ${root}`);
  process.exit(1);
}

let failures = 0;
for (const file of targets) {
  let src = fs.readFileSync(file, 'utf8');
  let touched = false;
  let ok = true;

  for (const [label, mark, pairs] of PATCH_SETS) {
    if (src.includes(mark)) {
      console.log(`${file}: ${label}: already patched`);
      continue;
    }
    for (const [from, to] of pairs) {
      if (!src.includes(from)) {
        console.error(`${file}: ${label}: anchor not found:\n${from.slice(0, 60)}...`);
        ok = false;
        break;
      }
      src = src.replace(from, to);
    }
    if (!ok) break;
    console.log(`${file}: ${label}: applied`);
    touched = true;
  }

  if (!ok) {
    failures++;
    continue;
  }
  if (touched) {
    fs.writeFileSync(file, src);
    console.log(`written: ${file}`);
  } else {
    console.log(`unchanged: ${file}`);
  }
}

process.exit(failures ? 1 : 0);
