# Plugin development guide

## Project layout

```
<repo>/
├── src/main.ts          # source, the only file edited by hand
├── main.js              # build artifact, gitignored, never committed
├── manifest.json        # plugin metadata, the version users see
├── package.json         # same version as manifest
├── esbuild.config.mjs   # bundles src/main.ts -> main.js
├── tsconfig.json        # strict, noEmit
├── .gitignore
└── .github/workflows/   # ci.yml + release.yml
```

Installed in a vault as `<vault>/.obsidian/plugins/<plugin-id>/` containing `main.js`,
`manifest.json` (and optionally `styles.css`, `data.json`).

## manifest.json

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "minAppVersion": "1.4.0",
  "description": "Does one thing well.",
  "author": "github-handle",
  "authorUrl": "https://github.com/github-handle",
  "isDesktopOnly": true
}
```

| Field | Rule |
| --- | --- |
| `id` | kebab-case, unique across the community list, must not contain "obsidian" |
| `name` | must not start with "Obsidian" |
| `version` | `x.y.z`, no `v` prefix, must match package.json and the git tag |
| `minAppVersion` | the oldest Obsidian that works; low values widen compatibility |
| `description` | ≤ 250 chars, ends with a period, English, no emoji |
| `author` / `authorUrl` | keep consistent with the GitHub account that owns the repo |
| `isDesktopOnly` | `true` when Node built-ins or Electron APIs are used |

The release workflow in `assets/workflows/release.yml` validates all of the above and fails the build
before publishing when something is off.

## Plugin skeleton

```ts
import { Notice, Plugin, PluginSettingTab, Setting, App } from "obsidian";

interface MySettings { someFlag: boolean }
const DEFAULT_SETTINGS: MySettings = { someFlag: true };

export default class MyPlugin extends Plugin {
  settings: MySettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "do-the-thing",
      name: "Do the thing",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;        // hidden from the palette when unavailable
        if (!checking) void this.doThing(file.path);
        return true;
      },
    });

    this.addRibbonIcon("file-code", "Do the thing", () => {
      const file = this.app.workspace.getActiveFile();
      if (file) void this.doThing(file.path);
    });

    this.addSettingTab(new MySettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings(): Promise<void> { await this.saveData(this.settings); }
}
```

Callback variants:

| Variant | Use when |
| --- | --- |
| `callback` | always available |
| `checkCallback` | availability depends on state (an active file exists) |
| `editorCheckCallback` | needs the editor instance or the file behind the current view |

Commands must not carry the plugin id as a prefix — Obsidian namespaces them automatically.

## Useful API

| Need | API |
| --- | --- |
| Active file | `this.app.workspace.getActiveFile()` |
| Vault path on disk | `(this.app.vault.adapter as { getBasePath?: () => string }).getBasePath?.()` |
| Absolute path of a file | `nodePath.join(vaultPath, file.path)` |
| Context menus | `this.app.workspace.on("file-menu" \| "editor-menu", ...)` |
| Persist settings | `this.loadData()` / `this.saveData()` |
| Notify the user | `new Notice(text, ms)` |

`MarkdownFileInfo` already exposes `file` — do not cast a view to `WorkspaceLeaf & { file?: TFile }`
to reach it, that cast fails under `strict`.

## Settings tab

Build with `Setting`, mirror every field in the settings interface and `DEFAULT_SETTINGS`, and give
each control a description that states what happens. Add a debug toggle for anything that launches
an external process — it turns a silent failure into a diagnosable one.

A "Test" button that only calls the real action is not enough: swallow-proof it by resolving the
executable first and reporting success or failure in a `Notice`. Otherwise `stdio: "ignore"` eats the
error and the user sees nothing.

## Windows pitfalls

| Problem | Cause | Fix |
| --- | --- | --- |
| Exit code 9009 | Electron's child shell lacks `PATHEXT`, so `cmd` cannot expand `code` → `code.cmd` | resolve to an absolute path before spawning |
| `where code` works but spawn fails | `where` resolves extensions itself, `cmd` does not | same as above |
| Flags such as `-r` ignored | launched `Code.exe` instead of `bin\code.cmd` | prefer the CLI entry point; auto-correct `.exe` → sibling `.cmd` |
| Console window flashes | `windowsHide` not set | `spawn(cmd, { windowsHide: true })` |
| Obsidian hangs waiting | child not detached | `detached: true` + `child.unref()` |
| `PATH` change invisible | Obsidian inherits `PATH` at launch | restart Obsidian before testing |
| macOS `PATH` from `.zshrc` missing | Finder/Dock launch skips shell init | accept an absolute path in settings |

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Nothing happens at all | executable unresolved | add debug logging; print the resolved path and the exit code |
| Exit code 9009 (Windows) | bare command name spawned | resolve to an absolute path first |
| Exit code 1 | editor rejected a flag | point at the CLI entry point, or drop the flag |
| Plugin not updating | manifest version unchanged | bump `manifest.json` and `package.json` |
| Release missing attachments | build produced no `main.js` | check the workflow log; the job fails before `gh release create` |
| Workflow fails on tag check | tag ≠ manifest version | fix the version, commit, move the tag |
| Command missing from the palette | `checkCallback` returns false | verify the guard condition |
| `main.js` still tracked | it was committed before the ignore rule | `git rm --cached main.js` |
| Ribbon icon order resets | stored in `workspace.json` on clean exit | reposition and quit with `Ctrl+Q` |

## Local testing

Symlink or copy the repository into `<vault>/.obsidian/plugins/<plugin-id>/`, run
`npm run dev` for watch mode, and reload Obsidian with `Ctrl+R` (or the developer console's reload).
Rebuild and copy `main.js` + `manifest.json` whenever testing outside the repo.
