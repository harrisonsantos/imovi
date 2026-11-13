from __future__ import annotations

import numpy as np
import pytest

from imovi_training import cli
from tests.fixtures.synthetic_data import make_synthetic_df


def train_args(tmp_path, cutoff="2025-01-01"):
    return cli.build_parser().parse_args([
        "train", "--input", str(tmp_path / "data.parquet"),
        "--output", str(tmp_path / "model.onnx"),
        "--metrics", str(tmp_path / "metrics.json"), "--cutoff", cutoff,
    ])


def test_empty_holdout_fails_before_generating_artifacts(monkeypatch, tmp_path):
    monkeypatch.setattr(cli, "load_training_data", lambda _: make_synthetic_df(n=500))
    def never_export(*_):
        raise AssertionError("export must not run before the holdout gate")
    monkeypatch.setattr(cli, "export_to_onnx", never_export)
    with pytest.raises(ValueError, match="Insufficient temporal holdout"):
        cli._cmd_train(train_args(tmp_path, "2099-01-01"))
    assert list(tmp_path.iterdir()) == []


def test_nonfinite_predictions_fail_before_generating_artifacts(monkeypatch, tmp_path):
    monkeypatch.setattr(cli, "load_training_data", lambda _: make_synthetic_df(n=500))
    class BrokenModel:
        def predict(self, X):
            return np.full(len(X), np.nan)
    monkeypatch.setattr(cli, "train_lgbm", lambda *_: BrokenModel())
    def never_export(*_):
        raise AssertionError("export must not run before the metric gate")
    monkeypatch.setattr(cli, "export_to_onnx", never_export)
    with pytest.raises(ValueError, match="predictions must be finite"):
        cli._cmd_train(train_args(tmp_path))
    assert list(tmp_path.iterdir()) == []


def test_invalid_observed_target_fails_before_training(monkeypatch, tmp_path):
    df = make_synthetic_df(n=500)
    df.loc[0, "price"] = -1
    monkeypatch.setattr(cli, "load_training_data", lambda _: df)
    with pytest.raises(ValueError, match="positive finite"):
        cli._cmd_train(train_args(tmp_path))
    assert list(tmp_path.iterdir()) == []
