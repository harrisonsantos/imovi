"""Treinamento do modelo LightGBM."""

from __future__ import annotations

from typing import Any

import numpy as np
from lightgbm import LGBMRegressor

DEFAULT_PARAMS: dict[str, Any] = {
    "n_estimators": 200,
    "learning_rate": 0.05,
    "num_leaves": 31,
    "min_child_samples": 20,
    "random_state": 42,
    "n_jobs": -1,
    "verbose": -1,
}


def train_lgbm(
    X_train: np.ndarray,
    y_train: np.ndarray,
    params: dict[str, Any] | None = None,
) -> LGBMRegressor:
    """Treina um LightGBM regressor.

    Se `params` for passado, faz merge sobre os defaults (params têm precedência).
    """
    merged = dict(DEFAULT_PARAMS)
    if params:
        merged.update(params)

    model = LGBMRegressor(**merged)
    model.fit(X_train, y_train)
    return model


def train_lgbm_quantile(
    X_train: np.ndarray,
    y_train: np.ndarray,
    alpha: float,
    params: dict[str, Any] | None = None,
) -> LGBMRegressor:
    """Treina um LightGBM com objective='quantile' para o quantil `alpha`.

    Usado para intervalos calibrados: p10 (alpha=0.1), p50 (0.5), p90 (0.9).
    """
    if not 0.0 < alpha < 1.0:
        raise ValueError(f"alpha deve estar em (0, 1); recebido: {alpha}")
    merged = dict(DEFAULT_PARAMS)
    if params:
        merged.update(params)
    merged["objective"] = "quantile"
    merged["alpha"] = alpha

    model = LGBMRegressor(**merged)
    model.fit(X_train, y_train)
    return model
