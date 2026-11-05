#!/usr/bin/env python3
"""oc-report: сводка по сессиям OpenCode из opencode.db.

Паритет с oc-report.cs (nextorm-версия): те же запросы, тот же вывод.
Запуск: python3 oc-report.py [days] [--agent pdca-executor] [--db path] [--all]
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

MODEL_COLUMNS = (
    "json_extract(model,'$.providerID') AS provider, "
    "json_extract(model,'$.id') AS model_id"
)


def parse_args(argv: list[str]) -> argparse.Namespace:
    default_db = os.environ.get("OPENCODE_DB") or os.path.join(
        os.path.expanduser("~"), ".local", "share", "opencode", "opencode.db"
    )
    parser = argparse.ArgumentParser(description="OpenCode session report")
    parser.add_argument("days", nargs="?", type=int, default=3, help="окно в днях (по умолчанию 3)")
    parser.add_argument("--agent", default="pdca-executor", help="агент (по умолчанию pdca-executor)")
    parser.add_argument("--all", action="store_true", help="без фильтра по агенту")
    parser.add_argument("--db", default=default_db, help="путь к opencode.db")
    args = parser.parse_args(argv)
    if args.days <= 0:
        parser.error("days must be positive")
    if not os.path.exists(args.db):
        parser.error(f"opencode.db not found: {args.db}")
    if args.all:
        args.agent = None
    return args


def open_db(path: str) -> sqlite3.Connection:
    uri = f"file:{path}?mode=ro"
    return sqlite3.connect(uri, uri=True, timeout=5)


def session_filter(agent: str | None) -> tuple[str, list]:
    if agent is None:
        return "", []
    return " AND agent = ?", [agent]


def fetch_sessions(conn: sqlite3.Connection, since: int, agent: str | None) -> list[tuple]:
    where, params = session_filter(agent)
    return conn.execute(
        "SELECT id, agent, model, title, time_created, idle_outcome "
        f"FROM session_v2 WHERE time_created >= ?{where}",
        [since, *params],
    ).fetchall()


def fetch_model_aggs(conn: sqlite3.Connection, since: int, agent: str | None) -> list[tuple]:
    where, params = session_filter(agent)
    return conn.execute(
        f"SELECT {MODEL_COLUMNS}, idle_outcome, count(*), "
        "sum(tokens_input), sum(tokens_output), sum(tokens_cache_read), sum(cost) "
        f"FROM session_v2 WHERE time_created >= ?{where} "
        "GROUP BY provider, model_id, idle_outcome",
        [since, *params],
    ).fetchall()


def fetch_error_messages(conn: sqlite3.Connection, since: int) -> list[tuple]:
    return conn.execute(
        "SELECT session_id, data FROM session_message "
        "WHERE time_created >= ? AND data LIKE '%\"error\"%'",
        [since],
    ).fetchall()


def parse_model(raw: str | None) -> str:
    if not raw:
        return "(none)"
    try:
        model = json.loads(raw)
    except (ValueError, TypeError):
        return raw
    return model_label(model.get("providerID"), model.get("id"))


def model_label(provider: str | None, model_id: str | None) -> str:
    if not provider and not model_id:
        return "(none)"
    return f"{provider or '?'}/{model_id or '?'}"


def m(value: int) -> str:
    return f"{value / 1_000_000:.2f}M"


def k(value: int) -> str:
    return f"{value / 1_000:.1f}k"


def from_ms(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


def truncate(text: str | None, width: int) -> str:
    text = text or ""
    return text if len(text) <= width else text[:width]


def aggregate_models(rows: list[tuple]) -> list[dict]:
    merged: dict[tuple[str, str], dict] = {}
    for provider, model_id, outcome, n, tin, tout, cache, cost in rows:
        key = (provider or "?", model_id or "?")
        acc = merged.setdefault(
            key,
            {"n": 0, "ok": 0, "fail": 0, "input": 0, "output": 0, "cache": 0, "cost": 0.0},
        )
        acc["n"] += n
        if outcome == "succeeded":
            acc["ok"] += n
        elif outcome == "failed":
            acc["fail"] += n
        acc["input"] += tin or 0
        acc["output"] += tout or 0
        acc["cache"] += cache or 0
        acc["cost"] += cost or 0.0
    return [
        {"label": f"{p}/{i}", **acc, "other": acc["n"] - acc["ok"] - acc["fail"]}
        for (p, i), acc in merged.items()
    ]


def print_models(aggs: list[dict]) -> None:
    aggs.sort(key=lambda a: a["n"], reverse=True)
    print("by model:")
    print(
        f"  {'model':<42} {'n':>4} {'ok':>4} {'fail':>5} {'other':>6} "
        f"{'input':>9} {'output':>8} {'cache':>9} {'cost':>9}"
    )
    for a in aggs:
        print(
            f"  {a['label']:<42} {a['n']:>4} {a['ok']:>4} {a['fail']:>5} {a['other']:>6} "
            f"{m(a['input']):>9} {k(a['output']):>8} {m(a['cache']):>9} "
            f"{'$' + format(a['cost'], '.3f'):>9}"
        )
    print(
        f"  {'total':<42} {sum(a['n'] for a in aggs):>4} {sum(a['ok'] for a in aggs):>4} "
        f"{sum(a['fail'] for a in aggs):>5} {sum(a['other'] for a in aggs):>6} "
        f"{m(sum(a['input'] for a in aggs)):>9} {k(sum(a['output'] for a in aggs)):>8} "
        f"{m(sum(a['cache'] for a in aggs)):>9} "
        f"{'$' + format(sum(a['cost'] for a in aggs), '.3f'):>9}"
    )
    print()


def print_outcomes(rows: list[tuple]) -> None:
    counts: dict[str, int] = defaultdict(int)
    for row in rows:
        counts[row[5] or "(running)"] += 1
    print("outcomes: " + ", ".join(f"{name}={n}" for name, n in counts.items()))

    def created(row: tuple) -> datetime:
        return from_ms(row[4] or 0)

    failed = [r for r in rows if r[5] is not None and r[5] != "succeeded"]
    for row in failed[:10]:
        print(
            f"  {row[0][-6:]} {created(row):%m-%d %H:%M}Z {row[5]:<11} "
            f"{truncate(row[3], 46)}"
        )
    print()


def print_errors(messages: list[tuple], session_ids: set[str]) -> None:
    errors: list[tuple[str, str, str, str]] = []
    for session_id, data in messages:
        if not data or session_id not in session_ids:
            continue
        try:
            doc = json.loads(data)
        except (ValueError, TypeError):
            continue
        error = doc.get("error")
        if not isinstance(error, dict):
            continue
        model = doc.get("model")
        label = model_label(model.get("providerID"), model.get("id")) if isinstance(model, dict) else "(none)"
        errors.append((str(error.get("type") or "?"), label, session_id[-6:], str(error.get("message") or "")))

    print(f"errors: {len(errors)}")
    grouped: dict[str, list[tuple[str, str, str, str]]] = defaultdict(list)
    for item in errors:
        grouped[item[0]].append(item)
    for error_type, items in sorted(grouped.items(), key=lambda kv: len(kv[1]), reverse=True):
        print(f"  {error_type:<24} {len(items):>3}  {truncate(items[0][3], 70)}")
        by_model: dict[str, int] = defaultdict(int)
        for item in items:
            by_model[item[1]] += 1
        for label, count in sorted(by_model.items(), key=lambda kv: kv[1], reverse=True):
            first = next(item[2] for item in items if item[1] == label)
            print(f"      {label:<34} {count:>3}  first ses_…{first}")


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    now = datetime.now(tz=timezone.utc)
    since = int((now - timedelta(days=args.days)).timestamp() * 1000)

    conn = open_db(args.db)
    try:
        sessions = fetch_sessions(conn, since, args.agent)
        model_rows = fetch_model_aggs(conn, since, args.agent)
        messages = fetch_error_messages(conn, since)
    finally:
        conn.close()

    print(
        f"window: {from_ms(since):%Y-%m-%d %H:%M}Z .. {now:%Y-%m-%d %H:%M}Z "
        f"({args.days}d), agent={args.agent or 'any'}, sessions={len(sessions)}"
    )
    print()
    print_models(aggregate_models(model_rows))
    print_outcomes(sessions)
    print_errors(messages, {row[0] for row in sessions})
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
