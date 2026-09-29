"""11.1 — severity mapping unit tests (04).

Spec (04.1): High/Critical are ticket-eligible AND pre-selected in bulk
mode; Medium is eligible but NOT pre-selected; Low/Info are not eligible
(creation rejected, button hidden). Run: pytest backend/tests
"""
import pytest

from app.routes.tickets import BULK_PRESELECTED, TICKET_ELIGIBLE


def test_eligible_set_exact():
    assert TICKET_ELIGIBLE == {"critical", "high", "medium"}


def test_preselected_set_exact():
    assert BULK_PRESELECTED == {"critical", "high"}


def test_preselected_is_subset_of_eligible():
    assert BULK_PRESELECTED <= TICKET_ELIGIBLE


def test_low_info_hidden():
    assert "low" not in TICKET_ELIGIBLE
    assert "info" not in TICKET_ELIGIBLE
    assert "low" not in BULK_PRESELECTED
    assert "info" not in BULK_PRESELECTED


def test_medium_eligible_but_not_preselected():
    assert "medium" in TICKET_ELIGIBLE
    assert "medium" not in BULK_PRESELECTED


@pytest.mark.parametrize(
    "severity,bucket",
    [
        ("critical", "eligible-preselected"),
        ("high", "eligible-preselected"),
        ("medium", "eligible"),
        ("low", "hidden"),
        ("info", "hidden"),
    ],
)
def test_every_scanner_severity_has_one_bucket(severity, bucket):
    if bucket == "eligible-preselected":
        assert severity in TICKET_ELIGIBLE and severity in BULK_PRESELECTED
    elif bucket == "eligible":
        assert severity in TICKET_ELIGIBLE and severity not in BULK_PRESELECTED
    else:
        assert severity not in TICKET_ELIGIBLE and severity not in BULK_PRESELECTED
