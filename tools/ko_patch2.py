#!/usr/bin/env python3
"""One-off: translate the WebGL context-lost message in 05-renderer.js.

Exact original literal must occur; otherwise the run fails and nothing is written.
Idempotent: skips when the translated literal is already present.
"""
import pathlib
import sys

PATH = "src/game/frags/05-renderer.js"
OLD = "'Graphics reset by the browser — lowering quality'"
NEW = "'브라우저가 그래픽을 초기화했어요 — 화질을 낮춥니다'"

p = pathlib.Path(PATH)
s = p.read_text(encoding="utf-8")
if NEW in s:
    print("already applied:", PATH)
    sys.exit(0)
if s.count(OLD) < 1:
    print("NOT FOUND:", OLD)
    sys.exit(1)
p.write_text(s.replace(OLD, NEW), encoding="utf-8")
print("changed:", PATH)
