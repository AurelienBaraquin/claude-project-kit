#!/usr/bin/env bash
# Installs the skills of this kit into ~/.claude/skills (symlinks by default, so `git pull` updates
# them). Safe to re-run.
#
#   ./install.sh              symlink every skill
#   ./install.sh --copy       copy instead of symlink
#   ./install.sh --uninstall  remove what this script installed
set -euo pipefail

kit_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
mode="link"

case "${1:-}" in
  --copy) mode="copy" ;;
  --uninstall) mode="uninstall" ;;
  "") ;;
  *) echo "usage: $0 [--copy | --uninstall]" >&2; exit 2 ;;
esac

mkdir -p "$target_dir"

for skill_path in "$kit_dir"/skills/*/; do
  name="$(basename "$skill_path")"
  dest="$target_dir/$name"

  if [[ "$mode" == "uninstall" ]]; then
    if [[ -L "$dest" && "$(readlink "$dest")" == "${skill_path%/}" ]]; then
      rm "$dest"
      echo "removed  $name"
    elif [[ -e "$dest" ]]; then
      echo "skipped  $name (not installed by this kit)"
    fi
    continue
  fi

  if [[ -L "$dest" ]]; then
    rm "$dest"
  elif [[ -e "$dest" ]]; then
    echo "skipped  $name ($dest already exists and is not a symlink; remove it to install)" >&2
    continue
  fi

  if [[ "$mode" == "copy" ]]; then
    cp -R "${skill_path%/}" "$dest"
    echo "copied   $name"
  else
    ln -s "${skill_path%/}" "$dest"
    echo "linked   $name"
  fi
done
