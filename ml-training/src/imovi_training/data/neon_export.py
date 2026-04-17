"""Export do dataset de treino do Neon Postgres → parquet.

Consulta canônica: `listings JOIN properties LEFT JOIN neighborhoods`
filtrada para uma cidade/estado/operação. O shape de colunas bate com o
contrato de `loader.load_training_data()` / `features.build_features()`.

Uso típico:

    python -m imovi_training.cli export-neon \\
        --database-url "postgres://..." \\
        --output ml-training/data/curitiba.parquet \\
        --since 2026-01-01

Ou como lib:

    df = export_training_data(conn, city="Curitiba", state="PR")
    df.to_parquet(path)
"""

from __future__ import annotations

from typing import Any

import pandas as pd

# SQL com placeholders nomeados (psycopg v3). Usa conversões explícitas
# pra evitar que numeric/Decimal do psycopg vire `object` no pandas.
TRAINING_EXPORT_SQL = """
SELECT
    p.area_m2::float8       AS area_m2,
    p.bedrooms              AS bedrooms,
    p.bathrooms             AS bathrooms,
    p.parking               AS parking,
    p.property_type         AS property_type,
    p.city                  AS city,
    n.name                  AS neighborhood,
    l.scraped_at            AS scraped_at,
    l.price::float8         AS price
FROM listings l
JOIN properties p     ON p.id = l.property_id
LEFT JOIN neighborhoods n ON n.id = p.neighborhood_id
WHERE l.price IS NOT NULL
  AND p.area_m2 IS NOT NULL
  AND p.city    = %(city)s
  AND p.state   = %(state)s
  AND l.operation = %(operation)s
  AND (%(since)s::timestamptz IS NULL OR l.scraped_at >= %(since)s::timestamptz)
ORDER BY l.scraped_at
""".strip()


def export_training_data(
    conn: Any,
    *,
    city: str = "Curitiba",
    state: str = "PR",
    operation: str = "sale",
    since: pd.Timestamp | None = None,
) -> pd.DataFrame:
    """Executa o SELECT canônico e devolve DataFrame pronto pro pipeline.

    `conn` pode ser qualquer coisa aceita por `pandas.read_sql` com SQL
    parametrizado via dict (psycopg, sqlalchemy engine, etc.). Em testes
    usamos pglite/sqlite, que aceitam o mesmo SQL após pequeno tweak —
    se for necessário backend-específico, mockar aqui.
    """
    params: dict[str, Any] = {
        "city": city,
        "state": state,
        "operation": operation,
        "since": since.isoformat() if since is not None else None,
    }
    df = pd.read_sql(TRAINING_EXPORT_SQL, conn, params=params)
    # Normaliza tipos: inteiros nullable do Postgres viram `Int64` — convertemos
    # pra float compatível com build_features (que faz pd.to_numeric depois).
    for col in ("bedrooms", "bathrooms", "parking"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def export_to_parquet(
    conn: Any,
    output_path: str,
    *,
    city: str = "Curitiba",
    state: str = "PR",
    operation: str = "sale",
    since: pd.Timestamp | None = None,
) -> int:
    """Helper para o CLI: executa export + salva parquet. Retorna nº de linhas."""
    df = export_training_data(
        conn, city=city, state=state, operation=operation, since=since
    )
    from pathlib import Path

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output_path, index=False)
    return len(df)
