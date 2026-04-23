import axiosInstance from './axiosInstance'

/*
  fieldsApi.js — thin wrappers over the /api/fields/ endpoints.

  Three functions for the three operations CoordinatorDashboard needs:
    getFields()       → READ all fields for the current coordinator  (GET /fields/)
    createField(data) → CREATE a new field                           (POST /fields/)
    deleteField(id)   → DELETE a specific field                      (DELETE /fields/:id/)

  Design principle: each function does exactly ONE thing.
  - It sends the HTTP request and returns the parsed response data.
  - It does NOT catch errors — callers decide how to handle them.
    This makes the functions composable: a component can show a toast,
    another can set an error banner, without api functions knowing either way.

  The Authorization header is injected automatically by the axiosInstance
  request interceptor, so we never touch auth headers here.
*/

export async function getFields() {
  const response = await axiosInstance.get('fields/')
  return response.data
  /*
    The backend uses StandardResultsPagination, so the response shape is:
      { count: N, next: "...", previous: null, results: [...] }
    The caller reads response.data.results to get the array of field objects.
    We return the full paginated envelope so the caller can also see count/next
    if it ever needs to implement pagination controls.
  */
}

export async function createField(data) {
  const response = await axiosInstance.post('fields/', data)
  return response.data
  /*
    Expected input shape:
      { name: string, location: string, crop_type: string, size_in_acres: number|null }

    The backend's perform_create() injects coordinator = request.user automatically,
    so we never send a coordinator field from the frontend.

    On success (201 Created), the backend returns the full newly-created field object
    including the nested coordinator and any assigned_agent info.
  */
}

export async function deleteField(id) {
  await axiosInstance.delete(`fields/${id}/`)
  /*
    DELETE returns 204 No Content — there is no response body, so we don't
    try to read response.data. We simply await and let errors propagate.
  */
}

export async function patchField(id, data) {
  const response = await axiosInstance.patch(`fields/${id}/`, data)
  return response.data
  /*
    Used for assigning / unassigning agents on a specific field.
    Input examples:
      { assigned_agent_id: 7 }   ← assign agent with pk=7 to this field
      { assigned_agent_id: null } ← clear the field's agent assignment
    The backend FieldSerializer restricts assigned_agent_id to agents
    already on the coordinator's team (for_coordinator queryset).
    Returns the full updated field object on success (200 OK).
  */
}

export async function getAssignedFields() {
  const response = await axiosInstance.get('fields/my-assigned/')
  return response.data
  /*
    Field-agent only endpoint (GET /api/fields/my-assigned/).
    Returns a plain array (not paginated) of fields where
    assigned_agent = request.user.
    Used by SubmitReportPage to populate the field selector dropdown.
  */
}

export async function getFieldById(id) {
  const response = await axiosInstance.get(`fields/${id}/`)
  return response.data
  /*
    Coordinator-only. Fetches a single field record by PK.
    Used by CoordinatorFieldDetailPage on mount.
    Returns the full Field object including all 8 date fields.
  */
}

export async function getFieldDetail(id) {
  const response = await axiosInstance.get(`fields/${id}/agent-detail/`)
  return response.data
  /*
    Field-agent only. Returns the full field record only if the requesting
    agent is the assigned_agent — 403 otherwise.
    Used by AgentFieldDetailPage on mount.
  */
}

export async function patchRealizedDates(id, data) {
  const response = await axiosInstance.patch(`fields/${id}/realized-dates/`, data)
  return response.data
  /*
    Field-agent only. Accepts only the 4 realized_* date fields.
    Input example:
      { realized_planting_date: '2026-03-15', realized_emergence_date: '2026-03-28' }
    All fields are optional (partial). Returns the full updated field object.
  */
}

