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
//    even though `using-superpowers` is not registered.
//
// Usage: node patch-superpowers.mjs [path/to/superpowers.js]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BOOTSTRAP_MARK = 'BOOTSTRAP_SKIP_AGENTS';
const CURATED_MARK = 'superpowersSkillsCuratedDir';
const PLUGINS_SEG = `.opencode${path.sep}plugins`;

function findPlugin() {
  const root = path.join(os.homedir(), '.cache', 'opencode', 'packages');
  const stack = fs.readdirSync(root)
    .filter((entry) => entry.startsWith('superpowers@'))
    .map((entry) => path.join(root, entry));
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.name === 'superpowers.js' && full.includes(PLUGINS_SEG)) {
        return full;
      }
    }
  }
  throw new Error(`superpowers plugin not found under ${root}`);
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

const file = process.argv[2] || findPlugin();
let src = fs.readFileSync(file, 'utf8');
let touched = false;

for (const [label, mark, pairs] of [
  ['bootstrap skip-list', BOOTSTRAP_MARK, BOOTSTRAP_PAIRS],
  ['skill curation', CURATED_MARK, CURATED_PAIRS],
]) {
  if (src.includes(mark)) {
    console.log(`${label}: already patched`);
    continue;
  }
  for (const [from, to] of pairs) {
    if (!src.includes(from)) {
      console.error(`${label}: anchor not found in ${file}:\n${from.slice(0, 60)}...`);
      process.exit(1);
    }
    src = src.replace(from, to);
  }
  console.log(`${label}: applied`);
  touched = true;
}

if (touched) {
  fs.writeFileSync(file, src);
  console.log(`written: ${file}`);
} else {
  console.log(`unchanged: ${file}`);
}
