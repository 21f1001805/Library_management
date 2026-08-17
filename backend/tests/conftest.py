import os

# Tests hardcode "/api/v1/..." paths, independent of whatever API_PREFIX a
# developer's local .env happens to use — pin it before app.core.config
# ever loads settings (this file is imported before any test module).
os.environ["APP_ENV"] = "test"
os.environ["API_PREFIX"] = "/api/v1"
