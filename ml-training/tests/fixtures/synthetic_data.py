"""Gera DataFrame sintético reprodutível para testes."""

from __future__ import annotations

import numpy as np
import pandas as pd

PROPERTY_TYPES = ["apartamento", "casa", "cobertura", "studio"]
CITIES = ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba"]
NEIGHBORHOODS = {
    "São Paulo": ["Pinheiros", "Vila Mariana", "Moema", "Tatuapé"],
    "Rio de Janeiro": ["Copacabana", "Ipanema", "Tijuca", "Botafogo"],
    "Belo Horizonte": ["Savassi", "Funcionários", "Buritis", "Lourdes"],
    "Curitiba": ["Batel", "Água Verde", "Centro", "Bigorrilho"],
}


def make_synthetic_df(n: int = 500, seed: int = 42) -> pd.DataFrame:
    """Gera DataFrame sintético para testes.

    Colunas: area_m2, bedrooms, bathrooms, parking, property_type,
             city, neighborhood, scraped_at, price.

    Preço é função determinística das features + ruído gaussiano,
    garantindo que o modelo consegue aprender algo.
    """
    rng = np.random.default_rng(seed)

    area_m2 = rng.uniform(30.0, 400.0, size=n)
    bedrooms = rng.integers(1, 6, size=n)
    bathrooms = rng.integers(1, 5, size=n)
    parking = rng.integers(0, 4, size=n)

    prop_idx = rng.integers(0, len(PROPERTY_TYPES), size=n)
    property_type = np.array([PROPERTY_TYPES[i] for i in prop_idx])

    city_idx = rng.integers(0, len(CITIES), size=n)
    city = np.array([CITIES[i] for i in city_idx])
    neighborhood = np.array(
        [rng.choice(NEIGHBORHOODS[c]) for c in city]
    )

    # timestamps espalhados em ~2 anos (2024-01-01 .. 2025-12-31)
    start = pd.Timestamp("2024-01-01")
    end = pd.Timestamp("2025-12-31")
    span_seconds = (end - start).total_seconds()
    offsets = rng.uniform(0.0, span_seconds, size=n)
    scraped_at = pd.to_datetime(
        [start + pd.Timedelta(seconds=float(s)) for s in offsets]
    )

    # multiplicadores por cidade (efeito fixo)
    city_mult = {
        "São Paulo": 1.3,
        "Rio de Janeiro": 1.25,
        "Belo Horizonte": 0.95,
        "Curitiba": 0.9,
    }
    type_mult = {
        "apartamento": 1.0,
        "casa": 1.1,
        "cobertura": 1.8,
        "studio": 0.7,
    }

    base = (
        area_m2 * 8000.0
        + bedrooms * 25000.0
        + bathrooms * 18000.0
        + parking * 12000.0
    )
    mult = np.array([city_mult[c] * type_mult[t] for c, t in zip(city, property_type)])
    noise = rng.normal(0.0, 30000.0, size=n)
    price = base * mult + noise
    price = np.maximum(price, 50000.0)  # clamp piso

    return pd.DataFrame(
        {
            "area_m2": area_m2,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "parking": parking,
            "property_type": property_type,
            "city": city,
            "neighborhood": neighborhood,
            "scraped_at": scraped_at,
            "price": price,
        }
    )
