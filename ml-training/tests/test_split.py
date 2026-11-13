"""Testes para split temporal."""

from __future__ import annotations

import pandas as pd
import pytest

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


def test_temporal_split_handles_tz_aware_scraped_at() -> None:
    """scraped_at tz-aware (UTC, como vem do Neon) + cutoff naive não explode."""
    df = make_synthetic_df(n=100, seed=42)
    df["scraped_at"] = pd.to_datetime(df["scraped_at"]).dt.tz_localize("UTC")
    cutoff = pd.Timestamp("2025-01-01")  # naive

    train, test = temporal_split(df, cutoff=cutoff)

    assert len(train) + len(test) == len(df)
    assert len(train) > 0
    assert len(test) > 0


def test_temporal_split_is_deterministic() -> None:
    """Teste 3: split é determinístico."""
    df = make_synthetic_df(n=200, seed=42)
    cutoff = pd.Timestamp("2025-01-01")

    train1, test1 = temporal_split(df, cutoff=cutoff)
    train2, test2 = temporal_split(df, cutoff=cutoff)

    pd.testing.assert_frame_equal(train1, train2)
    pd.testing.assert_frame_equal(test1, test2)


def test_temporal_split_purges_repeat_property_and_fingerprint() -> None:
    df = pd.DataFrame({
        "property_id": ["repeated", "independent", "repeated", "other_id"],
        "fingerprint": ["same", "different", "same", "different"],
        "scraped_at": ["2024-01-01", "2024-01-01", "2025-01-01", "2025-01-01"],
    })
    train, test = temporal_split(df, "2025-01-01")
    assert train.empty
    assert len(test) == 2
    assert set(train["property_id"]).isdisjoint(test["property_id"])
    assert set(train["fingerprint"]).isdisjoint(test["fingerprint"])


def test_temporal_split_rejects_unidentified_real_data() -> None:
    with pytest.raises(ValueError, match="identity"):
        temporal_split(pd.DataFrame({"scraped_at": ["2024-01-01"]}), "2025-01-01")
