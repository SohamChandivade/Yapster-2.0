import httpx

_client: httpx.AsyncClient | None = None


def get_http() -> httpx.AsyncClient:
    """Shared outbound HTTP client (FastAPI dependency; tests override it)."""
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=10.0))
    return _client


async def close_http() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
