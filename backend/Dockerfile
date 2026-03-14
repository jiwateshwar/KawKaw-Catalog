FROM python:3.12-slim

# Install system dependencies: ffmpeg for video thumbnails, libraw for RAW files
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libraw-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run migrations then start the server
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
