# settings.py – perfil simple para runserver local
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = True

SECRET_KEY = "django-insecure-k!0q10!2q+_i^ni9rz#a+8p!%n+um*7k&3+$=in3dom^6uy5as"

ALLOWED_HOSTS = ["*", "localhost", "127.0.0.1", "[::1]"]

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
    "csp",  # ✅
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "csp.middleware.CSPMiddleware",  # ✅
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
                "mainApp.context_processors.pos_agent",  # ✅
            ],
        },
    },
]

WSGI_APPLICATION = "NovaSoft.wsgi.application"

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
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {"django": {"handlers": ["console"], "level": "INFO", "propagate": True}},
}

# ========= ✅ NUEVO FORMATO CSP (django-csp >= 4.0) =========
# Quita cualquier CSP_* viejo. Usa este diccionario.
CONTENT_SECURITY_POLICY = {
    "DIRECTIVES": {
        # Básico
        "default-src": ("'self'",),

        # Si cargas JS desde CDNs (jquery, quagga), deja https:
        # Si necesitas inline scripts en dev, añade "'unsafe-inline'" aquí también.
        "script-src": ("'self'", "https:"),

        # CSS desde CDNs + permitir estilos inline (útil en dev/plantillas)
        "style-src": ("'self'", "https:", "'unsafe-inline'"),

        "img-src": ("'self'", "https:", "data:"),
        "font-src": ("'self'", "https:", "data:"),

        # Muy importante: permitir fetch a tu agente local
        "connect-src": (
            "'self'",
            "https:",
            "http://127.0.0.1:8787",
            "http://localhost:8787",
        ),
    }
}
# Si prefieres solo ver violaciones sin bloquear, usa “REPORT ONLY”:
# CONTENT_SECURITY_POLICY_REPORT_ONLY = CONTENT_SECURITY_POLICY

# ========= Variables del agente POS (inyectadas al front) =========
POS_AGENT_URL = os.getenv("POS_AGENT_URL", "http://127.0.0.1:8787")
POS_AGENT_TOKEN = os.getenv(
    "POS_AGENT_TOKEN",
    "7f3d9a8c2e1b4d6f9a0c3e5f7b1d2c4e6a8f0b2d4c6e8a0f1b3d5f7a9c1e3d5"
)
