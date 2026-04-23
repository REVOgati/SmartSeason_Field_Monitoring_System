from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from .models import User


@receiver(pre_save, sender=User)
def ensure_verified_users_are_active(sender, instance, **kwargs):
    """
    Signal: fires BEFORE every User save, whether from admin, API, or shell.

    Rule enforced here: if a user is being set to is_verified=True,
    automatically set is_active=True at the same time.
    This keeps the two flags in sync at the model level — not just in the admin.

    Parameters:
      sender   — the model class that sent the signal (User)
      instance — the specific User object about to be saved
      kwargs   — contains 'created' (True=new record, False=update) among others

    Note: pre_save fires before the record reaches the database,
    so changes to instance here are included in the save automatically.
    """
    if instance.is_verified and not instance.is_active:
        instance.is_active = True


@receiver(post_save, sender=User)
def log_new_user_registration(sender, instance, created, **kwargs):
    """
    Signal: fires AFTER every User save.

    'created' is True only when a brand new record is inserted.
    'created' is False on every subsequent update to an existing record.

    Current behaviour: logs new registrations to the console.
    In a production system this is where you would trigger an internal
    notification to the superuser that a new account is pending verification.
    We keep it as a print/log for now — Session 21 covers email notifications.

    Parameters:
      sender   — the model class (User)
      instance — the User object that was just saved
      created  — True if this was a new INSERT, False if an UPDATE
      kwargs   — extra keyword arguments Django passes through
    """
    if created:
        print(
            f"[SmartSeason] New account registered: {instance.full_name} "
            f"({instance.email}) | Role: {instance.role} | "
            f"Pending verification: {not instance.is_verified}"
        )


@receiver(post_save, sender=User)
def log_account_approval(sender, instance, created, **kwargs):
    """
    Separate post_save receiver on the same model — Django allows multiple
    receivers on the same signal. Each runs independently.

    This one logs when an existing account transitions to verified+active.
    created=False means this is an update to an existing record.
    We check both flags to confirm this is an approval event specifically.
    """
    if not created and instance.is_verified and instance.is_active:
        print(
            f"[SmartSeason] Account approved: {instance.full_name} "
            f"({instance.email}) | Role: {instance.role} | "
            f"Can now log in: True"
        )
