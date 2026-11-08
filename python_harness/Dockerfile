FROM python:3.11-slim

WORKDIR /service
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --system --no-create-home --uid 10001 harness
COPY *.py models.json ./python_harness/

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
USER 10001
EXPOSE 8000
CMD ["sh", "-c", "exec python -m uvicorn python_harness.app:app --host 0.0.0.0 --port \"$PORT\""]
