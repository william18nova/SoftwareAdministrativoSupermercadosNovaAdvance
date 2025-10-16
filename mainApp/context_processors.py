# mainApp/context_processors.py
from django.conf import settings

def pos_agent(request):
    return {
        "POS_AGENT_URL": getattr(settings, "POS_AGENT_URL", ""),
        "POS_AGENT_TOKEN": getattr(settings, "POS_AGENT_TOKEN", ""),
    }
