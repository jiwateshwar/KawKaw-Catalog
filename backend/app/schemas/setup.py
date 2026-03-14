from pydantic import BaseModel, field_validator


class SetupStatus(BaseModel):
    setup_complete: bool
    media_accessible: bool
    media_root: str
    file_count: int


class SetupRequest(BaseModel):
    admin_username: str
    admin_password: str
    admin_password_confirm: str
    app_title: str = "KawKaw Catalog"
    app_description: str | None = None

    @field_validator("admin_username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username may only contain letters, numbers, hyphens, and underscores")
        return v

    @field_validator("admin_password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("admin_password_confirm")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "admin_password" in info.data and v != info.data["admin_password"]:
            raise ValueError("Passwords do not match")
        return v
