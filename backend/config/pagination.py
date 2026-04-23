from rest_framework.pagination import PageNumberPagination


class StandardResultsPagination(PageNumberPagination):
    """
    Project-wide default pagination class.

    DRF's built-in PageNumberPagination does everything we need, but its
    defaults are controlled by REST_FRAMEWORK['PAGE_SIZE'] in settings.py.
    We subclass it here so we can also expose page_size_query_param and
    cap the maximum page size the client is allowed to request.

    Result shape (when a list endpoint is paginated):
    {
        "count":    42,           ← total number of matching records
        "next":     "http://...", ← URL to fetch the next page (null if last page)
        "previous": "http://...", ← URL to fetch the previous page (null if first page)
        "results":  [ ... ]       ← the actual records for this page
    }

    Query parameters:
        ?page=2             → fetch the second page
        ?page_size=50       → override the default page size (max 100)
    """
    page_size            = 20
    # Default: 20 records per page. Matches REST_FRAMEWORK['PAGE_SIZE'] in settings.py.
    # PAGE_SIZE in settings acts as the global default; this attribute takes
    # precedence for any view that uses this pagination class directly.

    page_size_query_param = 'page_size'
    # Lets the client control how many results they get per request.
    # Without this, the page size is fixed and the client cannot change it.
    # Example: GET /api/fields/?page_size=50

    max_page_size        = 100
    # Safety cap: even if the client requests ?page_size=10000, they get at most 100.
    # Prevents accidentally dumping thousands of records in one response.
