---
name: obsidian-plugin-dev-release
description: Develop, build, version, release and submit an Obsidian community plugin. This skill should be used when the user asks to create a new Obsidian plugin, modify or debug an existing one, publish a new version, or submit a plugin to the Obsidian community marketplace. Covers the TypeScript plus esbuild project layout, manifest.json compliance rules, the Windows process-spawn pitfalls (exit code 9009, missing PATHEXT), GitHub Actions release automation, and the current marketplace submission flow.
agent_created: true
---

# Obsidian plugin: develop, release, submit

## Purpose

Take an Obsidian plugin from source to a published community release without rediscovering the
rules each time. The valuable parts are the non-obvious ones: what `manifest.json` must contain to
pass review, why spawning an external program fails on Windows, how a release must be tagged, and
where plugins are actually submitted today.

## When to use

- Building a new Obsidian plugin from scratch
- Modifying, refactoring or debugging an existing plugin repository
- Publishing a new version (bump manifest, tag, release)
- Submitting to the Obsidian community marketplace, or responding to review feedback
- Writing or updating an `AGENTS.md` handbook for a plugin repository

## Pick the entry point

| Situation | Do this |
| --- | --- |
| New plugin | Scaffold from `assets/templates/`, then read `references/plugin-dev-guide.md` |
| Existing plugin repo | Read the repo's `AGENTS.md` first if present, then `references/plugin-dev-guide.md` |
| Something is broken | Go to the troubleshooting table in `references/plugin-dev-guide.md` |
| Publishing | Follow "Release a new version" below, then `references/publish-and-review.md` |
| Submission or review feedback | `references/publish-and-review.md` |

## Hard rules

1. **`manifest.json` version is the only version users see.** No bump means no update, even if the
   GitHub release exists.
2. **`manifest.json` and `package.json` carry the same version**, and the git tag matches both.
3. **`main.js` is a build artifact** — gitignored and untracked. If already tracked, run
   `git rm --cached main.js`; ignore rules do not apply to tracked files.
4. **`id` must not contain "obsidian"; `name` must not start with "Obsidian".**
5. **`description` ≤ 250 characters, ends with a period, written in English.**
6. **No `versions.json`** for new plugins — the marketplace flags it as an extra unsupported file.
7. **`isDesktopOnly: true` when Node built-ins are used** (`fs`, `path`, `os`, `child_process`).
8. **Never spawn a bare command name** — resolve to an absolute path first.

## Scaffold a new plugin

Copy `assets/templates/` (manifest.json, package.json, tsconfig.json, esbuild.config.mjs,
src/main.ts, .gitignore) and adjust the id, name and description. esbuild keeps `format: "cjs"` so
Obsidian can load the bundle. Verify the plugin id is not already taken before committing to it —
short ids like `open-in-vscode` are frequently occupied.

## Start an external program correctly

The most common failure mode. Obsidian runs on Electron, and the environment Electron hands to a
child shell on Windows is incomplete — `PATHEXT` is missing. Consequences:

- `spawn("code ...", { shell: true })` fails with **exit code 9009** even though `code` is on `PATH`
- `where code` still succeeds, because `where` resolves extensions itself and does not need
  `PATHEXT` — a successful `where` proves nothing about whether the spawn works

Resolve first, then spawn:

```ts
// absolute path -> fs.existsSync
// bare name     -> `where` (win32) / `command -v` (posix), prefer a .cmd/.bat hit
// then spawn the resolved path, never the bare name
const child = spawn(commandLine, {
  shell: true, detached: true, stdio: "ignore", windowsHide: true,
});
child.unref();
```

On Windows prefer the CLI entry point (`bin\code.cmd`) over the main executable (`Code.exe`) — only
the CLI entry point reliably accepts flags such as `-r`. When a user points at the `.exe`, silently
switch to a sibling `bin\*.cmd` or `resources\app\bin\*.cmd` when one exists, and never replace
their input with a file that does not exist.

## Release a new version

1. Confirm `npm run build` passes (typecheck + bundle).
2. Update `README.md` for anything user visible.
3. Bump `version` in **both** `manifest.json` and `package.json`. SemVer: fix = patch,
   backward-compatible feature = minor, breaking = major. Removing a command users may have
   hotkeyed counts as breaking.
4. Commit and push to the default branch.
5. Push a tag named exactly like the manifest version: `git tag 2.0.0 && git push origin 2.0.0`.
6. Wait for the workflow; verify with `gh run list --limit 3` and `gh release view <tag>`.
7. Confirm `main.js` and `manifest.json` are attached.

A tag/manifest mismatch fails the workflow before any release is created — that is deliberate. Fix
the version rather than deleting and re-pushing the tag.

## Set up CI/CD

Copy `assets/workflows/release.yml` (tag-triggered publish with provenance attestation) and
`assets/workflows/ci.yml` (build check on push/PR plus a guard that `main.js` stays untracked). The
release workflow needs `permissions: contents: write, id-token: write, attestations: write`.

## Bundled resources

- `references/plugin-dev-guide.md` — layout, API notes, settings tab, Windows pitfalls,
  troubleshooting table
- `references/publish-and-review.md` — submission flow, review feedback, CI/CD details, SemVer
- `assets/templates/` — manifest, package.json, tsconfig, esbuild config, plugin skeleton, gitignore
- `assets/workflows/` — release.yml, ci.yml
- `assets/AGENTS-template.md` — starting point for a per-repository AI handbook

## Working style

Read the reference files instead of improvising on the submission flow or manifest rules — both have
changed in ways that are easy to get wrong. When a plugin misbehaves, add a debug toggle that logs
the resolved command line and the child's exit code before changing anything else; the exit code
usually identifies the cause immediately.
