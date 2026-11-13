#!/usr/bin/env python3
"""Validate Devungeon's synthetic fixtures and basic cross-reference invariants.

This validates documentation fixtures only. It is not a runtime game/integration test.
"""
from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "schema"
EXAMPLE_DIR = ROOT / "examples"

PAIRS = (
    ("project-snapshot.schema.json", "tiny-landing-page.json"),
    ("project-snapshot.schema.json", "agent-workbench-synthetic.json"),
    ("world-blueprint.schema.json", "demo-world-blueprint.json"),
    ("agent-event.schema.json", "demo-agent-event.json"),
    ("game-state.schema.json", "demo-game-state.json"),
)


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def check_snapshot(value: dict) -> None:
    zones = [z["id"] for z in value["zones"]]
    rooms = {r["id"]: r for r in value["rooms"]}
    assert len(zones) == len(set(zones)), "duplicate zone IDs"
    assert len(rooms) == len(value["rooms"]), "duplicate room IDs"
    assert all(room["zone_id"] in zones for room in rooms.values())
    for room in rooms.values():
        assert room["id"] not in room["depends_on"], "self-dependency"
        assert all(dependency in rooms for dependency in room["depends_on"]), "missing dependency"
        if room["status"] == "accepted" and not value["project"]["source"]["is_demo"]:
            assert any(e["verification"] == "verified" for e in room["evidence"]), (
                "real accepted room must have verified evidence"
            )
    def visit(room_id: str, pending: set[str], done: set[str]):
        assert room_id not in pending, "dependency cycle detected"
        if room_id not in done:
            pending.add(room_id)
            for dep in rooms[room_id]["depends_on"]:
                visit(dep, pending, done)
            pending.remove(room_id)
            done.add(room_id)
    done: set[str] = set()
    for room_id in rooms:
        visit(room_id, set(), done)
    for agent in value["agents"]:
        assert not agent.get("room_id") or agent["room_id"] in rooms, "bad agent room ID"
        if value["project"]["source"]["is_demo"]:
            assert agent.get("is_demo") is True, "synthetic agent not flagged"


def main() -> None:
    for schema in SCHEMA_DIR.glob("*.schema.json"):
        Draft202012Validator.check_schema(load(schema))
    for schema_name, example_name in PAIRS:
        schema = load(SCHEMA_DIR / schema_name)
        value = load(EXAMPLE_DIR / example_name)
        Draft202012Validator(schema, format_checker=FormatChecker()).validate(value)
        if schema_name == "project-snapshot.schema.json":
            check_snapshot(value)
        print(f"PASS {example_name} against {schema_name}")
    project = load(EXAMPLE_DIR / "tiny-landing-page.json")
    blueprint = load(EXAMPLE_DIR / "demo-world-blueprint.json")
    assert project["project"]["id"] == blueprint["project_id"]
    assert project["revision"] == blueprint["project_revision"]
    assert {r["id"] for r in project["rooms"]} == {r["room_id"] for r in blueprint["rooms"]}
    assert all(c["from_room_id"] != c["to_room_id"] for c in blueprint["connections"])
    event = load(EXAMPLE_DIR / "demo-agent-event.json")
    agent_project = load(EXAMPLE_DIR / "agent-workbench-synthetic.json")
    assert event["project_id"] == agent_project["project"]["id"]
    assert event["agent_id"] in {a["id"] for a in agent_project["agents"]}
    assert event["room_id"] in {r["id"] for r in agent_project["rooms"]}
    assert event["is_demo"] is True
    print("PASS cross-reference invariants for bundled synthetic fixtures")


if __name__ == "__main__":
    main()
