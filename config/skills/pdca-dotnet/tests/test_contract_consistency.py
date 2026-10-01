"""Static regression guards for the pdca-dotnet contract consistency task.

These tests read the contract files as *text* and assert that the Task 1 rules
are present in the operative sections (and that contradictory old rules are
gone).  They are rule-presence guards, **not** behavioral proof: they do not
execute a model and do not prove that an agent follows the contract.  Behavioral
scenario review is a separate step.

Run:
    python3 -m unittest discover -s config/skills/pdca-dotnet/tests -p 'test_*.py' -v
"""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
SKILL_PATH = REPO / "config/skills/pdca-dotnet/SKILL.md"
ASSET_BRIEFS = [
    REPO / f"config/skills/pdca-dotnet/assets/agents/{name}.md"
    for name in ("planner", "coder", "check", "escalate")
]
CONFIG_BRIEFS = [
    REPO / f"config/agents/{name}.md"
    for name in ("planner", "coder", "check", "escalate")
]
# Task 2: the six published EN assets and the tier each must carry (no `model:`).
PUBLISHED_ASSETS = [
    REPO / f"config/skills/pdca-dotnet/assets/agents/{name}.md"
    for name in ("planner", "coder", "check", "escalate", "scout", "security-auditor")
]
ROLE_TIER = {
    "planner": "medium",
    "coder": "cheap",
    "check": "medium",
    "escalate": "strong",
    "scout": "cheap",
    "security-auditor": "medium",
}
# Task 3: cross-artifact label sources (README + diagram source) and the
# non-executable scenario matrix.  These are text/JSON presence guards only.
README_PATH = REPO / "README.md"
DIAGRAM_DIR = REPO / "config/skills/pdca-dotnet/assets/diagram"
WORKFLOW_PATH = DIAGRAM_DIR / "workflow.json"
GEN_PDCA_PATH = DIAGRAM_DIR / "gen_pdca.py"
SCENARIOS_PATH = REPO / "config/skills/pdca-dotnet/tests/scenarios.md"


def norm(text: str) -> str:
    """Collapse whitespace (incl. line wraps) and drop backticks/format noise."""
    text = text.replace("`", "").replace("*", "")
    return re.sub(r"\s+", " ", text)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def between(text: str, start: str, end: str) -> str:
    i = text.find(start)
    if i < 0:
        return ""
    j = text.find(end, i + len(start))
    return text[i:j] if j >= 0 else text[i:]


class ContractConsistencyTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.skill_raw = read(SKILL_PATH)
        cls.skill = norm(cls.skill_raw)
        # The counter block is the State machine intro before the Phase todo tracker.
        cls.counters = norm(between(cls.skill_raw, "## State machine", "### Phase todo tracker"))
        cls.todo_tracker = norm(
            between(cls.skill_raw, "### Phase todo tracker", "Transition gates:")
        )
        cls.status_file = norm(
            between(cls.skill_raw, "### Cycle status file", "### Message for the next session")
        )
        cls.gate2 = norm(between(cls.skill_raw, "2. **DO → CHECK**", "3. **CHECK → ACT**"))
        cls.check_streams = norm(
            between(cls.skill_raw, "### Parallel CHECK streams", "Then follows the checklist")
        )
        cls.escalation = norm(
            between(cls.skill_raw, "### Escalation (`escalate`)", "## PLAN: design checklist")
        )
        cls.autonomous = norm(
            between(cls.skill_raw, "## Autonomous mode", "## Red flags")
        )
        cls.gate1 = norm(between(cls.skill_raw, "1. **PLAN → DO**", "2. **DO → CHECK**"))
        cls.red_flags = norm(
            between(cls.skill_raw, "## Red flags (self-check)", "### Cycle failure modes")
        )
        cls.host = norm(
            between(
                cls.skill_raw,
                "## Host requirements (roles → agents)",
                "## Orchestrator role",
            )
        )
        cls.orchestrator = norm(
            between(cls.skill_raw, "## Orchestrator role", "## State machine")
        )

    # --- revision `r` counter semantics ---------------------------------

    def test_three_counters_defined_not_two(self):
        self.assertIn("Three counters", self.counters)
        self.assertNotIn("Two counters", self.counters)

    def test_plan_revision_counter_definition(self):
        self.assertIn("Plan revision r", self.counters)
        self.assertIn("starts at 1", self.counters)
        self.assertIn("only when planner actually issued a revised plan", self.counters)

    def test_plan_to_do_starts_at_one(self):
        self.assertIn("PLAN(r) → DO starts at 1", self.counters)

    def test_check_to_do_increments_and_third_check_escalates(self):
        self.assertIn("CHECK → DO increments", self.counters)
        self.assertIn("third failed CHECK of the same revision", self.counters)
        self.assertIn("before a fourth attempt", self.counters)
        self.assertIn("no 4th attempt", self.counters)

    def test_plan_returns_do_not_consume_attempts_and_new_revision_resets(self):
        self.assertIn("do not consume the next revision's attempts", self.counters)
        self.assertIn("new revision resets n to 1", self.counters)

    def test_rejected_candidate_not_new_revision_no_reset(self):
        self.assertIn("rejected candidate", self.counters)
        self.assertIn("not a new revision", self.counters)
        self.assertIn("does not reset the attempt counter", self.counters)

    def test_replan_does_not_erase_same_defect_history(self):
        self.assertIn("not erased by a replan", self.counters)
        self.assertIn("same defect after one fix still forces escalate before the second fix",
                      self.counters)

    def test_no_arbitrary_replan_cap(self):
        self.assertIn("no arbitrary cap on the number of revisions", self.counters)

    def test_no_global_iteration_on_every_loopback(self):
        self.assertNotIn("grows on every loop-back", self.counters)
        self.assertIn("no global iteration n/3 on every loop-back", self.counters)

    # --- unfinished D / blocker retention / superseded mapping -----------

    def test_gate2_blocker_report_not_done_and_retained(self):
        self.assertIn("blocker report", self.gate2)
        self.assertIn("not done", self.gate2)
        self.assertIn("unfinished implementation stays in the status file", self.gate2)

    def test_gate2_pending_blocked_prevents_gate(self):
        self.assertIn("pending/blocked unresolved work", self.gate2)
        self.assertIn("prevents gate 2", self.gate2)

    def test_rejected_candidate_resumes_original_d(self):
        self.assertIn("rejected candidate resumes the original D", self.gate2)

    def test_superseded_replacement_mapping_required(self):
        # Mapping is required for an *actual replacement*; an additive prerequisite
        # gets none (see FinalFixGuardTest). Not weakened: the mapping stays required.
        self.assertIn("superseded→replacement", self.skill)
        self.assertIn("actual scope replacement", self.skill)
        self.assertIn("no superseded→replacement mapping", self.skill)

    # --- exactly one active aggregate phase todo -------------------------

    def test_todo_exactly_one_active_phase_item(self):
        self.assertIn("exactly one is in_progress", self.todo_tracker)
        self.assertIn("one aggregate D:", self.todo_tracker)

    def test_parallel_units_tracked_in_status_file(self):
        self.assertIn("parallel D: units and DO streams live in the status file", self.todo_tracker)

    def test_aggregate_d_closes_on_gate2(self):
        self.assertIn("aggregate D: closes only when all units and DO streams satisfy gate 2",
                      self.todo_tracker)

    # --- gate 1 transition + red-flag section (fix round 1) --------------

    def test_gate1_activates_single_aggregate_d_not_first_d(self):
        # The gate-1 "When starting DO" transition must start the one aggregate
        # `D:` (units tracked in the status file), not "the first `D:`".
        self.assertIn("single aggregate D: → in_progress", self.gate1)
        self.assertIn("units/streams are tracked in the status file", self.gate1)
        self.assertNotIn("the first D:", self.gate1)

    def test_redflag_attempt_scoped_to_same_revision_not_global(self):
        # Red flag: a 4th attempt is revision-local; escalate after the third
        # failed CHECK of the same revision; same-defect history persists.
        self.assertIn("4th attempt within the same plan revision", self.red_flags)
        self.assertIn("third failed CHECK of that revision escalates before attempt 4",
                      self.red_flags)
        self.assertIn("same-defect history is unchanged across revisions", self.red_flags)
        self.assertNotIn("4th iteration in general", self.red_flags)

    def test_unit_state_schema_with_replacement(self):
        self.assertIn("Unit states", self.status_file)
        for state in ("pending", "running", "blocked", "done", "superseded"):
            self.assertIn(state, self.status_file)
        self.assertIn("superseded unit", self.status_file)

    # --- status file journal / replan ------------------------------------

    def test_status_file_journal_template_carries_revision(self):
        self.assertIn("<UTC time> | <phase> | revision r | iteration n/3 | <event>",
                      self.status_file)

    def test_replan_records_outgoing_failed_attempt(self):
        self.assertIn("outgoing failed attempt", self.status_file)

    # --- same-scope cleanup ----------------------------------------------

    def test_numeric_757_replaced_with_heading_pointer(self):
        self.assertNotIn(":757", self.skill_raw)
        self.assertIn(
            'PLAN owns the quality of the plan (a weak task statement is not an excuse)',
            self.skill,
        )
        # The DO → PLAN bullet now points at the heading, not the numeric line.
        self.assertIn("PLAN owns the quality of the plan", self.skill)

    def test_four_unconditional_check_streams(self):
        self.assertIn("Four unconditional streams", self.check_streams)
        self.assertNotIn("Three unconditional streams", self.check_streams)

    # --- escalation wording scoped to a revision -------------------------

    def test_escalation_same_defect_scoped_and_revision_aware(self):
        self.assertIn("same revision", self.escalation)
        self.assertIn("same defect came back after one fix", self.escalation)
        self.assertNotIn("after the 3rd failed iteration", self.escalation)

    def test_autonomous_escalation_revision_aware(self):
        self.assertIn("same revision", self.autonomous)

    # --- briefs mirror the rules (scoped to each brief's operative clause) --
    # Assert key *relationships* inside the operative section, not a bare
    # keyword anywhere. EN and RU wordings are both accepted.

    def _scoped(self, path: Path, start: str, end: str) -> str:
        chunk = between(read(path), start, end)
        self.assertTrue(chunk, f"{path}: section {start!r}..{end!r} not found")
        return norm(chunk)

    def _assert_patterns(self, text: str, label: str, patterns) -> None:
        for pat in patterns:
            self.assertRegex(text, pat, f"{label}: missing /{pat}/")

    def _assert_brief_contract(self, path: Path) -> None:
        en = "assets/agents" in str(path)
        name = path.stem
        if name == "coder":
            status = self._scoped(
                path,
                "Status file." if en else "Статус-файл.",
                "Unfinished work" if en else "Незавершённая",
            )
            self.assertRegex(status, r"revision r\s*\|\s*iteration n/3")
            retention = self._scoped(
                path,
                "Unfinished work" if en else "Незавершённая",
                "Evidence, not claims" if en else "Доказательства",
            )
            self._assert_patterns(retention, f"coder retention {path}", [
                r"gate 2|гейта 2|гейт 2",
                r"rejected candidate|отвергнутый кандидат",
                r"original `?D`?|исходный `?D`?",
                r"superseded",
            ])
        elif name == "planner":
            step = self._scoped(path, "10.", "11.")
            self._assert_patterns(step, f"planner step10 {path}", [
                r"revised plan|пересмотренный план",
                r"increments the revision|увеличивает ревизию",
                r"resets the attempt n to 1|сбрасывает попытку n в 1",
                r"rejected candidate|отвергнутый кандидат",
                r"not a new revision|не новая ревизия",
                r"does not reset the attempts|не сбрасывает",
                r"superseded",
            ])
        elif name == "check":
            step = self._scoped(path, "5.", "6.")
            self._assert_patterns(step, f"check item5 {path}", [
                r"third failed CHECK of the same revision|"
                r"третьего провального CHECK той же ревизии",
                r"same defect|тот же дефект",
                r"persists across revisions|сохраняется между ревизиями",
            ])
        elif name == "escalate":
            para = self._scoped(
                path,
                "The counter is scoped" if en else "Счётчик привязан",
                "## What you do" if en else "## Что делаешь",
            )
            self._assert_patterns(para, f"escalate counter {path}", [
                r"PLAN\(r\) → DO",
                r"n=1",
                r"third failed CHECK of the same revision|"
                r"третьего провального CHECK той же ревизии",
                r"same defect|одного и того же дефекта|того же дефекта",
                r"does not erase|не стирает",
            ])
        else:
            self.fail(f"unexpected brief {path}")

    def test_asset_briefs_mirror_scoped_contract(self):
        for path in ASSET_BRIEFS:
            with self.subTest(path=path.name):
                self._assert_brief_contract(path)

    def test_config_briefs_mirror_scoped_contract(self):
        for path in CONFIG_BRIEFS:
            with self.subTest(path=path.name):
                self._assert_brief_contract(path)

    def test_escalator_briefs_revision_scoped(self):
        for path in (ASSET_BRIEFS[3], CONFIG_BRIEFS[3]):
            with self.subTest(path=str(path)):
                en = "assets/agents" in str(path)
                para = self._scoped(
                    path,
                    "The counter is scoped" if en else "Счётчик привязан",
                    "## What you do" if en else "## Что делаешь",
                )
                self.assertRegex(
                    para,
                    r"third failed CHECK of the same revision|"
                    r"третьего провального CHECK той же ревизии",
                )

    # --- Task 2: autonomous mode is question-free -------------------------

    def test_autonomous_mode_has_no_ask_user_instruction(self):
        # No user exists in autonomous mode: no question may be posed at all.
        self.assertNotIn("Ask a question", self.autonomous)
        self.assertNotIn("ask the user", self.autonomous)
        self.assertIn("no question is ever asked", self.autonomous)

    def test_autonomous_blocker_routed_through_planner_or_escalate_to_stop(self):
        self.assertIn("planner", self.autonomous)
        self.assertIn("escalate", self.autonomous)
        self.assertIn("STOP", self.autonomous)
        self.assertIn("no user question", self.autonomous)

    def test_autonomous_covers_missing_criteria_and_unavailable_resource(self):
        # A missing acceptance criterion / unavailable resource must be covered by
        # the question-free route, not by asking.
        self.assertIn("missing acceptance criteria", self.autonomous)
        self.assertIn("ambiguous requirements", self.autonomous)
        self.assertIn("unavailable resource", self.autonomous)

    def test_gate1_ask_instruction_scoped_to_normal_mode(self):
        # The gate-1 ask-user instruction must be explicitly normal-mode only.
        self.assertNotRegex(self.gate1, r"acceptance criteria\s*—\s*ask, do not guess")
        self.assertIn("normal mode no acceptance criteria", self.gate1)
        self.assertIn("in autonomous mode", self.gate1)

    def test_normal_mode_retains_questions_and_go(self):
        self.assertIn("explicit user go-ahead", self.gate1)
        self.assertIn("normal mode", self.gate1)
        self.assertIn("write go", self.skill)

    # --- Task 2: DO-candidate fourth branch + trigger 5 -------------------

    def test_escalation_trigger5_low_confidence_without_externalness(self):
        self.assertIn("low confidence", self.escalation)
        self.assertIn("without established externalness", self.escalation)
        # The old "only if outside-cycle confirmed" local restriction must be gone.
        self.assertNotIn("escalate is called only if", self.escalation)
        self.assertIn("provisional candidate", self.escalation)

    def test_planner_four_way_classification_includes_insufficient_evidence(self):
        for path in (ASSET_BRIEFS[0], CONFIG_BRIEFS[0]):
            with self.subTest(path=str(path)):
                step = self._scoped(path, "10.", "11.")
                self._assert_patterns(step, f"planner classification {path}", [
                    r"insufficient evidence|недостат\w* доказательств",
                    r"scout",
                    r"low confidence|низк\w* уверенност",
                    r"trigger 5|триггер\w* 5",
                    r"even without|даже без|без доказанной",
                ])

    def test_planner_response_format_has_confidence_and_classification_slot(self):
        for path in (ASSET_BRIEFS[0], CONFIG_BRIEFS[0]):
            with self.subTest(path=str(path)):
                resp = self._scoped(
                    path,
                    "## Response format" if "assets/agents" in str(path) else "## Формат ответа",
                    "A missing item" if "assets/agents" in str(path) else "Пропущенный пункт",
                )
                self._assert_patterns(resp, f"planner response {path}", [
                    r"(?i)confidence and gaps|уверенность и пробелы",
                    r"(?i)classif|классифик",
                ])

    # --- Task 2: primary is a dispatcher incl. architect ------------------

    def test_orchestrator_is_dispatcher_for_every_primary_incl_architect(self):
        self.assertIn("every primary", self.orchestrator)
        self.assertIn("architect", self.orchestrator)
        self.assertIn("never starts to read files", self.orchestrator)
        self.assertIn("initial PLAN", self.orchestrator)
        self.assertIn("replan", self.orchestrator)
        self.assertIn("planner", self.orchestrator)

    def test_primary_wording_not_build_only(self):
        # The four `build`-specific spots now speak of the orchestrator/primary.
        self.assertGreaterEqual(self.skill.count("the orchestrator (primary)"), 4)

    def test_architect_agent_delegates_plan_in_pdca(self):
        architect = norm(read(REPO / "config/agents/architect.md"))
        self.assertNotIn("PLAN сам", architect)
        self.assertIn("внутри pdca ты — диспетчер", architect.lower())
        self.assertIn("и начальный PLAN, и replan-решения принадлежат субагенту planner", architect)
        self.assertIn("Вне PDCA", architect)

    # --- Task 2: host-profile binding + tier labels (no model:) -----------

    def test_published_assets_have_tier_labels_not_model(self):
        for path in PUBLISHED_ASSETS:
            with self.subTest(path=path.name):
                self.assertIn(path.stem, ROLE_TIER)
                raw = read(path)
                self.assertNotRegex(raw, r"(?m)^\s*#\s*model:")
                self.assertRegex(
                    raw, rf"(?m)^# tier: {ROLE_TIER[path.stem]}\s*$"
                )

    def test_host_requirements_bind_models_via_profile_not_markdown(self):
        self.assertNotIn("uncomment and fill in model:", self.host)
        self.assertIn("host profile", self.host)
        self.assertIn("not from a model: field in the role markdown", self.host)
        # Fallback limited by actual host permissions; denials never bypassed.
        self.assertIn("never bypass", self.host)

    # --- Task 2 fix round 1: user-go boundary + authority invocation ------

    def test_planner_plan_disk_paragraph_scopes_user_go_to_normal_mode(self):
        # The planner sub-brief's "plan goes to disk" paragraph must scope the user
        # go-ahead to the normal mode and state the autonomous no-go/no-question path.
        for path in (ASSET_BRIEFS[0], CONFIG_BRIEFS[0]):
            with self.subTest(path=str(path)):
                en = "assets/agents" in str(path)
                para = self._scoped(
                    path,
                    "11. Take into account" if en else "11. Учти",
                    "## Boundaries" if en else "## Границы",
                )
                self._assert_patterns(para, f"planner plan-disk {path}", [
                    r"(?i)normal mode|обычн\w* режим",
                    r"(?i)user's go-ahead|go пользователя",
                    r"(?i)autonomous mode|автономн\w* режим",
                    r"(?i)no question|no questions|ни вопроса|без вопрос|вопросов нет",
                    r"(?i)no waiting|без ожидания|ни ожидания|не жд",
                    r"(?i)gate-1|gate 1|гейт\w* 1",
                ])

    def test_plan_authority_invocation_unambiguous(self):
        # The primary forwards the request/evidence; planner authors the plan; coder writes.
        section = norm(between(
            self.skill_raw,
            "Both starting the cycle and the reverse return",
            "## Economics",
        ))
        self.assertTrue(section, "authority invocation paragraph not found")
        self.assertNotIn("the orchestrator (primary) formulates the P: task", section)
        self.assertIn("forwards the user's request", section)
        self.assertIn("gathered evidence", section)
        self.assertIn("formulates the P: task/plan", section)
        self.assertIn("coder writes", section)
        self.assertIn("every primary", section)
        self.assertIn("architect", section)
        self.assertIn("belong to planner", section)

    def test_cycle_quickref_marks_go_ahead_normal_mode_only(self):
        cycle = norm(between(
            self.skill_raw,
            "Cycle: `PLAN",
            "Progress is recorded",
        ))
        self.assertTrue(cycle, "cycle quickref line not found")
        self.assertIn("normal mode", cycle)
        self.assertIn("autonomous", cycle)


class CrossArtifactLabelGuardTest(unittest.TestCase):
    """Task 3 guards: README summary + diagram label sources + scenario matrix.

    Rule-presence only.  These read JSON/text; they never execute a model, the
    real PDCA cycle, or a production state machine, and therefore do not prove
    runnable behavior.  Behavioral validation is the independent A–I review.
    """

    @classmethod
    def setUpClass(cls) -> None:
        cls.workflow = json.loads(read(WORKFLOW_PATH))
        cls.gen = read(GEN_PDCA_PATH)
        cls.readme = read(README_PATH)
        cls.scenarios = read(SCENARIOS_PATH)

    def _node(self, node_id: str) -> dict:
        for node in self.workflow["nodes"]:
            if node["id"] == node_id:
                return node
        self.fail(f"workflow node {node_id!r} not found")

    def _edge(self, edge_id: str) -> dict:
        for edge in self.workflow["edges"]:
            if edge["id"] == edge_id:
                return edge
        self.fail(f"workflow edge {edge_id!r} not found")

    # --- diagram source: revision-scoped counters (labels, no redesign) ---

    def test_workflow_escalation_label_revision_scoped(self):
        sub = self._node("escalate")["sublabel"]
        self.assertIn("CHECK(r)", sub)
        self.assertIn("фикс", sub)
        self.assertNotIn("×3", sub)
        self.assertNotIn("×2", sub)

    def test_workflow_go_label_starts_attempt_one(self):
        self.assertIn("n=1", self._edge("e_go")["label"])

    def test_workflow_escalate_edge_not_generic_2_3x(self):
        label = self._edge("e_orb_escalate")["label"]
        self.assertIn("3-й провал", label)
        self.assertNotIn("2–3×", label)

    def test_workflow_replan_revision_edge_and_do_plan_preserved(self):
        # A real replan bumps the revision r → r+1; the DO → PLAN edge stays.
        self.assertIn("r+1", self._edge("e_orb_replan")["label"])
        self.assertIn("предусловие", self._edge("e_do_replan")["label"])

    def test_gen_pdca_labels_revision_scoped(self):
        for token in ("CHECK(r)", "n+1", "r+1", "повтор"):
            self.assertIn(token, self.gen, f"gen_pdca.py missing {token!r}")
        for stale in ("3-я итерация", "тот же дефект ×2", "разные — ×3"):
            self.assertNotIn(stale, self.gen, f"gen_pdca.py stale {stale!r}")

    def test_gen_pdca_preserves_replan_and_do_plan_edges(self):
        # No topology redesign: the CHECK → PLAN and DO → PLAN returns remain.
        self.assertIn("неверный план", self.gen)
        self.assertIn("новое предусловие/блокер", self.gen)

    # --- README concise summary -------------------------------------------

    def test_readme_scoped_attempts_no_brittle_line_count(self):
        self.assertNotIn("~1460", self.readme)
        self.assertNotRegex(self.readme, r"контракт\s+~?\d+\s+строк")
        self.assertIn("подробный контракт", self.readme)
        self.assertIn("n/3", self.readme)
        self.assertIn("ревизи", self.readme)
        self.assertNotIn("макс. 3 итераци", self.readme)

    def test_readme_single_active_phase_and_no_questions(self):
        self.assertIn("ровно одна активная", self.readme)
        self.assertIn("без вопросов", self.readme)

    def test_readme_assets_tier_labels_not_model(self):
        self.assertNotIn("пустым `model:`", self.readme)
        self.assertIn("# tier:", self.readme)

    # --- scenario matrix --------------------------------------------------

    def test_scenarios_matrix_covers_a_to_i(self):
        # B is deliberately split into B1 (additive prerequisite) and B2 (actual
        # replacement); every other case keeps its single-letter heading.
        for letter in "ACDEFGHI":
            self.assertIn(f"## {letter}.", self.scenarios,
                          f"scenarios.md missing case {letter}")
        self.assertIn("## B1.", self.scenarios, "scenarios.md missing case B1")
        self.assertIn("## B2.", self.scenarios, "scenarios.md missing case B2")
        for column in ("Вход", "Требуемый исход", "Оперативные источники"):
            self.assertIn(column, self.scenarios)

    def test_scenarios_matrix_is_labeled_not_claiming_execution(self):
        # The matrix is for independent reasoning; it must not claim that any
        # agent/model actually executed the scenarios.
        self.assertIn("не доказательство", self.scenarios)
        self.assertIn("не запускал", self.scenarios)


class FinalFixGuardTest(unittest.TestCase):
    """Final fix wave (review findings F2-F7 + the narrow discovered completions).

    Rule-presence only: reads Markdown/JSON text; never executes a model, the real
    PDCA cycle or a production state machine, and therefore proves no behavior.

    Intended-norm red: before the final-fix edits these assertions fail because the
    normative clauses are absent, not because of import/path errors.
    """

    @classmethod
    def setUpClass(cls) -> None:
        cls.skill_raw = read(SKILL_PATH)
        cls.skill = norm(cls.skill_raw)
        cls.gate2 = norm(between(cls.skill_raw, "2. **DO → CHECK**", "3. **CHECK → ACT**"))
        cls.gate3 = norm(between(cls.skill_raw, "3. **CHECK → ACT**", "4. **ACT → EXIT**"))
        cls.status_file = norm(
            between(cls.skill_raw, "### Cycle status file", "### Message for the next session")
        )
        cls.recovery = norm(
            between(cls.skill_raw, "## Recovery after compaction", "## Evidence over assertion")
        )
        cls.keep_check = norm(
            between(
                cls.skill_raw,
                "**Keep CHECK within one approved PLAN.**",
                "### Parallel CHECK streams",
            )
        )
        cls.autonomous = norm(between(cls.skill_raw, "## Autonomous mode", "## Red flags"))
        cls.planner_en = norm(read(ASSET_BRIEFS[0]))
        cls.planner_ru = norm(read(CONFIG_BRIEFS[0]))
        cls.coder_en = norm(read(ASSET_BRIEFS[1]))
        cls.coder_ru = norm(read(CONFIG_BRIEFS[1]))
        cls.check_en = norm(read(ASSET_BRIEFS[2]))
        cls.check_ru = norm(read(CONFIG_BRIEFS[2]))
        cls.scout_en = norm(read(REPO / "config/skills/pdca-dotnet/assets/agents/scout.md"))
        cls.scenarios = read(SCENARIOS_PATH)
        cls.plan = norm(read(REPO / "docs/superpowers/plans/2026-10-01-pdca-consistency-plan.md"))
        cls.readme = norm(read(README_PATH))

    # --- F4: additive prerequisite != replacement -------------------------

    def test_additive_prerequisite_is_not_a_replacement(self):
        self.assertIn("additive prerequisite", self.skill)
        self.assertIn("is not a replacement", self.skill)

    def test_additive_keeps_original_active_criteria_unchanged_no_mapping(self):
        self.assertIn("original D stays active", self.skill)
        self.assertIn("criteria and remainder unchanged", self.skill)
        self.assertIn("no superseded→replacement mapping", self.skill)

    def test_actual_replacement_requires_mapping_and_carries_criteria(self):
        self.assertIn("actual scope replacement", self.skill)
        self.assertIn("replacement unit(s) are tracked active", self.skill)
        self.assertIn("carry all original acceptance criteria and residual work", self.skill)

    def test_candidate_analysis_never_completes_d(self):
        self.assertIn("candidate analysis", self.skill)
        self.assertIn("never completes", self.skill)

    def test_planner_and_coder_briefs_distinguish_additive_from_replacement(self):
        # RU inflects/capitalizes ("Аддитивное предусловие"); compare case-insensitively.
        self.assertIn("additive", self.planner_en)
        self.assertIn("аддитив", self.planner_ru.lower())
        self.assertIn("additive", self.coder_en)
        self.assertIn("аддитив", self.coder_ru.lower())

    def test_scenarios_split_b_into_additive_and_replacement(self):
        self.assertIn("B1", self.scenarios)
        self.assertIn("B2", self.scenarios)
        # "Аддитивное" is capitalized in the table/heading; case-insensitive compare.
        self.assertIn("аддитив", self.scenarios.lower())

    # --- F3: gate 2 "closed" single definition ----------------------------

    def test_gate2_closed_means_active_units_and_streams(self):
        self.assertIn("active non-superseded", self.gate2)
        self.assertIn("every DO stream is closed/verified", self.gate2)
        self.assertIn("superseded unit never counts as done", self.gate2)

    def test_gate2_replacement_chain_resolves_to_active_done_covering_criteria(self):
        self.assertIn(
            "replacement chain must resolve to active done units that cover the preserved criteria",
            self.gate2,
        )

    def test_gate2_rejects_missing_mapping_replacement_orphan_circular_self(self):
        for phrase in (
            "missing mapping",
            "missing replacement",
            "orphan",
            "circular",
            "self mapping",
        ):
            self.assertIn(phrase, self.gate2)
        self.assertIn("pending/blocked replacement unit rejects gate 2", self.gate2)

    def test_aggregate_d_completion_derives_single_definition(self):
        self.assertIn("aggregate D: todo closes by this same single definition", self.gate2)

    # --- F6: durable state + defect history -------------------------------

    def test_status_schema_has_mandatory_durable_state_fields(self):
        for field in ("Current cycle N", "Plan revision r", "Attempt n", "Defect history"):
            self.assertIn(field, self.status_file)

    def test_defect_history_fields_are_explicit(self):
        for field in (
            "defect key",
            "observed revisions/attempts",
            "applied fix count",
            "evidence/log pointers",
            "last recurrence",
            "escalation outcome",
        ):
            self.assertIn(field, self.status_file)

    def test_check_failure_fix_loopback_records_kind_and_fix_count(self):
        self.assertIn("defect key and the applied fix count", self.status_file)

    def test_recovery_loads_r_n_units_and_defect_history(self):
        self.assertIn("defect history", self.recovery)
        self.assertIn("revision r", self.recovery)
        self.assertIn("attempt n/3", self.recovery)

    def test_coder_briefs_mandate_durable_state_and_defect_history(self):
        self.assertIn("defect history", self.coder_en)
        self.assertIn("Plan revision r", self.coder_en)
        self.assertIn("историю дефект", self.coder_ru)
        # RU keeps the literal durable-state field name "Plan revision r".
        self.assertIn("Plan revision r", self.coder_ru)

    def test_check_brief_carries_r_n_and_defect_history_as_history_only(self):
        self.assertIn("defect history", self.check_en)
        self.assertIn("revision r", self.check_en)
        self.assertIn("not evidence for the current CHECK", self.check_en)
        self.assertIn("current full aggregated report", self.check_en)
        self.assertIn("историю дефект", self.check_ru)

    def test_scout_brief_can_report_status_snapshot_and_defect_history(self):
        self.assertIn("defect history", self.scout_en)

    # --- narrow discovered completions ------------------------------------

    def test_security_failed_check_counts_as_failed_check_of_revision(self):
        self.assertIn("failed CHECK of the current revision", self.gate3)
        self.assertIn("triggered security failure", self.gate3)

    def test_exhausted_revision_no_fourth_attempt_even_after_escalate(self):
        self.assertIn("no 4th attempt of that revision, even after escalate", self.gate3)

    def test_continue_only_via_genuinely_revised_remediation_plan(self):
        self.assertIn("genuinely revised remediation plan", self.gate3)
        self.assertIn("rename/reword", self.gate3)
        self.assertIn("session reset", self.gate3)
        self.assertIn("cannot manufacture a new revision", self.gate3)

    def test_missing_required_report_is_regathered_not_project_defect(self):
        self.assertIn("missing required report", self.gate3)
        self.assertIn("re-gathered", self.gate3)

    def test_escalation_recommendation_applied_by_coder_when_not_exhausted(self):
        self.assertIn("non-exhausted attempt", self.gate3)
        self.assertIn("applied by coder", self.gate3)

    def test_autonomous_stop_conditional_not_after_every_escalate(self):
        self.assertIn("stop is conditional", self.autonomous)
        self.assertIn("not automatically after every escalate", self.autonomous)

    # --- F5: session/task_id hygiene independence -------------------------

    def test_session_task_id_reset_does_not_reset_r_n_or_defect_history(self):
        # Case-insensitive: the clause starts the sentence with "Resetting task_id".
        self.assertIn("resetting task_id", self.keep_check.lower())
        self.assertIn("never resets the plan revision r", self.keep_check)
        self.assertIn("attempt n", self.keep_check)
        self.assertIn("defect history", self.keep_check)

    def test_unchanged_plan_spans_criteria_design_actions_dependencies(self):
        self.assertIn(
            "acceptance criteria, the design decision, the DO tasks/actions and their dependencies are all unchanged",
            self.keep_check,
        )
        self.assertIn(
            "not merely unchanged criteria/design while the actions changed",
            self.keep_check,
        )

    # --- F2/F7: no dedicated primary plan; build is default alias --------

    def test_no_dedicated_primary_plan_required(self):
        self.assertIn("No dedicated primary plan agent is required", self.skill)
        self.assertIn("still belongs to planner", self.skill)

    def test_build_is_default_shorthand_for_any_primary(self):
        self.assertIn("build is the default shorthand", self.skill)
        self.assertIn("any primary", self.skill)

    # --- artifact: source change (incl label-only) allows delivery --------

    def test_plan_delivery_condition_is_source_change_incl_labels(self):
        self.assertIn("including a label-only change", self.plan)
        self.assertIn("approved spec supersedes the stale structure-only wording", self.plan)

    def test_readme_sync_row_follows_source_change_condition(self):
        self.assertIn("включая правку только меток", self.readme)

    def test_scenarios_have_no_nonexistent_escalation_security_fail_link(self):
        self.assertNotIn("§Escalation (security fail)", self.scenarios)
        self.assertNotIn("§Escalation (security-fail)", self.scenarios)


if __name__ == "__main__":
    unittest.main()
