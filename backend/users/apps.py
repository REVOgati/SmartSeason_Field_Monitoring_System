from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self):
        """
        ready() is called once by Django after all apps are loaded.
        Importing signals.py here connects all @receiver decorators
        to their signals. Without this import, the signals file exists
        but Django never loads it, so the receivers never fire.
        """
        import users.signals  # noqa: F401
        # noqa: F401 tells the linter not to warn about "imported but unused"
        # We import it purely for its side effects (registering the receivers)
