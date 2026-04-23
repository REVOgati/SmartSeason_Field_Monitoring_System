from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from .models import User


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Used for: POST /api/auth/register/
    Accepts user input to create a brand-new account.

    Why ModelSerializer?
    ModelSerializer automatically maps model fields to serializer fields.
    You declare the model and the field list — DRF generates all the
    field definitions, validators, and the default create() for you.
    You only override what needs custom behaviour.

    What this serializer does:
    1. Accepts email, full_name, role, password, password2
    2. Validates that password == password2
    3. Validates that role is not 'superuser' (no one signs up as superuser)
    4. Creates the user with a properly hashed password via set_password()
    5. Returns the saved user object
    """

    password = serializers.CharField(
        write_only=True,
        # write_only=True means this field is accepted on input but NEVER returned
        # in the response JSON. Password hashes must never leak through the API.
        min_length=8,
        # DRF validates this automatically — no extra code needed
        style={'input_type': 'password'},
        # This affects the DRF browsable API UI — renders a password input box
    )

    password2 = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'},
        # Confirmation field — compared against password in validate()
        # Not a model field, so we declare it manually here rather than
        # listing it under Meta.fields
    )

    class Meta:
        model  = User
        fields = ['email', 'full_name', 'role', 'password', 'password2']
        # Only these fields are accepted on registration.
        # is_verified, is_active, is_staff are NOT here — they default to False
        # on the model. No user can sign up and self-verify.

    def validate_role(self, value):
        """
        Field-level validator for the role field.

        DRF calls validate_<fieldname>(self, value) automatically for every field.
        If you return the value, validation passes.
        If you raise serializers.ValidationError, it fails with that message.

        Blocks 'superuser' role from self-registration.
        Superusers are created only via manage.py createsuperuser.
        """
        if value == 'superuser':
            raise serializers.ValidationError(
                "You cannot register as a superuser."
            )
        return value

    def validate(self, data):
        """
        Cross-field validator — runs AFTER all individual field validators pass.

        The `data` parameter is a dictionary of all validated field values.
        This is the right place to compare multiple fields against each other.

        Here we confirm the two passwords match before we attempt to save.
        If they don't match, the user gets a clear error message.
        """
        if data['password'] != data['password2']:
            raise serializers.ValidationError(
                {"password2": "Passwords do not match."}
            )
        return data

    def create(self, validated_data):
        """
        Called by serializer.save() when creating a new record.
        `validated_data` is the clean dictionary from validate() — all checks passed.

        Why override create()?
        The default ModelSerializer create() does a simple Model(**data).save().
        That would store the raw password string in plain text — a critical
        security vulnerability.

        We must:
        1. Pop password2 out (it's not a model field, we can't pass it to User())
        2. Pop password out as well
        3. Call User.objects.create_user() which calls set_password() internally,
           hashing the password with PBKDF2 before it touches the database.
        """
        validated_data.pop('password2')
        # Remove the confirmation field — User model has no password2 column

        password = validated_data.pop('password')
        # Remove the plain password from the dict before we pass it to create_user

        user = User.objects.create_user(password=password, **validated_data)
        # create_user() from our UserManager:
        #   - normalises email (lowercased domain)
        #   - calls set_password(password) → hashes it using Django's PBKDF2 hasher
        #   - saves and returns the User instance

        return user
        # This return value becomes serializer.data in the view,
        # but since password is write_only, it won't appear in the response JSON


class UserPublicSerializer(serializers.ModelSerializer):
    """
    Used for: embedding coordinator or agent info inside other serializers.
    For example, FieldSerializer nests this to show who the coordinator is.

    This is a READ-ONLY serializer — no create/update logic needed.
    It exposes only safe, non-sensitive fields.

    Why a separate small serializer instead of reusing the full profile one?
    - Keeps API responses lean — you don't want the full profile every time
    - Avoids accidentally exposing sensitive fields in nested contexts
    - A coordinator's nested summary in a Field response needs only name + email + role
    """

    class Meta:
        model  = User
        fields = ['id', 'email', 'full_name', 'role']
        read_only_fields = ['id', 'email', 'full_name', 'role']
        # Every field is read-only. This serializer is only used
        # inside other serializers for reading — never for input.


class AgentPoolSerializer(serializers.ModelSerializer):
    """
    Used for: GET /api/agents/pool/ and GET /api/agents/my-team/

    A READ-ONLY snapshot of a field agent for coordinator-facing list views.
    Coordinators use this to browse the pool and decide who to assign to their team.

    Fields exposed:
    - id         → the PK the coordinator passes to POST /api/agents/{id}/assign/
    - email      → account identity, avoids confusion between people with similar names
    - full_name  → display name
    - date_joined → how long they have been registered in the system
                    (older = more established; useful context for the coordinator)

    coordinator is deliberately NOT exposed here.
    - Pool agents have coordinator=NULL (meaningless to show)
    - My-team agents all have coordinator=<requesting user> (already obvious)
    Both lists are filtered server-side, so there is no ambiguity.

    Why a dedicated serializer instead of reusing UserPublicSerializer?
    UserPublicSerializer shows 'role' — redundant here because every agent
    on these endpoints IS a field_agent. We swap role for date_joined, which
    is more useful context in a team-browsing scenario.
    """

    class Meta:
        model  = User
        fields = ['id', 'email', 'full_name', 'date_joined']
        read_only_fields = ['id', 'email', 'full_name', 'date_joined']


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Used for: GET /api/auth/me/ and PATCH /api/auth/me/

    A logged-in user can READ their full profile and UPDATE limited fields.
    They cannot change their own role, verification status, or password here
    (password changes would get their own endpoint with current_password checks).

    Fields returned: a complete safe snapshot of the user's own account.
    Fields writable: only full_name and profile_photo.

    extra_kwargs lets you add options to fields that were auto-generated
    by ModelSerializer (from the model) without rewriting the full field declaration.
    """

    class Meta:
        model  = User
        fields = [
            'id', 'email', 'full_name', 'role', 'coordinator',
            'is_verified', 'is_active', 'date_joined', 'profile_photo',
        ]
        read_only_fields = [
            'id', 'email', 'role', 'coordinator',
            'is_verified', 'is_active', 'date_joined',
        ]
        # email — login identifier, changing it would break existing JWTs.
        #         A dedicated change-email flow with password confirmation is needed
        #         for that — not scope for a simple profile update.
        # role — only a superuser should reassign roles; not self-editable
        # coordinator — set by the superuser in Django Admin, not self-assigned
        # is_verified, is_active — set by superuser only
        # date_joined — historical timestamp, never editable


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends SimpleJWT's default login serializer to:
    1. Embed extra claims in the token payload (role, full_name, is_verified)
    2. Block login for accounts that have not been verified by a superuser

    Why extend TokenObtainPairSerializer?
    SimpleJWT's default token contains only: token_type, exp, iat, jti, user_id
    That's intentionally minimal. We add our own claims on top of those defaults.

    The token's payload after our customisation:
    {
        "token_type": "access",
        "exp": 1714000000,
        "iat": 1713996400,
        "jti": "abc123...",
        "user_id": 3,
        "role": "coordinator",        ← added
        "full_name": "Jane Coord",    ← added
        "email": "jane@example.com"   ← added
    }

    The React frontend decodes this payload from the access token (JWT is just
    Base64 — you can decode it without the secret key) and knows immediately:
    - Which dashboard to render (coordinator vs agent)
    - What name to show in the navbar
    - What email to display in the profile section
    All without making a second API call to /api/auth/me/.
    """

    @classmethod
    def get_token(cls, user):
        """
        get_token() is a class method called by the parent's validate()
        to actually mint (create) the token.

        super().get_token(user) creates the base token with the standard
        SimpleJWT claims. We then add our own custom claims on top.

        These claims are embedded in BOTH the access token AND the refresh token
        because get_token() builds the base token that both are derived from.
        """
        token = super().get_token(user)

        # Add custom claims — these become part of the JWT payload
        token['role']      = user.role
        token['full_name'] = user.full_name
        token['email']     = user.email
        # Note: never embed sensitive data like passwords or tokens-in-tokens here.
        # Role, name, and email are safe — they're already known to the user.

        return token

    def validate(self, attrs):
        """
        validate() runs after credential checking (email + password).
        The parent's validate() raises AuthenticationFailed if credentials are wrong,
        then returns a dict with 'access' and 'refresh' token strings if they're correct.

        We call super().validate(attrs) first to let SimpleJWT do its credential check.
        After that passes, self.user is populated with the authenticated User instance.
        We then add our own gate: reject verified=False accounts even if the password
        was correct. This is the second enforcement layer (the admin panel is the first).

        attrs is a dict: {'email': '...', 'password': '...'}
        data is the return value of super().validate() — the token pair dict.
        """
        data = super().validate(attrs)
        # At this point credentials are valid and self.user is set

        if not self.user.is_verified:
            raise AuthenticationFailed(
                'Your account has not been verified yet. '
                'Please wait for an administrator to approve your account.'
            )
            # AuthenticationFailed → HTTP 401 with a clear message.
            # We do NOT raise this before calling super() because we don't want
            # to give attackers information about whether an email exists in the
            # system before they even provide a correct password.

        return data
        # data contains: {'access': 'eyJ...', 'refresh': 'eyJ...'}
        # This is what gets sent back to the client as the login response.
