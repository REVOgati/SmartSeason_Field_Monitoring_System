"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/auth/', include('users.urls')),
    # Mounts the users URL module at /api/auth/
    # Results in:
    #   POST /api/auth/register/  → RegisterView
    #   GET  /api/auth/me/        → MeView
    #   PATCH /api/auth/me/       → MeView
    # The 'api/auth/' prefix is intentional — it groups all identity-related
    # endpoints together. Login (added Session 8) will also live here.

    path('api/fields/', include('fields.urls')),
    # Mounts the fields URL module at /api/fields/
    # The Router inside fields/urls.py generates:
    #   /api/fields/         → list + create
    #   /api/fields/{id}/    → retrieve + update + delete

    path('api/agents/', include('users.agent_urls')),
    # Mounts the agent management endpoints at /api/agents/
    # Kept separate from /api/auth/ to signal a different concern:
    #   /api/auth/  → identity (register, login, refresh, me)
    #   /api/agents/ → team management (pool, my-team, assign, drop)
    # Results in:
    #   GET  /api/agents/pool/              → AgentPoolView
    #   GET  /api/agents/my-team/           → MyTeamView
    #   POST /api/agents/{pk}/assign/       → AssignAgentView
    #   POST /api/agents/{pk}/drop/         → DropAgentView
]
