"""Testes para exportação ONNX."""

from __future__ import annotations

import numpy as np
import onnxruntime as ort

from imovi_training.export.onnx import export_to_onnx
from imovi_training.features.builder import build_features
from imovi_training.models.lightgbm_model import train_lgbm
from tests.fixtures.synthetic_data import make_synthetic_df


def test_export_to_onnx_returns_non_empty_bytes() -> None:
    """Teste 10: export retorna bytes não-vazio."""
    df = make_synthetic_df(n=200, seed=42)
    X, y, feature_names = build_features(df)
    model = train_lgbm(X, y, params={"n_estimators": 10, "random_state": 42})

    payload = export_to_onnx(model, feature_names)

    assert isinstance(payload, bytes)
    assert len(payload) > 0


def test_onnx_prediction_matches_native_within_tolerance() -> None:
    """Teste 11: predição ONNX ≈ predição LightGBM nativa (tol 1e-4 em float32)."""
    df = make_synthetic_df(n=200, seed=42)
    X, y, feature_names = build_features(df)
    model = train_lgbm(X, y, params={"n_estimators": 20, "random_state": 42})

    payload = export_to_onnx(model, feature_names)

    native = model.predict(X)

    sess = ort.InferenceSession(payload, providers=["CPUExecutionProvider"])
    input_name = sess.get_inputs()[0].name
    onnx_out = sess.run(None, {input_name: X.astype(np.float32)})[0].ravel()

    diff = np.abs(native - onnx_out)
    # tolerância absoluta em termos relativos ao alvo (preços R$);
    # 1e-4 em float32 refere-se à saída escalada — aqui aceitamos 1e-4 relativa.
    assert np.max(diff / np.maximum(np.abs(native), 1.0)) <= 1e-4
