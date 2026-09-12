# AGENTS.md — AI handbook for this plugin

Replace every `<...>` placeholder. Keep this file in sync with the code; it is the entry point for
any AI (or human) that opens this repository later.

## 1. What this plugin does

<one paragraph: the user-visible behaviour, in one or two sentences>

## 2. Repository layout

```
src/main.ts        source — the only file edited by hand
main.js            build artifact, gitignored, never committed
manifest.json      plugin metadata; the version users see
package.json       must carry the same version as manifest.json
esbuild.config.mjs bundles src/main.ts -> main.js
.github/workflows  ci.yml (check) and release.yml (publish)
```

## 3. Red lines

1. Never commit `main.js`; it is a build artifact.
2. `manifest.json` and `package.json` versions must always match, and must match the release tag.
3. No version bump means users receive no update.
4. Plugin id must not contain "obsidian"; name must not start with "Obsidian".
5. `description` ≤ 250 chars, ends with a period, English only.
6. `isDesktopOnly: true` — this plugin uses Node built-ins <fs / path / child_process>.
7. Never spawn a bare command name; resolve it to an absolute path first.
8. <project-specific rule, e.g. a feature that was removed and must not come back>

## 4. Changing the code

```bash
npm run dev     # watch mode, rebuilds main.js
npm run build   # typecheck + production build — must pass before releasing
npm run check   # typecheck only
```

Then sync to a vault for manual testing:

```
<vault>/.obsidian/plugins/<plugin-id>/   <- main.js + manifest.json
```

## 5. Architecture

<describe the main class, the commands it registers, the settings interface, and the helper
functions. Keep it to the parts that are not obvious from reading the code.>

## 6. Recipes

- **Add a command** — `this.addCommand({ id, name, checkCallback })` inside `onload()`; no plugin-id
  prefix in `id`.
- **Add a setting** — add the field to the settings interface and `DEFAULT_SETTINGS`, then add a
  `Setting` in the settings tab.
- **Launch an external program** — resolve first (`fs.existsSync` for absolute paths, `where` /
  `command -v` for names), then `spawn` with `shell: true, detached: true, windowsHide: true` and
  `child.unref()`.

## 7. Releasing

1. `npm run build` passes.
2. Update `README.md` for anything user visible.
3. Bump `version` in `manifest.json` **and** `package.json`.
4. `git add -A && git commit -m "<type>: <description>" && git push`
5. `git tag <version> && git push origin <version>`
6. Wait ~30 s; the release workflow validates, builds, attests and publishes.
7. Verify: `gh release view <version>` lists `main.js` and `manifest.json`.

Versions — fix: patch, feature: minor, breaking: major.

## 8. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Nothing happens | executable unresolved | enable debug logging; read the exit code |
| Exit code 9009 (Windows) | bare command name spawned | resolve to an absolute path |
| Plugin not updating | manifest version unchanged | bump both files |
| Workflow fails on version check | tag ≠ manifest | fix the version, move the tag |
| `main.js` tracked again | committed before the ignore rule | `git rm --cached main.js` |

## 9. Commit messages

`<type>: <short description>` — types: `feat`, `fix`, `docs`, `refactor`, `chore`. Add `!` after the
type for breaking changes.
