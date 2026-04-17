"""Testes para o sidecar de metadata do modelo."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd

from imovi_training.export.metadata import build_metadata, dump_metadata_json
from imovi_training.features.builder import (
    NUMERIC_COLS,
    PROPERTY_TYPE_CATEGORIES,
    compute_imputation_medians,
)
from tests.fixtures.synthetic_data import make_synthetic_df


def test_compute_imputation_medians_all_numeric_cols_present() -> None:
    df = make_synthetic_df(n=200, seed=42)
    medians = compute_imputation_medians(df)
    for col in NUMERIC_COLS:
        assert col in medians
        assert isinstance(medians[col], float)


def test_compute_imputation_medians_handles_missing_column() -> None:
    df = pd.DataFrame({"price": [100.0, 200.0]})  # nenhum numérico presente
    medians = compute_imputation_medians(df)
    for col in NUMERIC_COLS:
        assert medians[col] == 0.0


def test_compute_imputation_medians_robust_to_nan() -> None:
    df = pd.DataFrame(
        {
            "area_m2": [50.0, np.nan, 80.0, 120.0, np.nan],
            "bedrooms": [1, 2, 3, 4, 5],
            "bathrooms": [1, 1, 2, 2, 3],
            "parking": [0, 1, 1, 2, 2],
        }
    )
    medians = compute_imputation_medians(df)
    # mediana ignorando NaN de [50, 80, 120] = 80
    assert medians["area_m2"] == 80.0
    assert medians["bedrooms"] == 3.0


def test_build_metadata_shape_matches_ts_contract() -> None:
    feature_names = ["area_m2", "bedrooms", "property_type=apartamento"]
    medians = {"area_m2": 75.0, "bedrooms": 2.0, "bathrooms": 1.0, "parking": 1.0}
    meta = build_metadata("v1-2026-04-17", feature_names, medians)

    # Chaves exigidas pelo zod schema em packages/ml-infer/src/load.ts
    assert set(meta.keys()) == {
        "modelVersion",
        "featureOrder",
        "imputationMedians",
        "categories",
    }
    assert meta["modelVersion"] == "v1-2026-04-17"
    assert meta["featureOrder"] == feature_names
    assert meta["imputationMedians"] == medians
    assert meta["categories"] == PROPERTY_TYPE_CATEGORIES


def test_dump_metadata_json_round_trip() -> None:
    meta = build_metadata("v1", ["area_m2"], {"area_m2": 100.0})
    dumped = dump_metadata_json(meta)
    restored = json.loads(dumped)
    assert restored == meta
