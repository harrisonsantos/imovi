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
from imovi_training.data.neon_export import export_to_parquet
from imovi_training.data.split import temporal_split
from imovi_training.eval.backtest import (
    generate_monthly_cutoffs,
    run_backtest,
    summarize,
)
from imovi_training.eval.metrics import coverage_by_city, mape, mdape, r2
from imovi_training.export.metadata import build_metadata, dump_metadata_json
from imovi_training.export.onnx import export_to_onnx
from imovi_training.features.builder import build_features, compute_imputation_medians
from imovi_training.features.location import (
    apply_neighborhood_medians,
    compute_neighborhood_medians,
)
from imovi_training.models.lightgbm_model import train_lgbm, train_lgbm_quantile


def _cmd_train(args: argparse.Namespace) -> int:
    """Executa pipeline fim-a-fim: load → split → features → train → export → métricas."""
    input_path = Path(args.input)
    output_path = Path(args.output)
    metrics_path = Path(args.metrics)
    cutoff = pd.Timestamp(args.cutoff)

    df = load_training_data(str(input_path))

    train_df, test_df = temporal_split(df, cutoff=cutoff)

    # Feature de localização: mediana R$/m² por bairro, SÓ do treino (anti-leakage).
    neighborhood_medians, global_median = compute_neighborhood_medians(train_df)
    train_df = apply_neighborhood_medians(train_df, neighborhood_medians, global_median)
    test_df = apply_neighborhood_medians(test_df, neighborhood_medians, global_median)

    # Medianas SÓ do treino — evita leak do teste para o serving.
    imputation_medians = compute_imputation_medians(train_df)

    X_train, y_train, feature_names = build_features(train_df)
    X_test, y_test, _ = build_features(test_df)

    model = train_lgbm(X_train, y_train)

    onnx_bytes = export_to_onnx(model, feature_names)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(onnx_bytes)

    # Modelos quantile p10/p90 para intervalos calibrados (--quantiles).
    # Layout: <output>.onnx + <output sem ext>-p10.onnx + -p90.onnx
    quantile_models = {}
    if args.quantiles:
        for alpha, suffix in [(0.1, "p10"), (0.9, "p90")]:
            qm = train_lgbm_quantile(X_train, y_train, alpha=alpha)
            quantile_models[suffix] = qm
            q_bytes = export_to_onnx(qm, feature_names)
            q_path = output_path.with_name(
                output_path.stem + f"-{suffix}" + output_path.suffix
            )
            q_path.write_bytes(q_bytes)

    # Sidecar JSON consumido pelo @imovi/ml-infer no runtime TS/Edge.
    metadata = build_metadata(
        model_version=args.model_version,
        feature_names=feature_names,
        imputation_medians=imputation_medians,
    )
    metadata_path = output_path.with_suffix(output_path.suffix + ".metadata.json")
    metadata_path.write_text(dump_metadata_json(metadata))

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
        # Cobertura empírica do intervalo [p10, p90] no holdout (alvo ~0.80).
        if quantile_models:
            import numpy as np

            p10 = quantile_models["p10"].predict(X_test)
            p90 = quantile_models["p90"].predict(X_test)
            metrics["interval_coverage_p10_p90"] = float(
                np.mean((y_test >= p10) & (y_test <= p90))
            )

    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(json.dumps(metrics, ensure_ascii=False, indent=2))
    return 0


def _cmd_export_neon(args: argparse.Namespace) -> int:
    """Exporta o dataset de treino do Neon → parquet.

    Conecta via `psycopg` usando `DATABASE_URL` do ambiente ou
    `--database-url`. Filtra por cidade/estado/operação e escreve
    parquet pronto pra `imovi_training train`.
    """
    import os

    import psycopg

    db_url = args.database_url or os.environ.get("DATABASE_URL")
    if not db_url:
        print("erro: --database-url ou DATABASE_URL é obrigatório", file=sys.stderr)
        return 2

    since = pd.Timestamp(args.since) if args.since else None

    with psycopg.connect(db_url) as conn:
        n = export_to_parquet(
            conn,
            args.output,
            city=args.city,
            state=args.state,
            operation=args.operation,
            since=since,
        )
    print(f"exportadas {n} linhas para {args.output}")
    return 0


def _cmd_backtest(args: argparse.Namespace) -> int:
    """Backtest temporal rolante.

    Para cada cutoff (1º dia de cada mês entre --start e --end), treina
    em scraped_at < cutoff e avalia em [cutoff, cutoff + window_months).
    Imprime sumário e grava JSON detalhado em --output.
    """
    df = load_training_data(args.input)
    cutoffs = generate_monthly_cutoffs(args.start, args.end)
    if not cutoffs:
        print("erro: intervalo --start/--end não produz cutoffs.", file=sys.stderr)
        return 2

    windows = run_backtest(
        df,
        cutoffs,
        window_months=args.window_months,
        min_train=args.min_train,
        min_test=args.min_test,
    )
    summary = summarize(windows)
    payload = {
        "summary": summary,
        "windows": [w.to_dict() for w in windows],
    }
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2))

    print(json.dumps(summary, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="imovi_training")
    sub = parser.add_subparsers(dest="command", required=True)

    export = sub.add_parser(
        "export-neon", help="Exporta dataset do Neon Postgres para parquet."
    )
    export.add_argument("--output", required=True, help="Arquivo parquet de saída.")
    export.add_argument(
        "--database-url",
        default=None,
        help="Connection string Postgres (fallback: $DATABASE_URL).",
    )
    export.add_argument("--city", default="Curitiba")
    export.add_argument("--state", default="PR")
    export.add_argument("--operation", default="sale", choices=["sale", "rent"])
    export.add_argument(
        "--since",
        default=None,
        help="Filtra listings com scraped_at >= ISO (ex: 2026-01-01).",
    )
    export.set_defaults(func=_cmd_export_neon)

    train = sub.add_parser("train", help="Treina o modelo e exporta ONNX + métricas.")
    train.add_argument("--input", required=True, help="Caminho do parquet de entrada.")
    train.add_argument("--output", required=True, help="Caminho do .onnx de saída.")
    train.add_argument("--metrics", required=True, help="Caminho do JSON de métricas.")
    train.add_argument(
        "--cutoff", required=True, help="Data de corte (ISO) para split temporal."
    )
    train.add_argument(
        "--model-version",
        default="v1",
        help="Versão do modelo gravada no sidecar metadata (default: v1).",
    )
    train.add_argument(
        "--quantiles",
        action="store_true",
        help="Treina também modelos quantile p10/p90 (intervalos calibrados).",
    )
    train.set_defaults(func=_cmd_train)

    backtest = sub.add_parser(
        "backtest",
        help="Backtest temporal rolante mês-a-mês com métricas por janela.",
    )
    backtest.add_argument("--input", required=True, help="Parquet com coluna scraped_at.")
    backtest.add_argument("--output", required=True, help="JSON com summary + windows.")
    backtest.add_argument("--start", required=True, help="ISO; primeiro cutoff (mês).")
    backtest.add_argument("--end", required=True, help="ISO; último cutoff (mês).")
    backtest.add_argument("--window-months", type=int, default=1)
    backtest.add_argument("--min-train", type=int, default=100)
    backtest.add_argument("--min-test", type=int, default=20)
    backtest.set_defaults(func=_cmd_backtest)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
