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
