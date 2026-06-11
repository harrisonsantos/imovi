"""Feature de localização: mediana de preço/m² por bairro.

Anti-leakage: `compute_neighborhood_medians` deve ser chamado APENAS sobre o
split de treino. O serving (TS) usa neighborhoods.median_price_m2 do banco —
valor equivalente, recalculado pelo agregador.
"""

from __future__ import annotations

import pandas as pd

FEATURE_NAME = "neighborhood_median_price_m2"


def compute_neighborhood_medians(
    train_df: pd.DataFrame,
) -> tuple[dict[str, float], float]:
    """Retorna ({bairro: mediana R$/m²}, mediana global).

    Ignora rows sem price ou com area_m2 inválida (<= 0 ou NaN).
    """
    if len(train_df) == 0:
        return {}, 0.0

    price = pd.to_numeric(train_df["price"], errors="coerce")
    area = pd.to_numeric(train_df["area_m2"], errors="coerce")
    valid = price.notna() & area.notna() & (area > 0)
    if not valid.any():
        return {}, 0.0

    ppm2 = (price[valid] / area[valid]).astype(float)
    neighborhood = train_df.loc[valid, "neighborhood"]

    global_median = float(ppm2.median())
    by_neighborhood = ppm2.groupby(neighborhood).median()
    medians = {str(k): float(v) for k, v in by_neighborhood.items()}
    return medians, global_median


def apply_neighborhood_medians(
    df: pd.DataFrame,
    medians: dict[str, float],
    global_median: float,
) -> pd.DataFrame:
    """Adiciona a coluna FEATURE_NAME mapeando o bairro; fallback global."""
    out = df.copy()
    out[FEATURE_NAME] = (
        out["neighborhood"].map(medians).fillna(global_median).astype(float)
    )
    return out
