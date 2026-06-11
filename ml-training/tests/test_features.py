"""Testes para construção de features."""

from __future__ import annotations

import numpy as np
import pandas as pd

from imovi_training.features.builder import build_features
from tests.fixtures.synthetic_data import make_synthetic_df


def test_build_features_shapes_and_types() -> None:
    """Teste 4: retorna (X 2D, y 1D, feature_names list) com len(X) == len(y)."""
    df = make_synthetic_df(n=100, seed=42)

    X, y, feature_names = build_features(df)

    assert isinstance(X, np.ndarray)
    assert isinstance(y, np.ndarray)
    assert isinstance(feature_names, list)
    assert X.ndim == 2
    assert y.ndim == 1
    assert len(X) == len(y) == 100
    assert X.shape[1] == len(feature_names)


def test_build_features_imputes_missing_with_median() -> None:
    """Teste 5: imputa faltantes via mediana; sem NaN no resultado."""
    df = make_synthetic_df(n=100, seed=42)
    df.loc[0:10, "area_m2"] = np.nan
    df.loc[5:15, "bathrooms"] = np.nan

    X, y, _ = build_features(df)

    assert not np.isnan(X).any()
    assert not np.isnan(y).any()


def test_build_features_one_hot_encodes_property_type() -> None:
    """Teste 6: property_type one-hot; feature_names inclui colunas derivadas."""
    df = make_synthetic_df(n=100, seed=42)

    _, _, feature_names = build_features(df)

    derived = [f for f in feature_names if f.startswith("property_type_")]
    assert len(derived) >= 2  # ao menos 2 categorias distintas esperadas


def test_build_features_empty_df() -> None:
    """Teste 7: df vazio → retorna arrays vazios sem erro."""
    df = make_synthetic_df(n=100, seed=42).iloc[0:0]

    X, y, feature_names = build_features(df)

    assert X.shape[0] == 0
    assert y.shape[0] == 0
    assert isinstance(feature_names, list)
    # quando vazio, X pode ter shape (0, k) ou (0,); exigimos 2D
    assert X.ndim == 2
