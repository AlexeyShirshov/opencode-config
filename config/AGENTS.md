# Global rules

## C# symbols: Roslyn only

- Never use `rg`, `grep`, `glob` or any text search for C# symbol questions — type/member definitions, references, call sites, implementations, overloads, members, renames, impact analysis. Use the `roslyn` tool for these, always, including as the very first step.
- `rg`/`grep` are allowed only for non-symbol text: string literals, comments, docs/markdown, config files, non-`.cs` files, or as a last-resort pre-filter when `roslyn` cannot load a solution or has no C# file. If you fall back to text search, say so explicitly and do not present it as a resolved symbol.
- Do not infer a symbol, its references or its call sites from text search, and never rename via `sed`. Discover names with `roslyn structure` / `types` / `members`, then answer with `refs` / `callers` / `implementations`, then change code with `roslyn rename`.
- The `roslyn` CLI is daemon-backed: the first call loads the solution (a few seconds), later calls are milliseconds. "rg is faster" is never a valid reason to use it for symbols.
- If you notice yourself reaching for `rg` on a symbol, stop and call `roslyn` instead. A text-only answer to a symbol question is a bug.
