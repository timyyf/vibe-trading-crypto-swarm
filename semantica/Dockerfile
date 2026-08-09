FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
# semantica com --no-deps evita torch/transformers/spacy (imagem enxuta para free tier)
RUN pip install --no-cache-dir --no-deps semantica==0.6.0 && \
    pip install --no-cache-dir fastapi uvicorn "psycopg[binary]"

COPY bridge.py .

ENV PORT=8001
EXPOSE 8001

# Render injeta a variável PORT em runtime; o CMD abaixo a respeita.
CMD uvicorn bridge:app --host 0.0.0.0 --port $PORT
