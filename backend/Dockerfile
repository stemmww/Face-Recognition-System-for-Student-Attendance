FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Long timeout + retries to survive slow connections to PyPI mirrors.
RUN pip install --no-cache-dir --timeout 300 --retries 5 -r requirements.txt

COPY . .

RUN mkdir -p /app/uploads /app/models

RUN python -m tools.download_models

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
