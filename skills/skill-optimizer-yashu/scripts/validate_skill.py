#!/usr/bin/env python3
"""Validate an Agent Skill folder.

Checks:
- SKILL.md exists and has name/description in YAML frontmatter.
- Markdown links and backtick-quoted relative paths resolve.
  Fenced code blocks are removed first: a fence contributes three backticks,
  which flips inline-code pairing for the rest of the document, so paths after
  a fence would otherwise be missed or mis-paired.
- Files are reachable from SKILL.md, directly or through a referenced directory.
- Symlinks are followed: a skill root may be a link, and a subdirectory may be
  linked to shared assets. Linked content is inventoried, not silently skipped.
- YAML files parse successfully.
- Common clutter/backup files are absent.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

TEXT_EXTENSIONS = {
    ".md",
    ".markdown",
    ".py",
    ".sh",
    ".ps1",
    ".yaml",
    ".yml",
    ".json",
    ".txt",
    ".csv",
    ".toml",
    ".ini",
    ".cfg",
}
# Binary assets a skill legitimately ships and may reference from prose.
ASSET_EXTENSIONS = TEXT_EXTENSIONS | {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".pdf",
    ".mp4", ".webm", ".mp3", ".wav",
    ".pptx", ".docx", ".xlsx",
}
FORBIDDEN_NAMES = {"README.MD", "CHANGELOG.MD", "INSTALLATION_GUIDE.MD", "QUICK_REFERENCE.MD"}
TEMP_SUFFIXES = {".tmp", ".bak", ".old", ".orig"}
SKIP_PATH_MARKERS = ("<", ">", "{", "}", "*", "?")
# Bare placeholder words that appear as the link target in syntax tables and API
# docs (`[text](url)`, `[label](link)`). They are documentation of *link syntax*,
# not a promise that a file named `url` ships with the skill. Treated as prose.
PLACEHOLDER_TOKENS = frozenset({
    "url", "URL", "uri", "URI", "link", "path", "file", "target", "href",
    "dest", "destination", "example", "e.g.", "…", "...", "xxx", "XXX", "yyy",
})
# Whole-segment placeholders (`img_xxx`, `file_xxx`, `res_123`, `a`, `x`) as in
# API docs showing the *shape* of an id. Matched per path segment, so a real
# directory named `xxx/` is unaffected only if it truly exists — the caller
# still checks existence; this only stops the token from *being* a promise.
PLACEHOLDER_SEGMENT_RE = re.compile(
    r"^(?:"
    r"(?:img|file|res|resource|msg|message|node|record|item|doc|key|id)_(?:xxx|yyy|zzz|123|abc|<[^>]+>|\{[^}]+\})"
    r"|xxx|yyy|zzz"
    r")$",
    re.IGNORECASE,
)
# Sample filenames used in "this is how you write it" examples. They demonstrate
# syntax; no skill is required to ship them. `./a.png`, `a.png`, `x.md` etc.
PLACEHOLDER_BASENAME_RE = re.compile(r"^[a-z]\.(?:png|jpe?g|gif|svg|webp|md|txt|ya?ml|json|csv)$", re.IGNORECASE)
# Chinese prose placeholders: `![](图片文件名.png)`, `![](文件名.jpg)`. These read
# as "put your image file name here", not as a file the skill ships.
PLACEHOLDER_CJK_RE = re.compile(
    r"^(?:[a-z]?文件[名路径]?|图片[文件]?名?|示例[文件]?名?|你的[文件]+名?|xxx)",
    re.IGNORECASE,
)
# Top-level directories that conventionally belong to an upstream project rather
# than to the skill itself. Pointing at them is documentation, not a promise the
# skill must keep, so a missing file there is not a broken reference.
EXTERNAL_ROOTS = frozenset({
    "docs", "doc", "examples", "example", "samples", "demo", "demos",
    "src", "lib", "test", "tests", "spec", "specs", "benchmark", "benchmarks",
    "temp", "tmp", "build", "dist", "out", "fixtures", "third_party", "vendor",
})
EXTERNAL_ROOTS_RE = re.compile(rf"^(?:{'|'.join(sorted(EXTERNAL_ROOTS))})/")
FRONTMATTER_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n?", re.DOTALL)
MARKDOWN_LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
# Opening/closing fence line: any indentation, then >=3 backticks or tildes.
# Indentation is not capped at 3: fences nested in list items (common in SKILL.md)
# would otherwise stay in the text and flip inline-code pairing again.
FENCE_LINE_RE = re.compile(r"^\s*(`{3,}|~{3,})")
# Inline code span: a run of N backticks closed by the next run of exactly N,
# as in CommonMark. Pairing is positional, so fences must be stripped first.
BACKTICK_RE = re.compile(r"(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)", re.DOTALL)


# A script whose *role* is tooling — invoked by the workflow, not pointed at from
# prose — is expected to have no entry pointer. Recognised by directory and by a
# verb that names its job, so renaming the file or adding a second checker keeps
# working instead of tripping a false "orphan".
TOOLING_DIRS = frozenset({"scripts", "tools", "bin"})
TOOLING_VERBS = ("validate", "check", "lint", "verify", "audit", "inspect", "format")
TOOLING_EXTENSIONS = {".py", ".sh", ".ps1", ".js", ".mjs", ".cjs", ".rb", ".pl"}
# Directories that hold no skill content: version-control metadata, installed
# dependencies and build caches. Their contents describe other projects, so
# neither their references nor their orphans are findings about this skill.
NON_CONTENT_DIRS = frozenset({
    ".git", "node_modules", "vendor", "third_party", "__pycache__",
    ".venv", "venv", ".tox", ".mypy_cache", ".pytest_cache", ".cache",
    "dist-info", "egg-info",
})
TOOLING_NAME_SEP_RE = re.compile(r"[-_.]")
# Human-facing docs sit next to code by design and are not "orphans" in the sense
# the rule cares about; they are excluded only when named as such.
STANDALONE_NAME_RE = re.compile(r"^(?:license|notice|contributing|authors|maintainers)(?:\.\w+)?$", re.IGNORECASE)


def is_tooling_script(rel: str) -> bool:
    """Is this file a tooling script (no entry pointer expected)?

    The orphan rule asks "can a reader reach this file from SKILL.md?". For a
    validator or linter the honest answer is "the workflow calls it", which is a
    different contract from a reference document. Judging by role rather than by
    a hard-coded filename means a rename or an added second checker is handled
    correctly; the earlier fixed-path exemption was not.
    """
    parts = Path(rel).parts
    if not parts or parts[0] not in TOOLING_DIRS:
        return False
    name = parts[-1]
    if Path(name).suffix.lower() not in TOOLING_EXTENSIONS:
        return False
    if STANDALONE_NAME_RE.match(name):
        return True
    words = [w for w in TOOLING_NAME_SEP_RE.split(Path(name).stem.lower()) if w]
    # Prefix match, not equality: `linter`, `validator`, `checker` all name the
    # same role as their verb.
    return any(w.startswith(verb) for w in words for verb in TOOLING_VERBS)


def collect_config_references(
    file_path: Path, known_dirs: frozenset[str] | None = None
) -> list[tuple[str, str]]:
    """Extract path-shaped string values from a YAML/JSON config file.

    A skill's config is not decorative: `script: scripts/run.py` or a `paths:`
    list is a reference a reader will follow. Those files were previously skipped
    entirely, so a renamed script left a dangling pointer that nothing reported.
    Only values that *anchor* on a real skill directory are taken, which keeps
    prose and arbitrary settings out of the result.
    """
    try:
        text = file_path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeDecodeError):
        return []
    values: list[str] = []
    suffix = file_path.suffix.lower()
    if suffix in {".yaml", ".yml"} and yaml is not None:
        try:
            data = yaml.safe_load(text)
        except yaml.YAMLError:
            return []
        values = _flatten_strings(data)
    elif suffix == ".json":
        try:
            values = _flatten_strings(json.loads(text))
        except (json.JSONDecodeError, ValueError):
            return []
    refs: list[tuple[str, str]] = []
    for value in values:
        token = value.strip()
        if not token or "\n" in token or len(token) > 200:
            continue
        if is_placeholder_path(token):
            continue
        if not looks_like_relative_path(token, known_dirs):
            continue
        refs.append((token.rstrip("/"), "config-path"))
    return refs


def _flatten_strings(node: Any) -> list[str]:
    if isinstance(node, str):
        return [node]
    if isinstance(node, dict):
        out: list[str] = []
        for value in node.values():
            out.extend(_flatten_strings(value))
        return out
    if isinstance(node, (list, tuple)):
        out = []
        for value in node:
            out.extend(_flatten_strings(value))
        return out
    return []


def abspath(path: Path) -> Path:
    return Path(os.path.abspath(path))


def normalize_rel(path: Path) -> str:
    return path.as_posix().rstrip("/")


def parse_frontmatter(skill_md: Path) -> tuple[dict[str, Any] | None, str | None]:
    text = skill_md.read_text(encoding="utf-8-sig")
    match = FRONTMATTER_RE.match(text)
    if not match:
        return None, "SKILL.md missing YAML frontmatter"
    if yaml is None:
        return None, "PyYAML is required to parse frontmatter"
    try:
        data = yaml.safe_load(match.group(1))
    except yaml.YAMLError as exc:
        return None, f"frontmatter YAML error: {exc}"
    if not isinstance(data, dict):
        return None, "frontmatter is not a YAML object"
    if not data.get("name"):
        return data, "frontmatter missing name"
    if not data.get("description"):
        return data, "frontmatter missing description"
    return data, None


def strip_url_fragment(raw: str) -> str:
    if raw.startswith(("http://", "https://", "mailto:", "tel:", "#")):
        return ""
    # Markdown links may include query/fragment; retain the local file part.
    return raw.split("#", 1)[0].split("?", 1)[0]


def is_placeholder_path(token: str) -> bool:
    """Is this token a *placeholder* rather than a promise of a shipped file?

    Syntax tables, API docs and usage examples spell link targets as
    `[text](url)`, `![Image](img_xxx)`, `![x](./a.png)`. Each is a statement
    about how to *write* a reference, not that the skill ships `url`, `img_xxx`
    or `a.png`. Reporting them as broken references buries real findings: on a
    real corpus this class accounted for the majority of "invalid reference"
    noise, including 10 of the 12 findings on one skill whose subject *is* such
    documentation.

    A token is a placeholder when any path segment is a bare placeholder word or
    an id-shape, or when the basename is a one-letter sample filename. The check
    is deliberately conservative: it never suppresses a token that matches a
    directory the skill actually owns, because callers that pass `known_dirs`
    still verify existence afterwards.
    """
    token = token.strip().rstrip("/")
    if not token:
        return True
    # `$VAR/...` and `../` are handled by the caller (portable spellings).
    # `./` marks a *relative example* rather than an anchored promise: docs write
    # `[配置](./config.yaml)` / `![x](./a.png)` to show link syntax. Two forms
    # exist — `./name` at the root, and `./dir/...` where `dir` may or may not be
    # a real directory. Only the first is unconditionally prose; the second is
    # still checked by the caller when the leading segment is a real directory.
    if token.startswith("./"):
        token = token[2:]
        if not token or "/" not in token:
            return True
    segments = [s for s in token.split("/") if s]
    if not segments:
        return True
    for seg in segments:
        if seg in PLACEHOLDER_TOKENS or PLACEHOLDER_SEGMENT_RE.match(seg):
            return True
    last = segments[-1]
    if PLACEHOLDER_BASENAME_RE.match(last):
        return True
    # `图片文件名.png` — a CJK stem that names the *placeholder*, not the file.
    stem = last.rsplit(".", 1)[0]
    return bool(PLACEHOLDER_CJK_RE.match(stem))


def looks_like_relative_path(
    token: str, known_dirs: frozenset[str] | None = None
) -> bool:
    """Does this inline-code token promise a path inside the skill?

    A token only counts when it is *anchored*: it starts with a directory that
    really exists in the skill (`references/x.md`, `scripts/y.py`), or markdown
    link syntax already proved intent. Shape alone is not evidence. `scene.py`,
    `try/except` and `manim\\scene\\three_d_scene.py` all end in a known
    extension or contain a slash, yet none promises a skill-local file: the
    first is the user's own scene in their working directory, the second is
    Python syntax, the third lives inside an installed package. Requiring an
    anchor keeps genuine broken references reportable and drops prose noise.

    `known_dirs` holds the directory names present under the skill root; pass
    None for shape-only matching (standalone callers and unit tests).
    """
    token = token.strip()
    if not token or any(marker in token for marker in SKIP_PATH_MARKERS):
        return False
    # A URL is never a skill-local path, whatever precedes it. Markdown link
    # targets are filtered separately, but a URL can also appear inside inline
    # code (`--sourceRoot https://...`, `[docs](https://...)` written as a
    # backtick span), and those reached the path checker unfiltered.
    if "://" in token or re.match(r"^[a-z][a-z0-9+.-]*:[^\s]", token):
        return False
    # Command lines and shell snippets carry paths as *arguments*; the whole
    # token is not a path, and splitting it would guess at intent.
    if re.search(r"\s", token) or ";" in token or "|" in token:
        return False
    if token.startswith(("-", "%", "~")):
        return False
    if token.startswith("$"):
        # `$SKILL_DIR/references/x.md` is the portable spelling of a skill-local
        # path: the variable resolves to the skill root at read time. There is no
        # literal directory named `$SKILL_DIR`, so anchoring on the head segment
        # would misread every one of these as unanchored prose.
        return looks_like_relative_path(token.split("/", 1)[1], known_dirs) if "/" in token else False
    if token.startswith(("../", "./")):
        # A parent hop such as `../../SKILL.md` addresses the skill root by
        # construction, which is inside root. Reported only if genuinely absent.
        return True
    if token.startswith("/") or re.match(r"^[A-Za-z]:[\\/]", token):
        # Absolute POSIX, a Windows drive letter, or a URL path fragment such as
        # /3b1b/manim. None can resolve inside the skill root.
        return False
    if "\\" in token:
        # Windows-style path inside an installed package or on another machine.
        # Relative references inside a skill are written with `/`.
        return False
    if token.endswith("/") and "/" in token:
        return True
    if EXTERNAL_ROOTS_RE.match(token):
        # `docs/`, `examples/`, `src/` — conventional top-level names of an
        # upstream project. A skill may legitimately point at the project it
        # documents rather than at its own copy, so its absence is expected.
        return False
    suffix = Path(token).suffix.lower()
    if suffix and suffix not in ASSET_EXTENSIONS:
        # e.g. `data.npy`, `model.onnx` — not a shape a skill points readers at.
        # Images and templates are assets a skill really does ship, so they stay.
        return False
    if "/" in token and re.fullmatch(r"[A-Za-z0-9_./\-\u4e00-\u9fff]+", token):
        # Anchored only if the leading segment is a real directory of this skill.
        return known_dirs is None or token.split("/", 1)[0] in known_dirs
    if known_dirs is None:
        return suffix in TEXT_EXTENSIONS
    # A bare filename carries no directory to anchor it, so it is treated as a
    # promise only when the skill itself ships that file. Callers pass the
    # skill's own file set; without it we cannot tell and do not guess.
    return False


def strip_fenced_code(text: str) -> str:
    """Remove fenced code blocks before scanning for references.

    Inline code spans are found by pairing backticks from left to right. A fence
    adds three backticks, which flips that pairing for everything after it: real
    paths get swallowed by a bogus span and their files are reported as orphans.
    Paths written inside a fence are not references either, so dropping fences
    first is both the fix and the correct reading of the document.
    """
    kept: list[str] = []
    fence_char: str | None = None
    fence_len = 0
    for line in text.splitlines(keepends=True):
        match = FENCE_LINE_RE.match(line)
        if fence_char is None:
            if match:
                fence_char = match.group(1)[0]
                fence_len = len(match.group(1))
                continue
            kept.append(line)
        elif match and match.group(1)[0] == fence_char and len(match.group(1)) >= fence_len:
            fence_char = None
    return "".join(kept)


def collect_references(
    file_path: Path, known_dirs: frozenset[str] | None = None
) -> list[tuple[str, str]]:
    text = strip_fenced_code(file_path.read_text(encoding="utf-8-sig"))
    refs: list[tuple[str, str]] = []

    for match in MARKDOWN_LINK_RE.finditer(text):
        raw = match.group(1).strip("<>")
        local = strip_url_fragment(raw)
        if not local or is_placeholder_path(local):
            continue
        # A markdown link target inside a skill points at a file or directory:
        # it has a path separator, a known asset extension, or both. A bare word
        # is an API-doc site anchor (`[AndroidRect](androidRectType)`, where the
        # real page is `dataTypes#...`) or a JS identifier — never a shipped
        # file. Requiring file shape stops those from being read as promises.
        if "/" not in local and Path(local).suffix.lower() not in ASSET_EXTENSIONS:
            continue
        refs.append((local, "markdown-link"))

    for match in BACKTICK_RE.finditer(text):
        token = match.group(2).strip()
        if is_placeholder_path(token):
            continue
        if looks_like_relative_path(token, known_dirs):
            refs.append((token.rstrip("/"), "backtick-path"))

    return refs


def resolve_reference(base_dir: Path, raw: str, root: Path) -> Path | None:
    candidate_text = raw.rstrip("/")
    if not candidate_text:
        return None
    candidate = abspath(base_dir / candidate_text) if not Path(candidate_text).is_absolute() else Path(candidate_text)
    try:
        candidate.relative_to(root)
    except ValueError:
        return candidate
    return candidate


def scan_skill_files(root: Path) -> tuple[list[Path], list[str], list[str]]:
    """Inventory every file under `root`, following symlinks.

    Returns (files, symlinked_dirs, symlinked_files).

    A skill root is often itself a symlink (a skills manager keeps the real
    content elsewhere), and a skill may link a subdirectory to shared assets.
    `Path.rglob` does not descend into directory symlinks, so linked content was
    dropped from the inventory silently: a reference into it still resolved (the
    path exists) yet the file was never checked, validated or reported. Directory
    cycles are broken by remembering resolved paths.
    """
    files: list[Path] = []
    symlinked_dirs: list[str] = []
    symlinked_files: list[str] = []
    visited_dirs: set[str] = set()

    def rel_or_none(raw: Path) -> str | None:
        try:
            return normalize_rel(raw.relative_to(root))
        except ValueError:
            return None

    def walk(directory: Path) -> None:
        resolved = os.path.realpath(directory)
        if resolved in visited_dirs:
            return
        visited_dirs.add(resolved)
        # Directories that are not skill content at all. A `.git` directory holds
        # dozens of internals no reader can reach from SKILL.md, and a bundled
        # `node_modules`/`vendor` tree is third-party code whose own READMEs and
        # manifests point at *their* project layout — scanning them produced a
        # flood of findings about packages the skill merely depends on. Skipping
        # them keeps the report about the skill's own files.
        if Path(resolved).name in NON_CONTENT_DIRS:
            return
        try:
            with os.scandir(directory) as scanner:
                entries = sorted(scanner, key=lambda entry: entry.name)
        except OSError:
            return
        for entry in entries:
            entry_path = Path(entry.path)
            try:
                if entry.is_dir(follow_symlinks=True):
                    if entry.is_symlink():
                        linked = rel_or_none(entry_path)
                        if linked:
                            symlinked_dirs.append(linked)
                    walk(entry_path)
                elif entry.is_file(follow_symlinks=True):
                    if entry.is_symlink():
                        linked = rel_or_none(entry_path)
                        if linked:
                            symlinked_files.append(linked)
                    files.append(entry_path)
            except OSError:
                continue

    walk(root)
    return sorted(files), sorted(symlinked_dirs), sorted(symlinked_files)


def validate(root: Path) -> dict[str, Any]:
    root = abspath(root)
    skill_md = root / "SKILL.md"
    errors: list[str] = []
    warnings: list[str] = []

    if not root.is_dir():
        return {"ok": False, "errors": [f"skill root not found: {root}"]}
    if not skill_md.is_file():
        errors.append("missing required SKILL.md")
        frontmatter = None
    else:
        frontmatter, frontmatter_error = parse_frontmatter(skill_md)
        if frontmatter_error:
            errors.append(frontmatter_error)

    all_files, symlinked_dirs, symlinked_files = scan_skill_files(root)
    rel_files = {normalize_rel(path.relative_to(root)): path for path in all_files}

    referenced_paths: set[str] = set()
    referenced_dirs: set[str] = set()
    invalid_references: list[dict[str, str]] = []
    notes: list[dict[str, str]] = []

    # Top-level directory names, plus the nested ones a skill commonly points
    # at (references/incidents/x.md). These anchor inline-code paths: a token
    # counts as a promise only if it starts with a directory this skill owns.
    known_dirs: set[str] = set()
    for rel in rel_files:
        parts = Path(rel).parts
        for depth in range(1, len(parts)):
            known_dirs.add("/".join(parts[:depth]))
    known_dirs_frozen = frozenset(known_dirs)

    for path in all_files:
        suffix = path.suffix.lower()
        if suffix in {".md", ".markdown"}:
            collected = collect_references(path, known_dirs_frozen)
        elif suffix in {".yaml", ".yml", ".json"}:
            collected = collect_config_references(path, known_dirs_frozen)
        else:
            continue
        base_dir = path.parent
        for raw, kind in collected:
            # Resolve against the skill root first, deterministically.
            #
            # Skill documents overwhelmingly write paths relative to the *skill
            # root* (`scripts/x.py`, `references/y.md`) no matter which
            # subdirectory they live in. Resolving against the document's own
            # directory instead made correctness depend on luck: the reference
            # only survived because a fallback re-tried the root. Worse, when a
            # same-named file *did* exist in the document's directory, the
            # fallback never fired and the reference silently pointed at the
            # wrong target — no error, no warning. Anchoring on the root removes
            # that ambiguity; the document-relative form is kept as a second
            # try so existing skills that spell `./sibling.md` still resolve.
            candidate = resolve_reference(root, raw, root)
            if candidate is None:
                continue
            if not candidate.exists():
                doc_candidate = resolve_reference(base_dir, raw, root)
                if doc_candidate is not None and doc_candidate.exists():
                    candidate = doc_candidate
            if not candidate.exists():
                record = {
                    "from": normalize_rel(path.relative_to(root)),
                    "target": raw,
                    "kind": kind,
                }
                # A backticked path that names a directory the skill owns
                # (`references/x.md`) is a real promise; markdown links are
                # explicit. Both are errors. Anything else that merely looks
                # path-shaped is reported as a note so a human can eyeball it
                # without the run being blocked by prose.
                portable = raw.startswith(("$", "../", "./"))
                if kind == "backtick-path" and (
                    not looks_like_relative_path(raw, known_dirs_frozen) or portable
                ):
                    # Unanchored prose, or a portable spelling whose literal form
                    # cannot be checked without expanding the variable first.
                    notes.append(record)
                else:
                    invalid_references.append(record)
                continue
            if candidate.is_file():
                try:
                    referenced_paths.add(normalize_rel(candidate.relative_to(root)))
                except ValueError:
                    pass
            elif candidate.is_dir():
                try:
                    referenced_dirs.add(normalize_rel(candidate.relative_to(root)))
                except ValueError:
                    pass

    if invalid_references:
        errors.append(f"{len(invalid_references)} invalid relative references")
    if notes:
        warnings.append(
            f"{len(notes)} path-shaped token(s) not present in the skill; "
            f"verify these are prose, not promises"
        )

    orphan_files: list[str] = []
    for rel, path in rel_files.items():
        if rel == "SKILL.md":
            continue
        # Python bytecode caches are generated, never authored: reporting them as
        # orphans punishes anyone who smoke-tested a script inside the skill.
        if "__pycache__" in Path(rel).parts or path.suffix.lower() in {".pyc", ".pyo"}:
            continue
        # A validator/checker script plays the role of tooling, not content: it is
        # invoked by the workflow rather than pointed at from prose, so "no entry
        # pointer" is expected. The exemption is by *role*, not by filename — the
        # previous hard-coded `scripts/validate_skill.py` broke the moment the
        # script was renamed (`validate-skill.py` reported itself as an orphan),
        # and would not have covered a second checker at all.
        if is_tooling_script(rel):
            continue
        if rel in referenced_paths:
            continue
        parts = Path(rel).parts
        reachable_via_dir = any("/".join(parts[:i]) in referenced_dirs for i in range(1, len(parts)))
        if not reachable_via_dir:
            orphan_files.append(rel)

    if orphan_files:
        warnings.append(f"{len(orphan_files)} files not reachable from an entry pointer or referenced directory")

    yaml_errors: list[str] = []
    if yaml is None:
        warnings.append("PyYAML unavailable; skipped YAML parsing")
    else:
        for rel, path in rel_files.items():
            if path.suffix.lower() in {".yaml", ".yml"}:
                try:
                    yaml.safe_load(path.read_text(encoding="utf-8-sig"))
                except yaml.YAMLError as exc:
                    yaml_errors.append(f"{rel}: {exc}")
        if yaml_errors:
            errors.append(f"{len(yaml_errors)} YAML parse errors")

    forbidden_files: list[str] = []
    for rel, path in rel_files.items():
        upper_name = path.name.upper()
        if upper_name in FORBIDDEN_NAMES or path.suffix.lower() in TEMP_SUFFIXES:
            forbidden_files.append(rel)
        elif any(part.endswith((".backup", ".bak")) or part.startswith(".backup") for part in path.parts):
            forbidden_files.append(rel)
    if forbidden_files:
        errors.append(f"{len(forbidden_files)} clutter or backup files inside skill")

    description = (frontmatter or {}).get("description", "")
    if isinstance(description, str) and len(description) > 300:
        warnings.append(f"description is {len(description)} characters; route descriptions are usually shorter")

    # Only a genuine link is worth reporting: comparing realpath against the given
    # path false-positives whenever a sandbox or mount maps the path differently.
    root_is_link = os.path.islink(root)
    resolved_root = os.path.realpath(root) if root_is_link else str(root)
    if root_is_link:
        warnings.append(f"skill root is a symlink; real content lives at {resolved_root}")

    return {
        "ok": not errors,
        "skill_root": str(root),
        "resolved_skill_root": resolved_root,
        "file_count": len(all_files),
        "symlinked_dirs_followed": symlinked_dirs,
        "symlinked_files": symlinked_files,
        "frontmatter": frontmatter,
        "invalid_references": invalid_references,
        "unresolved_path_tokens": notes,
        "orphan_files": orphan_files,
        "yaml_errors": yaml_errors,
        "forbidden_files": forbidden_files,
        "warnings": warnings,
        "errors": errors,
        "evidence": (
            f"Checked {len(all_files)} files; "
            f"{len(invalid_references)} invalid references, {len(orphan_files)} orphan files, "
            f"{len(yaml_errors)} YAML errors, {len(forbidden_files)} clutter files, "
            f"followed {len(symlinked_dirs)} symlinked dir(s)."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate an Agent Skill folder")
    parser.add_argument("path", nargs="?", default=".", help="Skill root path")
    parser.add_argument("--json", action="store_true", help="Print JSON")
    args = parser.parse_args()

    result = validate(Path(args.path))
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        print(result["evidence"])
        for key in (
            "invalid_references",
            "unresolved_path_tokens",
            "orphan_files",
            "symlinked_dirs_followed",
            "symlinked_files",
            "yaml_errors",
            "forbidden_files",
            "warnings",
            "errors",
        ):
            if result.get(key):
                print(f"\n{key}:")
                for item in result[key]:
                    print(f"- {item}")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
