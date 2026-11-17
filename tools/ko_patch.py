#!/usr/bin/env python3
"""One-off Korean string patch for sunslide-ko (translation-plan.md).

Each original literal must occur at least once in its file; otherwise the run
fails and nothing is written. Already-applied entries are skipped (idempotent).
"""
import pathlib
import sys

PATCHES = {
    "tests/unit/sector-stars.test.js": [
        ("""toContain('5 stars');""", """toContain('별 5개 획득');"""),
    ],
    "README.md": [
        ("""코드가 조립하는 동적 템플릿 문자열(전투·로그류 등)과 원작 로직""",
         """디버그 오버레이(`?debug`) 등 개발자 전용 문구와 원작 로직"""),
        ("""번역이 빠진 문구가 남아 있을 수 있습니다.""", """배포 빌드의 주요 화면은 번역되었고, 일부 개발자용 문구는 번역하지 않았습니다."""),
    ],
    "src/clear-stars.js": [
        ("""`Sector ${sector} · ${moves} moves (par ${par})`""",
         """`섹터 ${sector} · ${moves}수 (기준 ${par}수)`"""),
        ("""`Sector ${sector} cleared with ${stars} of 3 stars, ${moves} moves, par ${par}`""",
         """`섹터 ${sector} 클리어 · 별 3개 중 ${stars}개 · ${moves}수 · 기준 ${par}수`"""),
    ],
    "src/map-toggle.js": [
        ("""'Hide island map'""", """'섬 지도 숨기기'"""),
        ("""'Show island map'""", """'섬 지도 보기'"""),
    ],
    "src/win-screen.js": [
        ("""`Sector clear. New best: ${record.moves} moves in ${formatRunTime(record.timeMs)}.`""",
         """`섹터 클리어! 새 최고 기록: ${record.moves}수, ${formatRunTime(record.timeMs)}.`"""),
        ("""`Sector clear. ${record.moves} moves in ${formatRunTime(record.timeMs)}.`""",
         """`섹터 클리어! ${record.moves}수, ${formatRunTime(record.timeMs)}.`"""),
    ],
    "src/logic/run-best.js": [
        ("""Best run: ${b.moves} moves · """, """최고 기록: ${b.moves}수 · """),
    ],
    "tests/unit/run-best.test.js": [
        ("""'Best run: 8 moves · 33.0s'""", """'최고 기록: 8수 · 33.0s'"""),
    ],
    "src/logic/sector-stars.js": [
        ("""`★ ${total} star${total === 1 ? '' : 's'} earned (optional par)`""",
         """`★ 별 ${total}개 획득 (선택 기준 수)`"""),
    ],
    "public/site.webmanifest": [
        ("""Bubble-frog arcade puzzle on sliding meadow islands around a tiny planet.""",
         """작은 행성 주위 미끄러지는 초원 섬에서 거품 개구리를 움직이는 아케이드 퍼즐."""),
    ],
    "src/game/frags/04-rules.js": [
        ("""$('res').innerHTML='Score <b>'+score+'</b> &middot; Sector <b>'+level+'</b><br>Best score <b>'+scoreBest+'</b>';""",
         """$('res').innerHTML='점수 <b>'+score+'</b> &middot; 섹터 <b>'+level+'</b><br>최고 점수 <b>'+scoreBest+'</b>';"""),
        ("""'Extra life!'""", """'목숨 +1!'"""),
        ("""'Combo ×'""", """'콤보 ×'"""),
        ("""'combo ×'""", """'콤보 ×'"""),
        ("""'Sunstone! Chase the bats'""", """'햇살 돌! 박쥐를 쫓아가세요'"""),
        ("""'Island '+T.num+' cleared! It blooms'""", """'섬 '+T.num+' 클리어! 꽃이 피었어요'"""),
        ("""' and its bat flies off'""", """' 그리고 박쥐가 날아갔어요'"""),
        ("""'A sky berry ripened on island '+T.num+'!'""", """'섬 '+T.num+'에 하늘 열매가 익었어요!'"""),
        ("""' speed!'""", """' 스피드!'"""),
        ("""'Sinkhole! Turn away!'""", """'싱크홀! 피하세요!'"""),
        ("""'Whoosh!'""", """'휙!'"""),
        ("""'Not while a sinkhole is open there'""", """'그 자리는 싱크홀이 열려 있어 안 돼요'"""),
        ("""'That island isn’t next to the empty meadow'""", """'이 섬은 빈 초원 옆에 없어요'"""),
        ("""'Too dark — islands only slide in sunlight'""", """'너무 어두워요 — 섬은 햇빛 아래서만 밀 수 있어요'"""),
        ("""'Wait — someone is crossing'""", """'잠깐만요 — 누군가 지나가고 있어요'"""),
        ("""'Island '+T.num+' is home!'""", """'섬 '+T.num+'이 제자리에 왔어요!'"""),
        ("""' Its bat falls asleep'""", """' 박쥐가 잠들었어요'"""),
        ("""' Bubbles score ×2'""", """' 방울 점수 ×2'"""),
        ("""'All islands home! +3000'""", """'모든 섬이 제자리에! +3000'"""),
        ("""'READY'""", """'준비'"""),
        ("""'SECTOR '+level""", """'섹터 '+level"""),
        ("""'The planet is fully green!'""", """'행성이 완전히 초록으로 물들었어요!'"""),
        ("""'SECTOR CLEARED · '""", """'섹터 클리어 · '"""),
        ("""' ('+runMoves+' moves, par '+sectorPar+')'""", """' ('+runMoves+'수, 기준 '+sectorPar+'수)'"""),
    ],
    "src/game/frags/05-renderer.js": [
        ("""'This browser has no WebGL, which Sunslide needs.'""",
         """'이 브라우저는 Sunslide에 필요한 WebGL을 지원하지 않아요.'"""),
        ("""'Graphics reset by the browser — lowering quality'""",
         """'브라우저가 그래픽을 초기화했어요 — 화질을 낮춥니다'"""),
    ],
    "src/game/frags/10-input.js": [
        ("""'Sound: '""", """'사운드: '"""),
        ("""'Music: '""", """'음악: '"""),
        ("""'View: '""", """'시점: '"""),
        ("""'Quality: '""", """'화질: '"""),
        ("""?'Off':'On'""", """?'끔':'켬'"""),
        ("""?'On':'Off'""", """?'켬':'끔'"""),
        ("""?'Planet':'Close'""", """?'행성':'가까이'"""),
        ("""'Auto ('""", """'자동 ('"""),
        ("""'Waypoint cleared'""", """'경로 표시 해제'"""),
        ("""'Island '+T.num+' is already in bloom'""", """'섬 '+T.num+'은 이미 꽃이 피었어요'"""),
        ("""'You are on island '+T.num""", """'지금 섬 '+T.num+' 위에 있어요'"""),
        ("""'Waypoint: island '+T.num+' — follow the pink arrow'""",
         """'경로: 섬 '+T.num+' — 분홍 화살표를 따라가세요'"""),
    ],
    "src/game/frags/11-quality-sizing-loop.js": [
        ("""'Low'""", """'낮음'"""),
        ("""'Medium'""", """'보통'"""),
        ("""'High'""", """'높음'"""),
        ("""'Gamepad connected — stick to hop, LB/RB + A to slide'""",
         """'게임패드 연결됨 — 스틱으로 이동, LB/RB + A로 밀기'"""),
        ("""'Gamepad disconnected'""", """'게임패드 연결 해제됨'"""),
        ("""'Island '+tiles[o.id].num""", """'섬 '+tiles[o.id].num"""),
        ("""' selected — A to slide'""", """' 선택 — A로 밀기'"""),
        ("""' is in the dark'""", """'은 어둠 속에 있어요'"""),
    ],
}


def apply(rel, pairs, root):
    path = root / rel
    if not path.exists():
        return None, [f"{rel}: file missing"]
    original = path.read_text(encoding="utf-8")
    text = original
    errors = []
    for old, new in pairs:
        if old in text:
            text = text.replace(old, new)
        elif new in text:
            continue  # already applied on an earlier run
        else:
            errors.append(f"{rel}: NOT FOUND: {old}")
    return (text if text != original else None), errors


def main():
    root = pathlib.Path(__file__).resolve().parent.parent
    results, errors = {}, []
    for rel, pairs in PATCHES.items():
        new_text, errs = apply(rel, pairs, root)
        errors += errs
        if new_text is not None:
            results[rel] = new_text
    if errors:
        print("PATCH FAILED — nothing written:")
        print("\n".join(errors))
        return 1
    for rel, new_text in results.items():
        (root / rel).write_text(new_text, encoding="utf-8")
        print("changed:", rel)
    if not results:
        print("no changes (already applied)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
