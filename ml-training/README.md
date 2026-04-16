# imovi-training

Módulo Python **isolado** do monorepo TS — treinamento do modelo AVM (LightGBM) para previsão de preços de imóveis em R$.

## Responsabilidades

- Carregar dados de treino (a partir de parquet/DB).
- Construir features (imputação + one-hot).
- Split temporal (cutoff por `scraped_at`).
- Treinar LightGBM.
- Exportar para **ONNX** (via `onnxmltools.convert_lightgbm`).
- Avaliar (MAPE, MdAPE, R², coverage por cidade).
- Emitir JSON de métricas pronto para persistência em `model_versions`.

## Stack

- Python 3.13
- Gerenciador: [`uv`](https://github.com/astral-sh/uv)
- LightGBM, scikit-learn, onnxmltools, onnxruntime
- pytest (TDD estrita)

## Setup

```bash
cd ml-training
uv sync
uv run pytest
```

## CLI

```bash
uv run python -m imovi_training.cli train \
  --input=data.parquet \
  --output=models/imovi-v1.onnx \
  --metrics=metrics.json \
  --cutoff=2025-01-01
```

## Decisões

- **ONNX export**: usa `onnxmltools.convert_lightgbm` (suporte oficial para boosters LightGBM). `skl2onnx` não converte `LGBMRegressor` nativamente.
- **Tolerância de predição ONNX vs nativo**: `1e-4` em float32.
- **Split temporal estrito**: nenhum registro com `scraped_at < cutoff` pode estar no test set.
