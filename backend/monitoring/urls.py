from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FieldReportViewSet

router = DefaultRouter()
router.register(r'', FieldReportViewSet, basename='fieldreport')
# Registers FieldReportViewSet at the root of this URL module.
# The 'api/reports/' prefix is applied in config/urls.py when this module is included.
# basename='fieldreport' is used by DRF to name the generated URL patterns:
#   fieldreport-list    → /api/reports/
#   fieldreport-detail  → /api/reports/{id}/

urlpatterns = [
    path('', include(router.urls)),
]
