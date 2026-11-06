"""Gate de promoção de modelo.

Compara as métricas do candidato com o modelo ativo em `model_versions`:
promove apenas se o MdAPE não regredir (tolerância configurável).

Uso (no workflow de retraining):
    python -m imovi_training.promote \\
        --metrics models/metrics.json \\
        --version v3-2026-06-18 \\
        --artifact-url r2://imovi-model-artifacts/versions/v3-2026-06-18/model.onnx

Exit codes: 0 = promovido (registra + ativa no DB); 3 = reprovado no gate.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from pathlib import Path


def gate_passes(
    candidate_mdape: float,
    active_mdape: float | None,
    tolerance: float = 0.01,
) -> bool:
    """True se o candidato pode ser promovido.

    - Sem modelo ativo (ou ativo sem mdape) → promove.
    - Caso contrário, exige candidate <= active + tolerance.
    """
    if not math.isfinite(candidate_mdape) or candidate_mdape < 0:
        return False
    if not math.isfinite(tolerance) or tolerance < 0:
        return False
    if active_mdape is None:
        return True
    if not math.isfinite(active_mdape) or active_mdape < 0:
        return False
    return candidate_mdape <= active_mdape + tolerance


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="imovi_training.promote")
    parser.add_argument("--metrics", required=True, help="JSON de métricas do candidato.")
    parser.add_argument("--version", required=True, help="Nome da versão (ex: v3-2026-06-18).")
    parser.add_argument("--artifact-url", required=True)
    parser.add_argument("--database-url", default=None)
    parser.add_argument("--tolerance", type=float, default=0.01)
    parser.add_argument(
        "--dry-run", action="store_true", help="Só avalia o gate; não toca no DB."
    )
    args = parser.parse_args(argv)

    metrics = json.loads(Path(args.metrics).read_text(encoding="utf-8"))
    candidate_mdape = metrics.get("mdape")
    if candidate_mdape is None:
        print("erro: métricas do candidato sem mdape (n_test=0?)", file=sys.stderr)
        return 2
    if not isinstance(candidate_mdape, (int, float)) or not gate_passes(candidate_mdape, None):
        print("erro: mdape deve ser finito e não negativo", file=sys.stderr)
        return 2
    expected_key = f"versions/{args.version}/model.onnx"
    if (not args.artifact_url.startswith("r2://")
            or args.artifact_url.split("/", 3)[-1] != expected_key):
        print("erro: artifact-url deve apontar para a versão imutável", file=sys.stderr)
        return 2

    db_url = args.database_url or os.environ.get("DATABASE_URL")
    if not db_url:
        print("erro: DATABASE_URL obrigatório", file=sys.stderr)
        return 2

    import psycopg

    with psycopg.connect(db_url) as conn:
        # Serialize activation so concurrent retraining jobs compare against the same current state.
        conn.execute("SELECT pg_advisory_xact_lock(9324761)")
        row = conn.execute(
            "SELECT version, metrics FROM model_versions WHERE active = true LIMIT 1"
        ).fetchone()
        active_version = row[0] if row else None
        active_metrics = row[1] if row else None
        active_mdape = (
            active_metrics.get("mdape") if isinstance(active_metrics, dict) else None
        )

        passed = gate_passes(float(candidate_mdape), active_mdape, args.tolerance)
        print(
            json.dumps(
                {
                    "candidate": args.version,
                    "candidate_mdape": candidate_mdape,
                    "active": active_version,
                    "active_mdape": active_mdape,
                    "gate_passed": passed,
                }
            )
        )
        if not passed:
            return 3
        if args.dry_run:
            return 0

        conn.execute(
            """
            INSERT INTO model_versions
              (version, trained_at, training_rows, metrics, artifact_url, active, notes)
            VALUES (%s, now(), %s, %s, %s, false, 'retraining automático')
            """,
            (
                args.version,
                metrics.get("n_train"),
                json.dumps(metrics),
                args.artifact_url,
            ),
        )
        conn.execute("UPDATE model_versions SET active = false WHERE active = true")
        conn.execute(
            "UPDATE model_versions SET active = true WHERE version = %s", (args.version,)
        )
        conn.commit()
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
