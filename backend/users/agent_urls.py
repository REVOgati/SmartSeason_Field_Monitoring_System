from django.urls import path
from .views import AgentPoolView, MyTeamView, AssignAgentView, DropAgentView

urlpatterns = [
    path('pool/', AgentPoolView.as_view(), name='agent-pool'),
    # GET /api/agents/pool/
    # Lists all verified field agents who are not yet assigned to a coordinator.
    # Coordinator browses this list, picks someone, then calls /assign/.

    path('my-team/', MyTeamView.as_view(), name='my-team'),
    # GET /api/agents/my-team/
    # Lists all agents currently on the requesting coordinator's team.
    # Coordinator uses this to see their roster and find PKs for /drop/.

    path('<int:pk>/assign/', AssignAgentView.as_view(), name='assign-agent'),
    # POST /api/agents/{pk}/assign/
    # Pulls the specified pool agent into this coordinator's team.
    # No request body needed — agent is identified by the URL pk.

    path('<int:pk>/drop/', DropAgentView.as_view(), name='drop-agent'),
    # POST /api/agents/{pk}/drop/
    # Releases the specified team agent back to the unassigned pool.
    # Also clears all field assignments for that agent.
]
