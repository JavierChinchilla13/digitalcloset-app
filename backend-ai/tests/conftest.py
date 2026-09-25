import io
import os
import sys

import pytest
from fastapi.testclient import TestClient
from PIL import Image

# The service is a plain script (server/main.py), not a package - make it
# importable as `main` for the tests.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

import main  # noqa: E402


def make_image_bytes(fmt="PNG", size=(64, 64), color=(200, 30, 30), mode="RGB"):
    """A small real image in the given format."""
    buffer = io.BytesIO()
    Image.new(mode, size, color).save(buffer, format=fmt)
    return buffer.getvalue()


@pytest.fixture
def client():
    return TestClient(main.app)


@pytest.fixture
def fake_remove(monkeypatch):
    """Replaces the model with a stand-in that returns a transparent RGBA PNG,
    recording what it was given. Keeps the API tests fast and model-independent."""
    calls = []

    def _remove(data):
        calls.append(data)
        out = io.BytesIO()
        Image.new("RGBA", (64, 64), (0, 0, 0, 0)).save(out, format="PNG")
        return out.getvalue()

    monkeypatch.setattr(main, "remove", _remove)
    return calls
