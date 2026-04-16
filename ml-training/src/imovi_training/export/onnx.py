"""Exportação de modelo LightGBM para ONNX.

Usamos `onnxmltools.convert_lightgbm` pois `skl2onnx` não possui conversor
nativo para LGBMRegressor — é o caminho oficial recomendado pelo projeto ONNX.
"""

from __future__ import annotations

from onnxconverter_common.data_types import FloatTensorType
from onnxmltools import convert_lightgbm


def export_to_onnx(model: object, feature_names: list[str]) -> bytes:
    """Converte o modelo LightGBM para ONNX e retorna bytes serializados.

    A entrada do grafo ONNX é um tensor float32 de shape (None, n_features),
    coerente com o que `onnxruntime` espera no `InferenceSession`.
    """
    n_features = len(feature_names)
    initial_types = [("input", FloatTensorType([None, n_features]))]

    # zipmap=False não se aplica a regressão, mas algumas versões exigem o kwarg.
    onnx_model = convert_lightgbm(
        model,
        initial_types=initial_types,
        target_opset=13,
    )

    return onnx_model.SerializeToString()
