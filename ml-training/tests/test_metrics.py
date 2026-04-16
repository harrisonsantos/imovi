"""Testes para métricas de avaliação."""

from __future__ import annotations

import numpy as np

from imovi_training.eval.metrics import coverage_by_city, mape, mdape


def test_mape_known_case() -> None:
    """Teste 12: MAPE correto em caso simples."""
    y_true = np.array([100.0, 200.0, 300.0])
    y_pred = np.array([110.0, 180.0, 330.0])
    # APEs: 10/100=0.10 ; 20/200=0.10 ; 30/300=0.10 → mean = 0.10
    result = mape(y_true, y_pred)
    assert abs(result - 0.10) < 1e-9


def test_mdape_known_case() -> None:
    """Teste 13: MdAPE é a mediana dos APEs."""
    y_true = np.array([100.0, 100.0, 100.0, 100.0, 100.0])
    y_pred = np.array([105.0, 110.0, 120.0, 150.0, 200.0])
    # APEs: 0.05, 0.10, 0.20, 0.50, 1.00 → mediana = 0.20
    result = mdape(y_true, y_pred)
    assert abs(result - 0.20) < 1e-9


def test_coverage_by_city_fraction_within_tolerance() -> None:
    """Teste 14: coverage_by_city retorna fração dentro de ±20% por cidade."""
    y_true = np.array([100.0, 100.0, 100.0, 100.0])
    y_pred = np.array([110.0, 130.0, 115.0, 95.0])  # erros: 10%, 30%, 15%, 5%
    cities = np.array(["SP", "SP", "RJ", "RJ"])

    out = coverage_by_city(y_true, y_pred, cities, tolerance=0.20)

    assert isinstance(out, dict)
    # SP: 110 ok, 130 não → 1/2 = 0.5
    # RJ: 115 ok, 95 ok → 2/2 = 1.0
    assert abs(out["SP"] - 0.5) < 1e-9
    assert abs(out["RJ"] - 1.0) < 1e-9
