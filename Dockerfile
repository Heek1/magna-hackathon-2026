# One container for the public demo: builds the phone app and serves it together with the API.
# Local development still uses docker-compose.yml (backend + vite dev server).

FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY data/oee.xlsx /data/oee.xlsx
COPY --from=web /web/dist /app/static
ENV OEE_DATA=/data/oee.xlsx ACTIONS_DB=/app/state/actions.db STATIC_DIR=/app/static PORT=8000
RUN mkdir -p /app/state
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
