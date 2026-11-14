# Production image for the Haddak API.
#   docker build -t haddak-api .
#   docker run -p 8000:8000 --env-file .env haddak-api

FROM python:3.12-slim

# Do not write .pyc files; print logs immediately instead of buffering them.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencies first: Docker caches this step, so rebuilding after a code
# change does not reinstall everything.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app
COPY scripts ./scripts

# Run as an ordinary user, not root: if the app is ever broken into, the
# attacker has fewer rights inside the container.
RUN useradd --create-home --uid 1000 haddak
USER haddak

# Hosting platforms set PORT themselves; 8000 is the fallback.
ENV PORT=8000
EXPOSE 8000

# 1. Apply any new database migrations.  2. Start the server.
# --no-access-log: uvicorn's own access log prints full query strings
#   (users' lat/lng); app/request_logging.py logs each request without them.
# `exec` makes uvicorn the main process, so it receives the stop signal and
#   shuts down cleanly.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log"]
