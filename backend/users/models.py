from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin


class UserManager(BaseUserManager):
    """
    Default manager — handles account creation.
    User.objects.all() returns ALL users regardless of status.
    """
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_verified', True)
        extra_fields.setdefault('role', 'superuser')
        return self.create_user(email, password, **extra_fields)


class VerifiedUserManager(models.Manager):
    """
    Custom manager that returns only verified and active users.
    Usage: User.verified.all()
    Usage: User.verified.filter(role='coordinator')

    Extends models.Manager (not BaseUserManager) because this manager
    is for querying, not for creating users. BaseUserManager adds
    create_user/create_superuser — not needed here.

    get_queryset() is the foundation method of every manager.
    Every .filter(), .all(), .get() call starts from the queryset
    returned by get_queryset(). By overriding it here, we bake in
    the is_verified and is_active filters permanently for this manager.
    """
    def get_queryset(self):
        return super().get_queryset().filter(
            is_verified=True,
            is_active=True
        )


class CoordinatorManager(models.Manager):
    """
    Returns only verified, active coordinators.
    Usage: User.coordinators.all()
    Usage: User.coordinators.get(id=5)

    Used in views and serializers where you need to list or
    validate coordinator accounts without repeating the filter logic.
    """
    def get_queryset(self):
        return super().get_queryset().filter(
            role='coordinator',
            is_verified=True,
            is_active=True
        )


class FieldAgentManager(models.Manager):
    """
    Returns only verified, active field agents.
    Usage: User.field_agents.all()             → all verified agents system-wide
    Usage: User.field_agents.for_coordinator(coordinator_user)
                                               → agents under a specific coordinator

    Used when a coordinator assigns an agent to a field —
    only their own verified active agents should be assignable.
    """
    def get_queryset(self):
        return super().get_queryset().filter(
            role='field_agent',
            is_verified=True,
            is_active=True
        )

    def for_coordinator(self, coordinator):
        """
        Filter agents that belong to a specific coordinator.
        Usage: User.field_agents.for_coordinator(request.user)
        Returns all verified active agents whose coordinator FK points to this user.
        """
        return self.get_queryset().filter(coordinator=coordinator)


class User(AbstractBaseUser, PermissionsMixin):

    ROLE_CHOICES = [
        ('superuser', 'Superuser'),
        ('coordinator', 'Coordinator'),
        ('field_agent', 'Field Agent'),
    ]

    email         = models.EmailField(unique=True)
    full_name     = models.CharField(max_length=255)
    role          = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_active     = models.BooleanField(default=False)
    is_verified   = models.BooleanField(default=False)
    is_staff      = models.BooleanField(default=False)
    date_joined   = models.DateTimeField(auto_now_add=True)
    profile_photo = models.ImageField(upload_to='profile_photos/', null=True, blank=True)

    coordinator = models.ForeignKey(
        'self',
        # Self-referential FK — a User (field agent) points to another User (coordinator).
        # 'self' means "same model" — Django resolves this correctly.
        on_delete=models.SET_NULL,
        # SET_NULL: if the coordinator account is deleted, the agent's coordinator
        # field becomes null. The agent record is preserved.
        null=True,
        blank=True,
        # null=True: coordinators and superusers have no coordinator — stored as NULL.
        # blank=True: makes it optional in forms and admin.
        related_name='team_agents',
        # coordinator_user.team_agents.all() returns all agents under that coordinator.
        limit_choices_to={'role': 'coordinator'},
        # Admin dropdown only shows coordinator-role users as valid choices.
    )

    # Multiple managers attached to the same model.
    # Each manager is a named attribute — User.<name>.all()
    objects      = UserManager()       # User.objects.all()     → all users (default)
    verified     = VerifiedUserManager()  # User.verified.all()    → verified + active only
    coordinators = CoordinatorManager()   # User.coordinators.all()→ coordinators only
    field_agents = FieldAgentManager()    # User.field_agents.all()→ field agents only

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        verbose_name        = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.full_name} ({self.email}) - {self.role}"
