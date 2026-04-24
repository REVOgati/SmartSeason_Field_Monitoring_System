from django.core.management.base import BaseCommand
from django.conf import settings
from decouple import config


class Command(BaseCommand):
    """
    ensure_superuser — idempotent superuser creation for automated deployments.

    Called in the Heroku Procfile release phase on every deploy:
        release: python manage.py migrate && python manage.py ensure_superuser

    The command reads credentials from environment variables and creates a
    superuser ONLY if no superuser exists yet. On subsequent deploys the
    check short-circuits immediately, so there is no risk of duplicates or
    errors in CI/CD pipelines.

    Required environment variables:
        DJANGO_SUPERUSER_EMAIL     — admin login email
        DJANGO_SUPERUSER_PASSWORD  — admin login password
        DJANGO_SUPERUSER_FULLNAME  — displayed name in the admin panel
    """

    help = 'Create a superuser from env vars if none exists (idempotent).'

    def handle(self, *args, **options):
        # Import here to avoid issues if AUTH_USER_MODEL isn't ready at module load
        from django.contrib.auth import get_user_model
        User = get_user_model()

        email     = config('DJANGO_SUPERUSER_EMAIL',    default='')
        password  = config('DJANGO_SUPERUSER_PASSWORD', default='')
        fullname  = config('DJANGO_SUPERUSER_FULLNAME', default='Admin')

        if not email or not password:
            self.stdout.write(self.style.WARNING(
                'ensure_superuser: DJANGO_SUPERUSER_EMAIL or DJANGO_SUPERUSER_PASSWORD '
                'not set — skipping superuser creation.'
            ))
            return

        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write(self.style.SUCCESS(
                'ensure_superuser: Superuser already exists — skipping.'
            ))
            return

        User.objects.create_superuser(
            email=email,
            password=password,
            full_name=fullname,
        )
        self.stdout.write(self.style.SUCCESS(
            f'ensure_superuser: Superuser "{email}" created successfully.'
        ))
