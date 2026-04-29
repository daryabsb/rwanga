from pathlib import Path

# In split-settings include(), __file__ points to src/settings/__init__.py.
# Reuse the components package root resolver to keep BASE_DIR stable.
from src.settings.components import BASE_DIR as COMPONENTS_BASE_DIR

BASE_DIR = Path(COMPONENTS_BASE_DIR)
STATIC_ROOT = BASE_DIR / "staticfiles"
STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "/media/"
