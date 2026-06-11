"""Testes da feature de localização: mediana de preço/m² por bairro."""

from __future__ import annotations

import pandas as pd

from imovi_training.features.location import (
    apply_neighborhood_medians,
    compute_neighborhood_medians,
)


def _df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "neighborhood": ["Batel", "Batel", "Centro", "Centro", "Centro"],
            "price": [1_000_000, 1_200_000, 400_000, 500_000, 600_000],
            "area_m2": [100.0, 100.0, 80.0, 100.0, 100.0],
        }
    )


def test_compute_neighborhood_medians_por_bairro() -> None:
    medians, global_median = compute_neighborhood_medians(_df())
    # Batel: 10000, 12000 → mediana 11000
    assert medians["Batel"] == 11000.0
    # Centro: 5000, 5000, 6000 → mediana 5000
    assert medians["Centro"] == 5000.0
    # Global: mediana de [10000, 12000, 5000, 5000, 6000] = 6000
    assert global_median == 6000.0


def test_compute_ignora_rows_sem_price_ou_area() -> None:
    df = _df()
    df.loc[0, "price"] = None
    df.loc[2, "area_m2"] = 0.0
    medians, _ = compute_neighborhood_medians(df)
    assert medians["Batel"] == 12000.0  # só a row 1 sobrou
    assert medians["Centro"] == 5500.0  # rows 3,4: 5000, 6000


def test_apply_mapeia_e_usa_global_para_desconhecido() -> None:
    medians = {"Batel": 11000.0}
    df = pd.DataFrame({"neighborhood": ["Batel", "BairroNovo", None]})
    out = apply_neighborhood_medians(df, medians, global_median=6000.0)
    col = out["neighborhood_median_price_m2"].tolist()
    assert col == [11000.0, 6000.0, 6000.0]
    # não muta o original
    assert "neighborhood_median_price_m2" not in df.columns


def test_df_vazio() -> None:
    empty = pd.DataFrame({"neighborhood": [], "price": [], "area_m2": []})
    medians, global_median = compute_neighborhood_medians(empty)
    assert medians == {}
    assert global_median == 0.0
