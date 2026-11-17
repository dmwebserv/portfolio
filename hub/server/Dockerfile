FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HUB_DATA_DIR=/data/studio
WORKDIR /app
COPY hub/server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home studio && mkdir -p /data/studio && chown studio:studio /data/studio
COPY --chown=studio:studio hub/ ./hub/
COPY --chown=studio:studio operations/uk-export/ ./operations/uk-export/
COPY --chown=studio:studio demos/ ./demos/
COPY --chown=studio:studio uk-export.html uk-export-terms.html ./
EXPOSE 8001
CMD ["python", "-m", "hub.server.start_container"]
