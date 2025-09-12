# settings.py – perfil simple para runserver local
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = True  # ← para desarrollo local

SECRET_KEY = "django-insecure-k!0q10!2q+_i^ni9rz#a+8p!%n+um*7k&3+$=in3dom^6uy5as"

ALLOWED_HOSTS = ["*", "localhost", "127.0.0.1", "[::1]"]  # ← simple en dev

# En dev no necesitas esto; si lo dejas, tampoco pasa nada
CSRF_TRUSTED_ORIGINS = []

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "mainApp",
    "dal",
    "dal_select2",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Puedes dejar WhiteNoise o quitarlo en dev; no es obligatorio
    # "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "NovaSoft.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates", BASE_DIR / "mainApp" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "NovaSoft.wsgi.application"

# En dev puedes usar sqlite para aislarte de la nube si quieres:
# DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
# O si quieres Aiven en dev, deja tu config actual:
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "defaultdb",
        "USER": "avnadmin",
        "PASSWORD": "AVNS_lvNWZhagqrduCpWqeUU",
        "HOST": "desarrollo-william84859-1d6e.g.aivencloud.com",
        "PORT": "16802",
        "OPTIONS": {"sslmode": "require"},
    }
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "mainApp" / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"

# En dev NO uses ManifestStaticFilesStorage (evita errores si no corres collectstatic)
# STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

AUTH_USER_MODEL = "mainApp.Usuario"
LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "home"
LOGOUT_REDIRECT_URL = "login"

AUTHENTICATION_BACKENDS = ["django.contrib.auth.backends.ModelBackend"]

SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_NAME = "sessionid"
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14
SESSION_SAVE_EVERY_REQUEST = True

APPEND_SLASH = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "loggers": {"django": {"handlers": ["console"], "level": "INFO", "propagate": True}},
}
