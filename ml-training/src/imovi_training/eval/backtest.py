"""Backtest temporal com janelas rolantes.

Ideia:
  Dado um dataset com coluna `scraped_at`, definimos uma sequência de cutoffs
  (tipicamente mensais). Para cada cutoff C:
    - train = registros com scraped_at < C
    - test  = registros com scraped_at em [C, C + window)
  Treinamos um modelo em `train`, avaliamos em `test`, e coletamos métricas.

Saída: list[dict] com uma entrada por janela, contendo
  {cutoff, n_train, n_test, mape, mdape, r2}.

Isso aproxima avaliação "à frente" (out-of-time), muito mais realista que
split único para AVM — que sofre de drift de mercado.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from imovi_training.data.split import temporal_split
from imovi_training.eval.metrics import mape, mdape, r2
from imovi_training.features.builder import build_features
from imovi_training.features.location import (
    apply_neighborhood_medians,
    compute_neighborhood_medians,
)


@dataclass(frozen=True)
class BacktestWindow:
    """Resultado de uma janela de backtest."""

    cutoff: pd.Timestamp
    window_end: pd.Timestamp
    n_train: int
    n_test: int
    mape: float | None
    mdape: float | None
    r2: float | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "cutoff": str(self.cutoff.date()),
            "window_end": str(self.window_end.date()),
            "n_train": self.n_train,
            "n_test": self.n_test,
            "mape": self.mape,
            "mdape": self.mdape,
            "r2": self.r2,
        }


def generate_monthly_cutoffs(
    start: str | pd.Timestamp,
    end: str | pd.Timestamp,
) -> list[pd.Timestamp]:
    """Gera cutoffs no primeiro dia de cada mês em [start, end]."""
    start_ts = pd.Timestamp(start).normalize().replace(day=1)
    end_ts = pd.Timestamp(end).normalize().replace(day=1)
    if end_ts < start_ts:
        return []
    return list(pd.date_range(start=start_ts, end=end_ts, freq="MS"))


TrainFn = Callable[[np.ndarray, np.ndarray], Any]
PredictFn = Callable[[Any, np.ndarray], np.ndarray]


def _default_train(X: np.ndarray, y: np.ndarray) -> Any:
    # Import local para evitar puxar lightgbm quando o caller injeta um train_fn próprio.
    from imovi_training.models.lightgbm_model import train_lgbm

    return train_lgbm(X, y)


def _default_predict(model: Any, X: np.ndarray) -> np.ndarray:
    return np.asarray(model.predict(X))


def run_backtest(
    df: pd.DataFrame,
    cutoffs: Iterable[pd.Timestamp],
    *,
    window_months: int = 1,
    min_train: int = 100,
    min_test: int = 20,
    train_fn: TrainFn | None = None,
    predict_fn: PredictFn | None = None,
) -> list[BacktestWindow]:
    """Executa backtest rolante.

    - `window_months`: largura da janela de teste após cada cutoff.
    - `min_train`/`min_test`: descarta janelas com poucos exemplos
      (métricas ficam ruidosas e enganam a leitura do resultado).
    - `train_fn`/`predict_fn`: injetáveis para testes (evita treinar LGBM real).
    """
    tf = train_fn or _default_train
    pf = predict_fn or _default_predict

    results: list[BacktestWindow] = []
    for cutoff in cutoffs:
        window_end = cutoff + pd.DateOffset(months=window_months)
        train_df, rest = temporal_split(df, cutoff=cutoff)
        # `rest` contém scraped_at >= cutoff; filtra o upper bound da janela.
        ts = pd.to_datetime(rest["scraped_at"])
        test_df = rest.loc[ts < window_end].reset_index(drop=True)

        n_train = len(train_df)
        n_test = len(test_df)

        if n_train < min_train or n_test < min_test:
            results.append(
                BacktestWindow(
                    cutoff=cutoff,
                    window_end=window_end,
                    n_train=n_train,
                    n_test=n_test,
                    mape=None,
                    mdape=None,
                    r2=None,
                )
            )
            continue

        # Feature de localização por janela — medianas SÓ do treino da janela.
        medians, global_median = compute_neighborhood_medians(train_df)
        train_df = apply_neighborhood_medians(train_df, medians, global_median)
        test_df = apply_neighborhood_medians(test_df, medians, global_median)

        X_train, y_train, _ = build_features(train_df)
        X_test, y_test, _ = build_features(test_df)
        model = tf(X_train, y_train)
        preds = pf(model, X_test)

        results.append(
            BacktestWindow(
                cutoff=cutoff,
                window_end=window_end,
                n_train=n_train,
                n_test=n_test,
                mape=mape(y_test, preds),
                mdape=mdape(y_test, preds),
                r2=r2(y_test, preds),
            )
        )
    return results


def summarize(windows: list[BacktestWindow]) -> dict[str, Any]:
    """Agrega métricas sobre janelas válidas (onde mape is not None)."""
    valid = [w for w in windows if w.mape is not None]
    if not valid:
        return {"n_windows": 0, "n_valid": 0}
    mapes = np.array([w.mape for w in valid], dtype=np.float64)
    mdapes = np.array([w.mdape for w in valid], dtype=np.float64)
    r2s = np.array([w.r2 for w in valid], dtype=np.float64)
    return {
        "n_windows": len(windows),
        "n_valid": len(valid),
        "mape_mean": float(np.mean(mapes)),
        "mape_p50": float(np.median(mapes)),
        "mape_p90": float(np.quantile(mapes, 0.90)),
        "mdape_mean": float(np.mean(mdapes)),
        "r2_mean": float(np.mean(r2s)),
    }
