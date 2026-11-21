from datetime import date

import pytest

from backend.app import rules
from backend.app.rules import FunnelDeal

TODAY = date(2026, 11, 21)


@pytest.mark.parametrize(
    ("stage", "probability"),
    [("new", 10), ("qualified", 25), ("proposal", 50), ("negotiation", 75), ("won", 100), ("lost", 0)],
)
def test_each_stage_has_its_usual_probability(stage, probability):
    assert rules.DEFAULT_PROBABILITY[stage] == probability


def test_open_stages():
    assert [s for s in rules.STAGES if rules.is_open(s)] == ["new", "qualified", "proposal", "negotiation"]


@pytest.mark.parametrize(
    ("close_date", "late"),
    [("2026-11-20", True), ("2026-11-21", False), ("2026-11-22", False)],
)
def test_an_open_deal_is_late_only_after_its_close_date(close_date, late):
    for stage in rules.OPEN_STAGES:
        assert rules.is_late(stage, close_date, TODAY) is late


@pytest.mark.parametrize("stage", ["won", "lost"])
def test_won_and_lost_are_never_late(stage):
    assert rules.is_late(stage, "2020-01-01", TODAY) is False


def test_expected_revenue_is_value_times_probability():
    assert rules.expected_cents(4_000_000, 25) == 1_000_000
    assert rules.expected_cents(850_000, 75) == 637_500
    assert rules.expected_cents(1_000_000, 0) == 0


class TestStageChange:
    def test_resets_probability_to_the_new_stage(self):
        assert rules.stage_change("new", "proposal", TODAY) == {"stage": "proposal", "probability": 50}

    def test_keeps_a_probability_given_with_the_change(self):
        assert rules.stage_change("new", "proposal", TODAY, probability=40)["probability"] == 40

    @pytest.mark.parametrize("stage", ["won", "lost"])
    def test_won_or_lost_sets_the_close_date_to_today(self, stage):
        updates = rules.stage_change("negotiation", stage, TODAY)
        assert updates["close_date"] == "2026-11-21"
        assert updates["probability"] == rules.DEFAULT_PROBABILITY[stage]

    def test_won_keeps_a_close_date_given_with_the_change(self):
        updates = rules.stage_change("negotiation", "won", TODAY, close_date="2026-11-18")
        assert updates["close_date"] == "2026-11-18"

    def test_leaving_won_keeps_the_close_date(self):
        updates = rules.stage_change("won", "negotiation", TODAY)
        assert "close_date" not in updates
        assert updates["probability"] == 75

    def test_moving_between_open_stages_leaves_the_close_date(self):
        assert "close_date" not in rules.stage_change("new", "qualified", TODAY)

    def test_same_stage_changes_nothing(self):
        assert rules.stage_change("proposal", "proposal", TODAY, probability=10) == {}


class TestReorder:
    columns = {"new": [1, 2, 3], "qualified": [4, 5]}

    def test_to_the_top_within_a_column(self):
        assert rules.reorder(self.columns, 3, "new", 0)["new"] == [3, 1, 2]

    def test_to_the_middle_within_a_column(self):
        assert rules.reorder(self.columns, 1, "new", 1)["new"] == [2, 1, 3]

    def test_to_the_end_within_a_column(self):
        assert rules.reorder(self.columns, 1, "new", 2)["new"] == [2, 3, 1]

    def test_between_columns_to_the_top(self):
        result = rules.reorder(self.columns, 2, "qualified", 0)
        assert result == {"new": [1, 3], "qualified": [2, 4, 5]}

    def test_between_columns_to_the_middle(self):
        assert rules.reorder(self.columns, 2, "qualified", 1)["qualified"] == [4, 2, 5]

    def test_between_columns_to_the_end(self):
        assert rules.reorder(self.columns, 2, "qualified", 2)["qualified"] == [4, 5, 2]

    def test_an_index_past_the_end_goes_last(self):
        assert rules.reorder(self.columns, 2, "qualified", 99)["qualified"] == [4, 5, 2]

    def test_into_an_empty_column(self):
        assert rules.reorder(self.columns, 4, "won", 0)["won"] == [4]

    def test_does_not_change_the_input(self):
        rules.reorder(self.columns, 1, "qualified", 0)
        assert self.columns == {"new": [1, 2, 3], "qualified": [4, 5]}


class TestFunnel:
    @staticmethod
    def by_stage(rows):
        return {r["stage"]: (r["value_cents"], r["count"]) for r in rows}

    def test_open_deals_count_up_to_their_stage(self):
        rows = self.by_stage(rules.funnel([FunnelDeal("proposal", 100)]))
        assert rows == {
            "new": (100, 1),
            "qualified": (100, 1),
            "proposal": (100, 1),
            "negotiation": (0, 0),
            "won": (0, 0),
        }

    def test_an_open_deal_that_went_back_counts_up_to_its_furthest_stage(self):
        deal = FunnelDeal("qualified", 100, [("new", "negotiation"), ("negotiation", "qualified")])
        rows = self.by_stage(rules.funnel([deal]))
        assert rows["negotiation"] == (100, 1)
        assert rows["won"] == (0, 0)

    def test_won_counts_at_every_stage(self):
        rows = self.by_stage(rules.funnel([FunnelDeal("won", 300, [("new", "won")])]))
        assert all(value == (300, 1) for value in rows.values())

    def test_lost_counts_up_to_the_furthest_stage_reached(self):
        deal = FunnelDeal("lost", 200, [("new", "qualified"), ("qualified", "proposal"), ("proposal", "lost")])
        rows = self.by_stage(rules.funnel([deal]))
        assert rows == {
            "new": (200, 1),
            "qualified": (200, 1),
            "proposal": (200, 1),
            "negotiation": (0, 0),
            "won": (0, 0),
        }

    def test_lost_with_no_history_counts_at_new_only(self):
        rows = self.by_stage(rules.funnel([FunnelDeal("lost", 50)]))
        assert rows["new"] == (50, 1)
        assert rows["qualified"] == (0, 0)

    def test_percent_of_new(self):
        rows = rules.funnel([FunnelDeal("new", 300), FunnelDeal("won", 100)])
        assert [r["percent_of_new"] for r in rows] == [100, 25, 25, 25, 25]

    def test_empty(self):
        rows = rules.funnel([])
        assert [r["value_cents"] for r in rows] == [0, 0, 0, 0, 0]
        assert [r["percent_of_new"] for r in rows] == [0, 0, 0, 0, 0]


@pytest.mark.parametrize(
    ("follow_up", "done", "state"),
    [
        (None, False, None),
        ("2026-11-20", False, "overdue"),
        ("2026-11-21", False, "coming_up"),
        ("2026-11-28", False, "coming_up"),
        ("2026-11-29", False, "later"),
        ("2026-11-20", True, "done"),
    ],
)
def test_follow_up_state(follow_up, done, state):
    assert rules.follow_up_state(follow_up, done, TODAY) == state
