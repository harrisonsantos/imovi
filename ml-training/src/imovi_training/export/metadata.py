"""Sidecar JSON de metadata do modelo AVM.

O runtime TypeScript (`@imovi/ml-infer`) valida este sidecar via zod ao
carregar o `.onnx` do R2. Campos obrigatórios no contrato (load.ts):

    modelVersion: string
    featureOrder: string[]          # ordem dos features no tensor input
    imputationMedians: dict         # numéricos → mediana do split de treino
    categories: string[]            # valores canônicos para one-hot

Manter este módulo em sincronia com `packages/ml-infer/src/load.ts`.
"""

from __future__ import annotations

import json
from typing import TypedDict

from imovi_training.features.builder import PROPERTY_TYPE_CATEGORIES


class ModelMetadata(TypedDict):
    modelVersion: str
    featureOrder: list[str]
    imputationMedians: dict[str, float]
    categories: list[str]


def build_metadata(
    model_version: str,
    feature_names: list[str],
    imputation_medians: dict[str, float],
) -> ModelMetadata:
    """Monta o payload sidecar. Validação final é responsabilidade do caller
    (tests garantem shape)."""
    return {
        "modelVersion": model_version,
        "featureOrder": list(feature_names),
        "imputationMedians": dict(imputation_medians),
        "categories": list(PROPERTY_TYPE_CATEGORIES),
    }


def dump_metadata_json(metadata: ModelMetadata) -> str:
    """Serializa com chaves estáveis e sem ASCII escaping — facilita diff."""
    return json.dumps(metadata, ensure_ascii=False, indent=2, sort_keys=True)
