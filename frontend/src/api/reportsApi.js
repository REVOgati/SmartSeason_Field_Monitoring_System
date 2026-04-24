import axiosInstance from './axiosInstance'

/*
  reportsApi.js — Wrappers for the /api/reports/ endpoints.

  Who uses these:
  - AgentDashboard  → getMyReports()  (list own submitted reports)
  - SubmitReportPage (Session 19) → submitReport() (POST a new report)

  Backend notes:
  - GET /reports/ is scoped by role in the view:
      field_agent  → only their own submitted reports
      coordinator  → reports for all fields they coordinate
  - POST /reports/ is field_agent only; the agent FK is set server-side.
  - The endpoint uses StandardResultsPagination (page_size=20).
*/

export async function getMyReports() {
  const response = await axiosInstance.get('reports/')
  return response.data
  /*
    Response shape (paginated):
      { count: N, next: "...", previous: null, results: [...] }
    Each result looks like:
      {
        id, report_date, crop_health, soil_moisture, pest_observed,
        notes, photo, submitted_at,
        field:  { id, name, location, crop_type, ... },
        agent:  { id, email, full_name, role }
      }
  */
}

export async function submitReport(data) {
  const response = await axiosInstance.post('reports/', data)
  return response.data
  /*
    Expected input shape:
      {
        field_id:     number,    ← PK of an assigned field
        report_date:  "YYYY-MM-DD",
        crop_health:  "excellent"|"good"|"fair"|"poor",
        soil_moisture: number,   ← 0.00 to 100.00
        pest_observed: boolean,
        notes:         string,   ← optional
        photo:         File|null ← optional (multipart form if present)
      }
    Returns the newly created report object (201 Created).
    For photo uploads the caller must send a FormData instance, not a plain object.
  */
}

export async function getFieldReports(fieldId) {
  const response = await axiosInstance.get(`reports/?field=${fieldId}&ordering=-submitted_at`)
  return response.data
  /*
    Fetches reports for a specific field, filtered by the backend's role-scoped queryset:
    - Coordinator: all reports for that field across all agents
    - Field agent:  only their own reports for that field (backend filters by agent=user)
    Used by CoordinatorFieldDetailPage and AgentFieldDetailPage.
    Response is paginated: { count, next, previous, results: [...] }
  */
}
