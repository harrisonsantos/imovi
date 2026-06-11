"""Testes do treino quantile (intervalos calibrados)."""

from __future__ import annotations

import numpy as np
import pytest

from imovi_training.features.builder import build_features
from imovi_training.models.lightgbm_model import train_lgbm_quantile
from tests.fixtures.synthetic_data import make_synthetic_df


def test_alpha_invalido_levanta() -> None:
    X = np.zeros((10, 3))
    y = np.zeros(10)
    with pytest.raises(ValueError):
        train_lgbm_quantile(X, y, alpha=0.0)
    with pytest.raises(ValueError):
        train_lgbm_quantile(X, y, alpha=1.5)


def test_quantis_ordenados_e_cobertura_razoavel() -> None:
    df = make_synthetic_df(n=2000, seed=7)
    X, y, _ = build_features(df)

    m10 = train_lgbm_quantile(X, y, alpha=0.1)
    m50 = train_lgbm_quantile(X, y, alpha=0.5)
    m90 = train_lgbm_quantile(X, y, alpha=0.9)

    p10 = m10.predict(X)
    p50 = m50.predict(X)
    p90 = m90.predict(X)

    # p10 <= p90 em quase todas as amostras (quantile crossing raro é tolerado)
    assert float(np.mean(p10 <= p90)) > 0.95
    # p50 fica entre os extremos na maioria
    assert float(np.mean((p10 <= p50) & (p50 <= p90))) > 0.90
    # Cobertura empírica do intervalo [p10, p90] ~ 80% (in-sample, tolerância larga)
    coverage = float(np.mean((y >= p10) & (y <= p90)))
    assert 0.6 < coverage <= 1.0
