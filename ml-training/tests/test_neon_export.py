"""Testes do export Neon → parquet.

Usamos SQLite in-memory como fake do Postgres — o schema é replicado
à mão (só colunas referenciadas no SQL) e o parâmetro `%(nome)s` do
psycopg é convertido pra `:nome` do sqlite pelo teste.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

import pandas as pd

from imovi_training.data import neon_export


def _sqlite_conn_with_sample_data() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.executescript(
        """
        CREATE TABLE neighborhoods (
            id TEXT PRIMARY KEY,
            name TEXT,
            city TEXT,
            state TEXT
        );
        CREATE TABLE properties (
            id TEXT PRIMARY KEY,
            area_m2 REAL,
            bedrooms INTEGER,
            bathrooms INTEGER,
            parking INTEGER,
            property_type TEXT,
            city TEXT,
            state TEXT,
            neighborhood_id TEXT
        );
        CREATE TABLE listings (
            id TEXT PRIMARY KEY,
            property_id TEXT,
            price REAL,
            operation TEXT,
            scraped_at TEXT
        );

        INSERT INTO neighborhoods VALUES ('n1', 'Batel', 'Curitiba', 'PR');
        INSERT INTO neighborhoods VALUES ('n2', 'Copacabana', 'Rio de Janeiro', 'RJ');

        INSERT INTO properties VALUES
          ('p1', 80.0, 2, 2, 1, 'apartment', 'Curitiba', 'PR', 'n1'),
          ('p2', 120.0, 3, 2, 2, 'house',        'Curitiba', 'PR', 'n1'),
          -- área NULL: deve ser filtrado
          ('p3', NULL,  2, 1, 0, 'apartment', 'Curitiba', 'PR', 'n1'),
          -- outra cidade: deve ser filtrado
          ('p4', 95.0,  2, 1, 1, 'apartment', 'Rio de Janeiro', 'RJ', 'n2');

        INSERT INTO listings VALUES
          ('l1', 'p1', 500000.0, 'sale',  '2026-03-01T10:00:00+00:00'),
          ('l2', 'p2', 900000.0, 'sale',  '2026-03-15T10:00:00+00:00'),
          ('l3', 'p3', 450000.0, 'sale',  '2026-03-20T10:00:00+00:00'),
          ('l4', 'p4', 700000.0, 'sale',  '2026-03-20T10:00:00+00:00'),
          ('l5', 'p1', NULL,     'sale',  '2026-04-01T10:00:00+00:00'),  -- price NULL
          ('l6', 'p1', 3500.0,   'rent',  '2026-04-01T10:00:00+00:00'); -- aluguel
        """
    )
    conn.commit()
    return conn


def _run_query(conn: sqlite3.Connection, **params: object) -> pd.DataFrame:
    """Executa o SQL do módulo adaptado pro sqlite (placeholders :name e
    sem cast `::float8`/`::timestamptz`)."""
    sql = (
        neon_export.TRAINING_EXPORT_SQL
        .replace("::float8", "")
        .replace("::timestamptz", "")
        .replace("%(city)s", ":city")
        .replace("%(state)s", ":state")
        .replace("%(operation)s", ":operation")
        .replace("%(since)s", ":since")
    )
    return pd.read_sql(sql, conn, params=params)


def test_export_filters_city_state_and_nulls() -> None:
    conn = _sqlite_conn_with_sample_data()
    df = _run_query(
        conn, city="Curitiba", state="PR", operation="sale", since=None
    )
    # Apenas p1 e p2 passam (p3 NULL area, p4 outra cidade, l5 price NULL,
    # l6 operation=rent)
    assert len(df) == 2
    assert set(df["neighborhood"]) == {"Batel"}
    assert set(df["property_type"]) == {"apartment", "house"}


def test_export_respects_since_cutoff() -> None:
    conn = _sqlite_conn_with_sample_data()
    df = _run_query(
        conn,
        city="Curitiba",
        state="PR",
        operation="sale",
        since="2026-03-10T00:00:00+00:00",
    )
    # só l2 (2026-03-15) sobrevive dos sale-curitiba com price/area válidos
    assert len(df) == 1
    assert df.iloc[0]["price"] == 900000.0


def test_export_columns_match_training_contract() -> None:
    """Garante que as colunas batem com o que features.build_features espera."""
    conn = _sqlite_conn_with_sample_data()
    df = _run_query(
        conn, city="Curitiba", state="PR", operation="sale", since=None
    )
    expected = {
        "area_m2",
        "bedrooms",
        "bathrooms",
        "parking",
        "property_type",
        "city",
        "neighborhood",
        "scraped_at",
        "price",
    }
    assert set(df.columns) == expected


def test_export_training_data_passes_params_to_read_sql(monkeypatch) -> None:
    """Garante que export_training_data usa o SQL e dict de params corretos."""
    captured: dict[str, object] = {}

    def fake_read_sql(sql, conn, params=None):  # type: ignore[no-untyped-def]
        captured["sql"] = sql
        captured["params"] = params
        return pd.DataFrame(
            columns=[
                "area_m2",
                "bedrooms",
                "bathrooms",
                "parking",
                "property_type",
                "city",
                "neighborhood",
                "scraped_at",
                "price",
            ]
        )

    monkeypatch.setattr(neon_export.pd, "read_sql", fake_read_sql)
    df = neon_export.export_training_data(
        object(),
        city="Curitiba",
        state="PR",
        operation="sale",
        since=pd.Timestamp(datetime(2026, 1, 1, tzinfo=timezone.utc)),
    )
    assert list(df.columns) == [
        "area_m2",
        "bedrooms",
        "bathrooms",
        "parking",
        "property_type",
        "city",
        "neighborhood",
        "scraped_at",
        "price",
    ]
    assert captured["params"] == {
        "city": "Curitiba",
        "state": "PR",
        "operation": "sale",
        "since": "2026-01-01T00:00:00+00:00",
    }
    assert "JOIN properties p" in captured["sql"]
    assert "l.operation = %(operation)s" in captured["sql"]
