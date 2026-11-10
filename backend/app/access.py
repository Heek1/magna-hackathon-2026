"""Optional access key for the public demo.

With ACCESS_KEY set, nothing is served (app, API, docs) until the visitor opens a link with
`?key=<ACCESS_KEY>`. That link sets a long-lived cookie and redirects to the same page without the
key, so the QR code only has to be scanned once per phone. Without ACCESS_KEY everything is open,
as in local development.
"""
from __future__ import annotations

import hmac
from urllib.parse import urlencode

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

COOKIE = "oee_access"
MAX_AGE = 60 * 60 * 24 * 60  # 60 days
# Files the browser fetches without cookies to install the PWA; they reveal nothing.
# /api/health is for the hosting platform's health check and answers only {"ok": true}.
PUBLIC_PATHS = {"/api/health", "/manifest.webmanifest", "/pwa-192.png", "/pwa-512.png", "/apple-touch-icon.png", "/favicon.ico"}

LOCKED_PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>OEE Engine</title>
<style>
body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#F3F4F7;color:#0B0D12;
font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px;box-sizing:border-box}
.card{background:#fff;border-radius:22px;padding:28px 24px;max-width:340px;width:100%;
box-shadow:0 1px 2px rgba(16,24,40,.04),0 8px 24px -4px rgba(16,24,40,.06)}
h1{font-size:22px;margin:0 0 6px}p{color:#5F6672;font-size:15px;line-height:1.45;margin:0 0 18px}
input{width:100%;box-sizing:border-box;height:48px;border:1px solid #E6E8EC;border-radius:14px;padding:0 14px;font-size:16px}
button{margin-top:10px;width:100%;height:50px;border:0;border-radius:18px;background:#0E1116;color:#fff;font-size:16px;font-weight:600}
.err{color:#E5243B;font-size:13px;margin:8px 0 0}
</style></head><body><form class="card" method="get" action="/">
<h1>OEE Engine</h1><p>This demo is private until the end of the hackathon. Scan the QR code from the
presentation or enter the access key.</p>
<input name="key" placeholder="Access key" autocomplete="off" autocapitalize="off" spellcheck="false" required>
__ERROR__<button type="submit">Open</button></form></body></html>"""


def install(app: FastAPI, key: str | None) -> None:
    """Protect every route with `key`. No-op when key is empty."""
    if not key:
        return

    def valid(value: str | None) -> bool:
        return bool(value) and hmac.compare_digest(value, key)

    @app.middleware("http")
    async def require_key(request: Request, call_next):
        path = request.url.path
        if path in PUBLIC_PATHS or valid(request.cookies.get(COOKIE)):
            return await call_next(request)

        given = request.query_params.get("key")
        if valid(given):
            rest = {k: v for k, v in request.query_params.items() if k != "key"}
            target = path + (f"?{urlencode(rest)}" if rest else "")
            response = RedirectResponse(target, status_code=303)
            response.set_cookie(COOKIE, key, max_age=MAX_AGE, httponly=True, samesite="lax",
                                secure=request.url.scheme == "https" or
                                request.headers.get("x-forwarded-proto") == "https")
            return response

        if path.startswith("/api/") or path in ("/docs", "/redoc", "/openapi.json"):
            return JSONResponse({"detail": "Access key required"}, status_code=401)
        error = '<p class="err">That key is not valid.</p>' if given else ""
        return HTMLResponse(LOCKED_PAGE.replace("__ERROR__", error), status_code=401,
                            headers={"Cache-Control": "no-store"})
