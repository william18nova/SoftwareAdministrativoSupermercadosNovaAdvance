"""
Django settings for NovaSoft project (producción local sin dominio).
"""

from pathlib import Path
import os
import socket

BASE_DIR = Path(__file__).resolve().parent.parent

# ──────────────────────────────
# Modo
# ──────────────────────────────
DEBUG = False

# ⚠️ Mueve esto a variables de entorno cuanto antes
SECRET_KEY = "django-insecure-k!0q10!2q+_i^ni9rz#a+8p!%n+um*7k&3+$=in3dom^6uy5as"

# ──────────────────────────────
# Hosts / CSRF para local y LAN
# ──────────────────────────────
HOSTNAME = socket.gethostname()

ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
    "[::1]",
    HOSTNAME,  # nombre de tu máquina
    # agrega tu IP LAN si accedes desde otro equipo, por ej. "192.168.1.50"
]

# Con DEBUG=False, Django exige esquema + puerto
CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    # "http://192.168.1.50:8000",  # tu IP LAN si pruebas desde otro equipo
]

# ──────────────────────────────
# Apps
# ──────────────────────────────
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

# ──────────────────────────────
# Middleware (WhiteNoise debajo de Security)
# ──────────────────────────────
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # ← importante con DEBUG=False
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
        "DIRS": [
            BASE_DIR / "templates",
            BASE_DIR / "mainApp" / "templates",
        ],
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

# ──────────────────────────────
# Base de datos (Aiven)
# ──────────────────────────────
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

# ──────────────────────────────
# Password validators
# ──────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ──────────────────────────────
# i18n / zona horaria
# ──────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = False

# ──────────────────────────────
# Archivos estáticos (WhiteNoise)
# ──────────────────────────────
STATIC_URL = "/static/"
# Aquí editas tus assets en desarrollo:
STATICFILES_DIRS = [BASE_DIR / "mainApp" / "static"]
# Aquí se copiarán para producción:
STATIC_ROOT = BASE_DIR / "staticfiles"

# Almacén de archivos estáticos con hash + compresión (WhiteNoise)
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# ──────────────────────────────
# Auth / sesiones
# ──────────────────────────────
AUTH_USER_MODEL = "mainApp.Usuario"
LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "home"
LOGOUT_REDIRECT_URL = "login"

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
]

SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_NAME = "sessionid"
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14  # 2 semanas
SESSION_SAVE_EVERY_REQUEST = True

# ──────────────────────────────
# Otras utilidades
# ──────────────────────────────
APPEND_SLASH = True  # corrige rutas sin "/" al final

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "file": {
            "level": "DEBUG",
            "class": "logging.FileHandler",
            "filename": BASE_DIR / "debug.log",
        },
        "console": {"class": "logging.StreamHandler"},
    },
    "loggers": {
        "django": {
            "handlers": ["file", "console"],
            "level": "INFO",
            "propagate": True,
        },
    },
}
