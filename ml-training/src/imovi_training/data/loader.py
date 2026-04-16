"""Carregamento de dados de treino."""

from __future__ import annotations

from typing import Any

import pandas as pd


def load_training_data(conn: Any) -> pd.DataFrame:
    """Carrega dados de treino a partir de uma conexão ou caminho.

    Se `conn` for uma string (path para parquet), lê via pandas.
    Caso contrário, assume-se que é uma conexão DB-API e executa SQL padrão.

    Contrato esperado do DataFrame retornado:
        colunas: area_m2, bedrooms, bathrooms, parking, property_type,
                 city, neighborhood, scraped_at, price.
    """
    if isinstance(conn, str):
        return pd.read_parquet(conn)

    # Conexão DB-API (psycopg, sqlite3, etc.) — SQL mínimo.
    query = """
        SELECT area_m2, bedrooms, bathrooms, parking,
               property_type, city, neighborhood, scraped_at, price
        FROM listings
        WHERE price IS NOT NULL
    """
    return pd.read_sql(query, conn)
