import dj_database_url
from src.settings.components.env import config

database_url = config("DATABASE_URL", default="postgres://rwanga:rwanga@localhost:5432/rwanga")
default_db = dj_database_url.config(default=database_url)

# Always isolate tests from any legacy/shared DB naming.
isolated_test_name = config("RWANGA_TEST_DB_NAME", default="test_rwanga")
default_db.setdefault("TEST", {})
default_db["TEST"]["NAME"] = isolated_test_name

DATABASES = {"default": default_db}
