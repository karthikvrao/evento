FROM python:3.14.3-slim

# Install uv.
COPY --from=ghcr.io/astral-sh/uv:0.6 /uv /uvx /bin/

# Copy the application into the container.
COPY . /app
WORKDIR /app

# Install the application dependencies.
RUN uv sync --frozen --no-dev

# Ensure the installed binary is on the PATH
ENV PATH="/app/.venv/bin:$PATH"

# Expose the Cloud Run port
EXPOSE 8080

# Run the Uvicorn server (no reload in production)
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
