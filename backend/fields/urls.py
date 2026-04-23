from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FieldViewSet

router = DefaultRouter()
router.register('', FieldViewSet, basename='field')
# router.register(prefix, viewset, basename)
#
# prefix=''  — the URL prefix for this resource.
#   Because this urls.py is included at '/api/fields/' in config/urls.py,
#   an empty prefix here means the ViewSet lives exactly at /api/fields/.
#   Using '' avoids a double segment like /api/fields/fields/.
#
# basename='field' — used to generate the URL names:
#   field-list     → /api/fields/
#   field-detail   → /api/fields/{id}/
#   These names are used with reverse() and in DRF's browsable API.
#
# What the Router generates automatically:
#   GET    /api/fields/         → FieldViewSet.list()
#   POST   /api/fields/         → FieldViewSet.create()
#   GET    /api/fields/{id}/    → FieldViewSet.retrieve()
#   PUT    /api/fields/{id}/    → FieldViewSet.update()
#   PATCH  /api/fields/{id}/    → FieldViewSet.partial_update()
#   DELETE /api/fields/{id}/    → FieldViewSet.destroy()

urlpatterns = [
    path('', include(router.urls)),
]
