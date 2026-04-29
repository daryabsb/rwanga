import dj_database_url
from src.settings.components.env import config

DATABASES = {
    "default": dj_database_url.config(
        default=config("DATABASE_URL", default="postgres://rwanga:rwanga@localhost:5432/rwanga")
    )
}
