"""Métricas de avaliação para o AVM."""

from __future__ import annotations

import numpy as np


def _ape(y_true: np.ndarray, y_pred: np.ndarray) -> np.ndarray:
    """Absolute Percentage Error por amostra (não retorna %)."""
    y_true = np.asarray(y_true, dtype=np.float64)
    y_pred = np.asarray(y_pred, dtype=np.float64)
    denom = np.where(y_true == 0, 1.0, np.abs(y_true))
    return np.abs(y_true - y_pred) / denom


def mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Mean Absolute Percentage Error — retorno como fração (0.10 == 10%)."""
    return float(np.mean(_ape(y_true, y_pred)))


def mdape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Median Absolute Percentage Error — fração."""
    return float(np.median(_ape(y_true, y_pred)))


def r2(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Coeficiente de determinação R²."""
    y_true = np.asarray(y_true, dtype=np.float64)
    y_pred = np.asarray(y_pred, dtype=np.float64)
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    if ss_tot == 0:
        return 0.0
    return float(1.0 - ss_res / ss_tot)


def coverage_by_city(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    cities: np.ndarray,
    tolerance: float = 0.20,
) -> dict[str, float]:
    """Fração de predições com APE ≤ tolerance, por cidade.

    Retorna dict {cidade: fração}.
    """
    ape = _ape(y_true, y_pred)
    within = ape <= tolerance
    cities = np.asarray(cities)

    out: dict[str, float] = {}
    for city in np.unique(cities):
        mask = cities == city
        if not mask.any():  # pragma: no cover
            continue
        out[str(city)] = float(np.mean(within[mask]))
    return out
