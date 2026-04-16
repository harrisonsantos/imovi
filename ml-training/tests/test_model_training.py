"""Testes para treino do LightGBM."""

from __future__ import annotations

import numpy as np

from imovi_training.features.builder import build_features
from imovi_training.models.lightgbm_model import train_lgbm
from tests.fixtures.synthetic_data import make_synthetic_df


def test_train_lgbm_returns_model_with_predict() -> None:
    """Teste 8: treinamento retorna modelo com método .predict."""
    df = make_synthetic_df(n=200, seed=42)
    X, y, _ = build_features(df)

    model = train_lgbm(X, y, params={"n_estimators": 10, "learning_rate": 0.1})

    assert hasattr(model, "predict")
    preds = model.predict(X)
    assert len(preds) == len(y)


def test_train_lgbm_is_reproducible_with_fixed_seed() -> None:
    """Teste 9: seed fixa → predição reproduzível."""
    df = make_synthetic_df(n=200, seed=42)
    X, y, _ = build_features(df)

    params = {"n_estimators": 20, "learning_rate": 0.1, "random_state": 42}
    m1 = train_lgbm(X, y, params=params)
    m2 = train_lgbm(X, y, params=params)

    p1 = m1.predict(X)
    p2 = m2.predict(X)
    np.testing.assert_allclose(p1, p2, rtol=0, atol=0)
