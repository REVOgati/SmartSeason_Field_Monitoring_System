import axiosInstance from './axiosInstance'

/*
  agentsApi.js — Wrappers for the /api/agents/ team-management endpoints.

  Who uses these:
  - CoordinatorDashboard → getAgentPool(), getMyTeam(), assignAgent(), dropAgent()

  Endpoint reference:
    GET  /api/agents/pool/          → list of unassigned, verified field agents
    GET  /api/agents/my-team/       → list of agents assigned to this coordinator
    POST /api/agents/{pk}/assign/   → add agent (from pool) to this coordinator's team
    POST /api/agents/{pk}/drop/     → remove agent from team + clear all their field assignments

  None of these endpoints accept a request body (assign/drop use the URL pk only).

  All four endpoints are coordinator-only on the backend — calling them with
  a field_agent token returns 403.
*/

export async function getAgentPool() {
  const response = await axiosInstance.get('agents/pool/')
  return response.data
  /*
    Response shape (paginated):
      { count: N, next: "...", previous: null, results: [...] }
    Each result is an AgentPoolSerializer object:
      { id, email, full_name, role }
  */
}

export async function getMyTeam() {
  const response = await axiosInstance.get('agents/my-team/')
  return response.data
  /*
    Same shape as getAgentPool().
    Only returns agents whose coordinator FK points to request.user.
  */
}

export async function assignAgent(agentPk) {
  const response = await axiosInstance.post(`agents/${agentPk}/assign/`)
  return response.data
  /*
    No request body needed — the agent is identified by the URL pk.
    Response on success (200 OK):
      { "message": "Jane Njeri has been added to your team." }
    The caller should then PATCH the field with assigned_agent_id to
    link the newly-teamed agent to a specific field.
  */
}

export async function dropAgent(agentPk) {
  const response = await axiosInstance.post(`agents/${agentPk}/drop/`)
  return response.data
  /*
    No request body needed.
    Response on success (200 OK):
      {
        "message":       "Jane Njeri has been released from your team.",
        "fields_cleared": 2   ← how many field assignments were wiped
      }
    IMPORTANT side effect: the backend sets assigned_agent=NULL for EVERY
    field that was assigned to this agent. The caller must update local state
    to reflect this — not just the one field card that was clicked.
  */
}
