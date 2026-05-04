FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py index.html dashboard.html favicon.ico ./
COPY app/ ./app/
COPY assets/ ./assets/

# Gera versão única a cada build para forçar cache bust automático
RUN BUILD_TS=$(date +%Y%m%d%H%M%S) && \
    sed -i "s/v=2026[0-9]*[a-z]*/v=${BUILD_TS}/g" dashboard.html && \
    sed -i "s/v=2026[0-9]*[a-z]*/v=${BUILD_TS}/g" index.html

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://127.0.0.1:8000/healthz || exit 1

CMD ["python", "main.py"]
