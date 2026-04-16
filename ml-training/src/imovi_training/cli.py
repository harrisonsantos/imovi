"""CLI do imovi-training.

Uso:
    python -m imovi_training.cli train \\
        --input=data.parquet \\
        --output=models/imovi-v1.onnx \\
        --metrics=metrics.json \\
        --cutoff=2025-01-01
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

from imovi_training.data.loader import load_training_data
from imovi_training.data.split import temporal_split
from imovi_training.eval.metrics import coverage_by_city, mape, mdape, r2
from imovi_training.export.onnx import export_to_onnx
from imovi_training.features.builder import build_features
from imovi_training.models.lightgbm_model import train_lgbm


def _cmd_train(args: argparse.Namespace) -> int:
    """Executa pipeline fim-a-fim: load → split → features → train → export → métricas."""
    input_path = Path(args.input)
    output_path = Path(args.output)
    metrics_path = Path(args.metrics)
    cutoff = pd.Timestamp(args.cutoff)

    df = load_training_data(str(input_path))

    train_df, test_df = temporal_split(df, cutoff=cutoff)

    X_train, y_train, feature_names = build_features(train_df)
    X_test, y_test, _ = build_features(test_df)

    model = train_lgbm(X_train, y_train)

    onnx_bytes = export_to_onnx(model, feature_names)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(onnx_bytes)

    preds = model.predict(X_test) if len(X_test) > 0 else []
    metrics: dict[str, object] = {
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "cutoff": str(cutoff.date()),
        "feature_names": feature_names,
    }
    if len(preds) > 0:
        metrics["mape"] = mape(y_test, preds)
        metrics["mdape"] = mdape(y_test, preds)
        metrics["r2"] = r2(y_test, preds)
        if "city" in test_df.columns:
            metrics["coverage_by_city"] = coverage_by_city(
                y_test, preds, test_df["city"].to_numpy(), tolerance=0.20
            )

    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(json.dumps(metrics, ensure_ascii=False, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="imovi_training")
    sub = parser.add_subparsers(dest="command", required=True)

    train = sub.add_parser("train", help="Treina o modelo e exporta ONNX + métricas.")
    train.add_argument("--input", required=True, help="Caminho do parquet de entrada.")
    train.add_argument("--output", required=True, help="Caminho do .onnx de saída.")
    train.add_argument("--metrics", required=True, help="Caminho do JSON de métricas.")
    train.add_argument(
        "--cutoff", required=True, help="Data de corte (ISO) para split temporal."
    )
    train.set_defaults(func=_cmd_train)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
