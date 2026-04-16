"""Split temporal — particiona por `scraped_at`."""

from __future__ import annotations

import pandas as pd


def temporal_split(
    df: pd.DataFrame,
    cutoff: str | pd.Timestamp,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Divide o DataFrame em (train, test) por `scraped_at`.

    - `train`: registros com scraped_at < cutoff.
    - `test`:  registros com scraped_at >= cutoff.

    Determinístico: preserva a ordem original via reset_index(drop=True).
    """
    if not isinstance(cutoff, pd.Timestamp):
        cutoff = pd.Timestamp(cutoff)

    ts = pd.to_datetime(df["scraped_at"])
    train_mask = ts < cutoff

    train = df.loc[train_mask].reset_index(drop=True)
    test = df.loc[~train_mask].reset_index(drop=True)
    return train, test
