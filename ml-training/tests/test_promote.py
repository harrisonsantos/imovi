"""Testes do gate de promoção."""

from __future__ import annotations

import pytest

from imovi_training.promote import gate_passes


def test_promove_sem_modelo_ativo() -> None:
    assert gate_passes(0.30, None) is True


def test_promove_quando_melhora() -> None:
    assert gate_passes(0.20, 0.25) is True


def test_promove_dentro_da_tolerancia() -> None:
    assert gate_passes(0.255, 0.25, tolerance=0.01) is True


def test_reprova_quando_regride_alem_da_tolerancia() -> None:
    assert gate_passes(0.30, 0.25, tolerance=0.01) is False


@pytest.mark.parametrize("invalid", [float("nan"), float("inf"), -1.0])
def test_invalid_mdape_never_promotes_even_without_active(invalid: float) -> None:
    assert gate_passes(invalid, None) is False
    assert gate_passes(0.2, invalid) is False
