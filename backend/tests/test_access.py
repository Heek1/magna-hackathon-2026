from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import access


def make(key):
    app = FastAPI()
    access.install(app, key)

    @app.get("/api/state")
    def state():
        return {"ok": True}

    @app.get("/{path:path}")
    def page(path: str):
        return {"page": path}

    return TestClient(app, base_url="https://testserver")


def test_open_without_key():
    c = make(None)
    assert c.get("/api/state").status_code == 200


def test_locked_without_cookie():
    c = make("s3cret")
    assert c.get("/api/state").status_code == 401
    r = c.get("/errors/ST-038")
    assert r.status_code == 401 and "Access key" in r.text
    assert c.get("/manifest.webmanifest").status_code == 200  # PWA install works
    bad = c.get("/", params={"key": "nope"})
    assert bad.status_code == 401 and "not valid" in bad.text


def test_key_link_sets_cookie_and_strips_key():
    c = make("s3cret")
    r = c.get("/errors/ST-038", params={"key": "s3cret", "tab": "stop"}, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/errors/ST-038?tab=stop"
    assert "httponly" in r.headers["set-cookie"].lower()
    assert c.get("/api/state").status_code == 200  # cookie kept by the client
