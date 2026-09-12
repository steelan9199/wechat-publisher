# Publishing, submission and review

## Repository setup before first submission

| Item | Requirement |
| --- | --- |
| Repository name | usually `obsidian-<plugin-id>`; must be public |
| `README.md` | what it does, install (community + manual), usage, settings, permissions, license |
| `LICENSE` | MIT is the common choice; the marketplace asks for one |
| `manifest.json` | compliant — see the hard rules in SKILL.md |
| Release | at least one GitHub release with `main.js` and `manifest.json` attached |
| Author identity | manifest `author`/`authorUrl` consistent with the repo owner |

## Submission flow (current)

The old flow — opening a pull request against `obsidianmd/obsidian-releases` to add an entry to
`community-plugins.json` — **no longer works**. That repository removed its submission instructions
in favour of the new system, and `community-plugins.json` is now mirrored automatically by a bot.

Submit through the developer portal at `https://community.obsidian.md`:

1. Sign in with the GitHub account that owns the repository.
2. Submit the plugin by pointing at the repository.
3. Wait for the automated checks and the human review pass.
4. Respond to review feedback in the same portal, then release a new version addressing it.
5. After the plugin is listed, later versions are picked up automatically from GitHub releases.

Do not hand-edit `community-plugins.json`; a manual PR there will be closed.

## Typical review feedback

| Feedback | Response |
| --- | --- |
| "Release contains extra unsupported files" (e.g. `versions.json`) | delete the file, bump the version, release again |
| Permission notice for `child_process` | explain in the README why it is inherent; keep the usage minimal |
| Permission notice for `fs` | state that it only checks that a file exists; never reads or writes notes |
| Description not compliant | English, ≤ 250 chars, ends with a period, no emoji |
| Name starts with "Obsidian" | rename the plugin |
| Author mismatch | align manifest `author`/`authorUrl` with the GitHub owner |
| `main.js` committed | remove it, gitignore it, release again |

Every fix requires a version bump to reach users.

## Release mechanics

Semantic versioning:

| Change | Example | Field |
| --- | --- | --- |
| Bug fix | `1.0.2` → `1.0.3` | patch |
| Backward-compatible feature | `1.0.3` → `1.1.0` | minor |
| Breaking change (removed command, renamed setting) | `1.1.0` → `2.0.0` | major |

Sequence:

```bash
# 1. edit src, run build
npm run build
# 2. update README when user visible
# 3. bump manifest.json and package.json to the same version
# 4. commit and push
git add -A && git commit -m "fix: describe the change" && git push
# 5. tag with the exact same version
git tag 2.0.0 && git push origin 2.0.0
# 6. watch the workflow
gh run list --limit 3
gh release view 2.0.0
```

Useful checks while waiting: `gh run watch <run-id> --exit-status`, and confirm the release assets
list contains both `main.js` and `manifest.json`.

SSH is enough for pushing commits and tags; a token is only needed for API operations. A token
missing scopes shows up as 403 on operations such as `gh repo delete`.

## CI/CD

Two workflows, both in `.github/workflows/`, templates in `assets/workflows/`.

### release.yml

Triggers on any tag push. Steps: checkout → Node 22 with npm cache → `npm ci` → verify tag equals
manifest version → validate manifest fields → `npm run build` → verify `main.js` and `manifest.json`
exist → `actions/attest-build-provenance@v2` → `gh release create` with `--generate-notes`.

Needs `permissions: contents: write, id-token: write, attestations: write`. The provenance
attestation is uploaded to a public transparency log — expected, not an error.

### ci.yml

Triggers on push to the default branch and on pull requests. Installs, builds, and fails if
`main.js` is tracked by git. It only checks; it never publishes.

### Test the pipeline safely

Push a deliberately wrong tag (for example `9.9.9`) against a manifest that says something else:
the job should fail at the version check with a clear message and create no release. Delete the test
tag afterwards with `git push --delete origin 9.9.9`.

## Lockfile

Commit `package-lock.json` (or `pnpm-lock.yaml`) and use `npm ci` in CI. Without a lockfile the
release build can drift and produce a `main.js` that differs from what was tested locally.
