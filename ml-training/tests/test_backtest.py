"""Testes para backtest temporal rolante."""

from __future__ import annotations

import numpy as np
import pandas as pd

from imovi_training.eval.backtest import (
    BacktestWindow,
    generate_monthly_cutoffs,
    run_backtest,
    summarize,
)
from tests.fixtures.synthetic_data import make_synthetic_df


def test_generate_monthly_cutoffs_returns_first_of_each_month() -> None:
    cutoffs = generate_monthly_cutoffs("2025-01-15", "2025-03-10")
    # Normaliza para dia 1 do mês inicial, vai até dia 1 do mês final (inclusive).
    assert cutoffs == [
        pd.Timestamp("2025-01-01"),
        pd.Timestamp("2025-02-01"),
        pd.Timestamp("2025-03-01"),
    ]


def test_generate_monthly_cutoffs_empty_when_end_before_start() -> None:
    assert generate_monthly_cutoffs("2025-03-01", "2025-01-01") == []


def _constant_train_fn(_X: np.ndarray, y: np.ndarray) -> float:
    """Modelo fake: prevê a média de y."""
    return float(np.mean(y))


def _constant_predict_fn(model: float, X: np.ndarray) -> np.ndarray:
    return np.full(len(X), model, dtype=np.float64)


def test_run_backtest_produces_one_window_per_cutoff_with_valid_counts() -> None:
    df = make_synthetic_df(n=1000, seed=7)
    cutoffs = [pd.Timestamp("2025-01-01"), pd.Timestamp("2025-06-01")]

    windows = run_backtest(
        df,
        cutoffs,
        window_months=1,
        min_train=50,
        min_test=5,
        train_fn=_constant_train_fn,
        predict_fn=_constant_predict_fn,
    )

    assert len(windows) == 2
    for w, c in zip(windows, cutoffs, strict=True):
        assert w.cutoff == c
        assert w.window_end == c + pd.DateOffset(months=1)
        assert w.n_train > 0
        assert w.n_test > 0
        # Métricas preenchidas porque temos dados o suficiente.
        assert w.mape is not None


def test_run_backtest_marks_insufficient_windows_as_none() -> None:
    df = make_synthetic_df(n=100, seed=1)
    # Cutoff além do range do dataset → test vazio, métricas None.
    cutoffs = [pd.Timestamp("2099-01-01")]

    windows = run_backtest(
        df,
        cutoffs,
        window_months=1,
        min_train=10,
        min_test=10,
        train_fn=_constant_train_fn,
        predict_fn=_constant_predict_fn,
    )
    assert len(windows) == 1
    assert windows[0].mape is None
    assert windows[0].n_test == 0


def test_summarize_aggregates_valid_windows_only() -> None:
    windows = [
        BacktestWindow(
            cutoff=pd.Timestamp("2025-01-01"),
            window_end=pd.Timestamp("2025-02-01"),
            n_train=100,
            n_test=50,
            mape=0.10,
            mdape=0.08,
            r2=0.7,
        ),
        BacktestWindow(
            cutoff=pd.Timestamp("2025-02-01"),
            window_end=pd.Timestamp("2025-03-01"),
            n_train=200,
            n_test=5,
            mape=None,
            mdape=None,
            r2=None,
        ),
        BacktestWindow(
            cutoff=pd.Timestamp("2025-03-01"),
            window_end=pd.Timestamp("2025-04-01"),
            n_train=200,
            n_test=60,
            mape=0.20,
            mdape=0.16,
            r2=0.5,
        ),
    ]
    s = summarize(windows)
    assert s["n_windows"] == 3
    assert s["n_valid"] == 2
    assert abs(s["mape_mean"] - 0.15) < 1e-9
    assert abs(s["r2_mean"] - 0.6) < 1e-9


def test_summarize_empty_returns_zero_counts() -> None:
    s = summarize([])
    assert s == {"n_windows": 0, "n_valid": 0}
