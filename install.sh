#!/usr/bin/env bash
# Installs the skills of this kit. Safe to re-run.
#
#   ./install.sh                         symlink every skill into ~/.claude/skills
#   ./install.sh --copy                  copy instead of symlink
#   ./install.sh --uninstall             remove what this script linked or copied
#   ./install.sh --project <dir>         copy the day-to-day skills into <dir>/.claude/skills
#   ./install.sh --project <dir> --all   copy every skill, not only the day-to-day ones
#
# Why --project: skills in ~/.claude/skills are personal. They are not loaded in cloud sessions
# (claude.ai/code, mobile, routines) nor on a teammate's machine. A project's own .claude/skills
# is part of the repository, so commit it to make the skills available there.
set -euo pipefail

kit_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
day_to_day=(adr-new project-sync project-onboard)
mode="link"
project=""
all="no"

usage() {
  echo "usage: $0 [--copy | --uninstall | --project <dir> [--all]]" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --copy) mode="copy" ;;
    --uninstall) mode="uninstall" ;;
    --project) mode="project"; shift; [[ $# -gt 0 ]] || usage; project="$1" ;;
    --all) all="yes" ;;
    *) usage ;;
  esac
  shift
done

if [[ "$mode" == "project" ]]; then
  [[ -d "$project" ]] || { echo "install: $project is not a directory" >&2; exit 1; }
  project="$(cd "$project" && pwd)"
  [[ "$project" != "$kit_dir" ]] || { echo "install: refusing to copy the kit into itself" >&2; exit 1; }
  [[ -d "$project/.git" ]] || echo "note: $project is not a git repository root; commit .claude/skills where your repository starts" >&2

  if [[ "$all" == "yes" ]]; then
    names=()
    for skill_path in "$kit_dir"/skills/*/; do names+=("$(basename "$skill_path")"); done
  else
    names=("${day_to_day[@]}")
  fi

  mkdir -p "$project/.claude/skills"
  for name in "${names[@]}"; do
    source_dir="$kit_dir/skills/$name"
    [[ -d "$source_dir" ]] || { echo "skipped  $name (not in this kit)" >&2; continue; }
    dest="$project/.claude/skills/$name"
    verb="copied "
    if [[ -e "$dest" ]]; then rm -rf "$dest"; verb="updated"; fi
    cp -R "$source_dir" "$dest"
    find "$dest" -name '*.test.mjs' -delete
    echo "$verb  $name -> $dest"
  done
  echo "Commit .claude/skills/ so cloud sessions and teammates get these skills."
  exit 0
fi

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
