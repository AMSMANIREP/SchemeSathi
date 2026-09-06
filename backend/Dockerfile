FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.lock /app/backend/requirements.lock
RUN pip install --no-cache-dir -r /app/backend/requirements.lock
COPY backend /app/backend
COPY data /app/data
WORKDIR /app/backend
RUN useradd --uid 10001 appuser
USER appuser
EXPOSE 8000
CMD ["uvicorn", "sathi.app:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
