"""Construção de features para o modelo AVM."""

from __future__ import annotations

import numpy as np
import pandas as pd

NUMERIC_COLS: list[str] = ["area_m2", "bedrooms", "bathrooms", "parking"]
CATEGORICAL_COLS: list[str] = ["property_type"]
TARGET_COL = "price"

# Categorias canônicas para garantir colunas one-hot estáveis (inclusive com df vazio).
PROPERTY_TYPE_CATEGORIES: list[str] = ["apartamento", "casa", "cobertura", "studio"]


def compute_imputation_medians(df: pd.DataFrame) -> dict[str, float]:
    """Calcula medianas dos numéricos para usar como imputação no serving.

    Deve ser chamado **apenas sobre o split de treino** — evita leak do teste.
    O dict resultante é serializado no sidecar JSON do modelo para que o
    runtime TypeScript use exatamente os mesmos valores em inferência.
    """
    medians: dict[str, float] = {}
    for col in NUMERIC_COLS:
        if col not in df.columns or len(df) == 0:
            medians[col] = 0.0
            continue
        val = pd.to_numeric(df[col], errors="coerce").median()
        medians[col] = 0.0 if pd.isna(val) else float(val)
    return medians


def _one_hot_feature_names() -> list[str]:
    return [f"property_type={c}" for c in PROPERTY_TYPE_CATEGORIES]


def _feature_names() -> list[str]:
    return list(NUMERIC_COLS) + _one_hot_feature_names()


def build_features(
    df: pd.DataFrame,
    *,
    impute: str = "median",
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Constrói (X, y, feature_names) a partir do DataFrame bruto.

    - Imputação de numéricos via mediana (configurável).
    - One-hot para `property_type` com categorias canônicas (estável).
    - Ignora colunas textuais de alta-cardinalidade (city/neighborhood) neste MVP —
      elas entrarão via feature engineering dedicada numa etapa posterior.
    """
    feature_names = _feature_names()

    # Caso vazio: devolve arrays 2D/1D vazios com shape coerente.
    if len(df) == 0:
        X = np.zeros((0, len(feature_names)), dtype=np.float64)
        y = np.zeros((0,), dtype=np.float64)
        return X, y, feature_names

    work = df.copy()

    # Imputação dos numéricos.
    for col in NUMERIC_COLS:
        if col not in work.columns:
            work[col] = np.nan
        if impute == "median":
            median = pd.to_numeric(work[col], errors="coerce").median()
            # Se todos os valores forem NaN, usa 0.0 como fallback.
            if pd.isna(median):
                median = 0.0
            work[col] = pd.to_numeric(work[col], errors="coerce").fillna(median)
        else:  # pragma: no cover - estratégias futuras
            raise ValueError(f"Estratégia de imputação não suportada: {impute}")

    # One-hot estável.
    pt = work.get("property_type", pd.Series([""] * len(work)))
    one_hot_arrays: list[np.ndarray] = []
    for cat in PROPERTY_TYPE_CATEGORIES:
        one_hot_arrays.append((pt == cat).astype(np.float64).to_numpy())

    numeric_block = work[NUMERIC_COLS].to_numpy(dtype=np.float64)
    cat_block = np.column_stack(one_hot_arrays) if one_hot_arrays else np.zeros(
        (len(work), 0), dtype=np.float64
    )

    X = np.hstack([numeric_block, cat_block])

    if TARGET_COL in work.columns:
        y = pd.to_numeric(work[TARGET_COL], errors="coerce").to_numpy(dtype=np.float64)
        # Imputa target faltante pela mediana (robustez em testes).
        if np.isnan(y).any():
            median_y = np.nanmedian(y)
            if np.isnan(median_y):
                median_y = 0.0
            y = np.where(np.isnan(y), median_y, y)
    else:
        y = np.zeros((len(work),), dtype=np.float64)

    return X, y, feature_names
