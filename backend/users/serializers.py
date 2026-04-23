from rest_framework import serializers
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
