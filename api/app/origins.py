import re

from app.config import get_settings

# localhost plus RFC 1918 ranges, any port: the phone on the hotspot reaches the laptop this way.
PRIVATE_ORIGIN_REGEX = (
    r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+"
    r"|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$"
)
_PRIVATE = re.compile(PRIVATE_ORIGIN_REGEX)


def is_allowed_origin(origin: str) -> bool:
    """Same policy as CORS: configured origins, plus private networks in dev."""
    s = get_settings()
    if origin in s.cors_origins or origin == s.public_web_url.rstrip("/"):
        return True
    return s.cors_allow_private_networks and _PRIVATE.match(origin) is not None
