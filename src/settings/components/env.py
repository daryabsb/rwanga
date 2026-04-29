from decouple import config

DJANGO_ENV = config("DJANGO_ENV", default="development")
DEBUG = config("DEBUG", default=True, cast=bool)
