"""Testes para split temporal."""

from __future__ import annotations

import pandas as pd

from imovi_training.data.split import temporal_split
from tests.fixtures.synthetic_data import make_synthetic_df


def test_temporal_split_test_has_no_records_before_cutoff() -> None:
    """Teste 1: nenhum registro em test tem scraped_at < cutoff."""
    df = make_synthetic_df(n=500, seed=42)
    cutoff = pd.Timestamp("2025-01-01")

    train, test = temporal_split(df, cutoff=cutoff)

    assert (test["scraped_at"] >= cutoff).all()
    assert (train["scraped_at"] < cutoff).all()
    assert len(train) + len(test) == len(df)


def test_temporal_split_cutoff_after_all_timestamps_yields_empty_test() -> None:
    """Teste 2: cutoff depois de todos os timestamps → test vazio, train cheio."""
    df = make_synthetic_df(n=100, seed=42)
    cutoff = pd.Timestamp("2099-01-01")

    train, test = temporal_split(df, cutoff=cutoff)

    assert len(test) == 0
    assert len(train) == len(df)


def test_temporal_split_is_deterministic() -> None:
    """Teste 3: split é determinístico."""
    df = make_synthetic_df(n=200, seed=42)
    cutoff = pd.Timestamp("2025-01-01")

    train1, test1 = temporal_split(df, cutoff=cutoff)
    train2, test2 = temporal_split(df, cutoff=cutoff)

    pd.testing.assert_frame_equal(train1, train2)
    pd.testing.assert_frame_equal(test1, test2)
