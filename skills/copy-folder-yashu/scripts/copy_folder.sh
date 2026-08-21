#!/usr/bin/env bash
# copy_folder.sh
# Copy a source folder INTO a target folder, placing the source folder itself
# (by its basename) inside the target. The node_modules directory is ALWAYS
# excluded at any depth (it is large and reinstallable via `npm install`).
#
# Usage:
#   copy_folder.sh <source_folder> <target_folder> [extra_exclude_dir ...]
#
# Result:
#   <target_folder>/<source_basename>/   <- contains a copy of source contents
#
# Example:
#   copy_folder.sh "D:/src/skills/js-obfuscator-public-yashu" "D:/skill/private-skills/skills"
#   -> creates D:/skill/private-skills/skills/js-obfuscator-public-yashu/
#
# Notes:
#   - Paths may use backslashes or forward slashes; both are accepted.
#   - On Windows, robocopy is used (exit codes 0-7 = success, >=8 = error).
#   - If robocopy is unavailable, falls back to rsync, else cp + prune.

set -uo pipefail

if [ "$#" -lt 2 ]; then
  cat >&2 <<EOF
Usage: $0 <source_folder> <target_folder> [extra_exclude_dir ...]
  node_modules is always excluded.
EOF
  exit 2
fi

SRC_RAW="$1"
DST_PARENT_RAW="$2"
shift 2 || true

# Always exclude node_modules; collect any extra dir names passed by the caller.
EXCLUDES=("node_modules")
for extra in "$@"; do
  [ -n "$extra" ] && EXCLUDES+=("$extra")
done

# Normalize backslashes -> forward slashes so basename & native tools stay sane.
SRC="${SRC_RAW//\\//}"
DST_PARENT="${DST_PARENT_RAW//\\//}"

if [ ! -d "$SRC" ]; then
  echo "ERROR: source folder does not exist: $SRC_RAW" >&2
  exit 1
fi

FOLDER_NAME="$(basename "$SRC")"
DEST="$DST_PARENT/$FOLDER_NAME"

mkdir -p "$DST_PARENT" || { echo "ERROR: cannot create target parent: $DST_PARENT" >&2; exit 1; }

if [ -d "$DEST" ]; then
  echo "NOTE: destination already exists, contents will be merged/overwritten: $DEST"
fi

echo "Copying:"
echo "  Source : $SRC"
echo "  Target : $DEST"
echo "  Exclude: ${EXCLUDES[*]}"

if command -v robocopy >/dev/null 2>&1; then
  # Build /XD <dir> [/XD <dir> ...] argument list.
  xd_args=()
  for d in "${EXCLUDES[@]}"; do xd_args+=("/XD" "$d"); done
  # robocopy exit codes 0-7 are success; >=8 indicates an error.
  robocopy "$SRC" "$DEST" /E "${xd_args[@]}" /NFL /NDL /NP /NJH /NJS
  rc=$?
  if [ "$rc" -ge 8 ]; then
    echo "ERROR: robocopy failed (exit code $rc)" >&2
    exit "$rc"
  fi
else
  # Fallback (non-Windows or no robocopy): rsync preferred, else cp + prune.
  excl_args=()
  for d in "${EXCLUDES[@]}"; do excl_args+=(--exclude="$d"); done
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "${excl_args[@]}" "$SRC/" "$DEST/"
  else
    mkdir -p "$DEST"
    cp -r "$SRC/." "$DEST/"
    for d in "${EXCLUDES[@]}"; do
      find "$DEST" -type d -name "$d" -prune -exec rm -rf {} +
    done
  fi
fi

echo ""
echo "DONE. Excluded: ${EXCLUDES[*]}"
echo "  -> $DEST"
