import uvicorn

from formgen.api.settings import get_settings

if __name__ == "__main__":
    s = get_settings()
    uvicorn.run("formgen.api.app:app", host="0.0.0.0", port=s.app_port, log_level=s.log_level.lower())
