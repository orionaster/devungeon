"""Validate repository-local Agent Skills metadata without installing/executing skills.

Only checks the intentionally simple metadata used in this repository. No arbitrary YAML
parsing or remote content execution. Run with python scripts/validate_skills.py.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL_DIRS = (ROOT / ".agents" / "skills", ROOT / ".claude" / "skills")
NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    contents = path.read_text(encoding="utf-8")
    lines = contents.splitlines()
    if not lines or lines[0] != "---":
        return [f"{path}: missing opening frontmatter delimiter"]
    try:
        closing = lines.index("---", 1)
    except ValueError:
        return [f"{path}: missing closing frontmatter delimiter"]
    frontmatter: dict[str, str] = {}
    for line in lines[1:closing]:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if ":" not in line:
            errors.append(f"{path}: unexpected frontmatter line: {line}")
            continue
        key, val = line.split(":", 1)
        frontmatter[key.strip()] = val.strip().strip('"').strip("'")
    name = frontmatter.get("name", "")
    desc = frontmatter.get("description", "")
    if not name or len(name) > 64 or not NAME_RE.fullmatch(name) or name != path.parent.name:
        errors.append(f"{path}: invalid name {name!r} (must match directory)")
    if not desc or len(desc) > 1024:
        errors.append(f"{path}: missing/oversized description")
    if not any(line.strip() for line in lines[closing + 1 :]):
        errors.append(f"{path}: empty skill body")
    return errors


def main() -> int:
    skill_files = sorted(f for d in SKILL_DIRS if d.exists() for f in d.glob("*/SKILL.md"))
    if not skill_files:
        print("No repository Skills found")
        return 1
    problems = [issue for path in skill_files for issue in validate(path)]
    for issue in problems:
        print(issue)
    if problems:
        print(f"FAILED: {len(problems)} problem(s)")
        return 1
    print(f"OK: {len(skill_files)} local SKILL.md files have valid minimal metadata")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
