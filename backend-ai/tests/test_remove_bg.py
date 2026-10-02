import io
import os

import pytest
from PIL import Image

import main
from conftest import make_image_bytes

# Blueprint Phase 5, area 7 ("Python AI"): valid image -> PNG, PNG has an alpha
# channel, non-image -> 4xx, no leaked exception text. Plus the size/empty
# guards and CORS that main.py documents.

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def post_file(client, data, content_type="image/png", name="shirt.png"):
    return client.post("/remove-bg", files={"file": (name, data, content_type)})


class TestHealth:
    def test_health(self, client):
        response = client.get("/health")

        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


class TestRemoveBackgroundContract:
    def test_valid_image_returns_a_png(self, client, fake_remove):
        response = post_file(client, make_image_bytes("PNG"))

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.content.startswith(PNG_SIGNATURE)
        assert "processed_shirt.png" in response.headers["content-disposition"]

    def test_the_uploaded_bytes_are_what_reaches_the_model(self, client, fake_remove):
        original = make_image_bytes("PNG")

        post_file(client, original)

        assert fake_remove == [original]

    @pytest.mark.parametrize(
        "fmt,content_type",
        [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")],
    )
    def test_common_formats_are_accepted(self, client, fake_remove, fmt, content_type):
        response = post_file(client, make_image_bytes(fmt), content_type=content_type)

        assert response.status_code == 200


class TestRejectedInput:
    def test_non_image_content_type_is_415(self, client, fake_remove):
        response = post_file(client, b"just some text", content_type="text/plain", name="notes.txt")

        assert response.status_code == 415
        assert fake_remove == [], "the model must not run on rejected input"

    def test_missing_content_type_is_rejected(self, client, fake_remove):
        response = client.post("/remove-bg", files={"file": ("x", b"abc", "")})

        assert response.status_code in (415, 422)
        assert fake_remove == []

    def test_no_file_at_all_is_422(self, client, fake_remove):
        response = client.post("/remove-bg")

        assert response.status_code == 422

    def test_empty_file_is_400(self, client, fake_remove):
        response = post_file(client, b"")

        assert response.status_code == 400
        assert fake_remove == []

    def test_oversized_file_is_413(self, client, fake_remove):
        too_big = b"\x00" * (main.MAX_FILE_SIZE_BYTES + 1)

        response = post_file(client, too_big)

        assert response.status_code == 413
        assert fake_remove == []

    def test_a_file_at_the_limit_is_not_rejected_for_size(self, client, fake_remove):
        # Not a valid image, so it may be rejected for that - but never as 413.
        at_limit = b"\x00" * main.MAX_FILE_SIZE_BYTES

        response = post_file(client, at_limit)

        assert response.status_code != 413

    def test_bytes_that_are_not_an_image_are_a_client_error(self, client, fake_remove):
        # Claims to be a PNG, but is not - the Content-Type header alone is no
        # proof. Must be a 4xx, and the model must never see it.
        response = post_file(client, b"this is definitely not a png", content_type="image/png")

        assert 400 <= response.status_code < 500, response.text
        assert fake_remove == []


class TestNoLeakedErrors:
    def test_model_failure_is_a_generic_500(self, client, monkeypatch):
        def boom(_data):
            raise RuntimeError("/srv/secret/model/path.onnx failed: CUDA out of memory")

        monkeypatch.setattr(main, "remove", boom)

        response = post_file(client, make_image_bytes("PNG"))

        assert response.status_code == 500
        assert response.json() == {"detail": "Failed to process image"}
        for leaked in ("secret", "CUDA", "onnx", "RuntimeError", "Traceback"):
            assert leaked not in response.text

    def test_the_real_error_is_logged_server_side(self, client, monkeypatch, caplog):
        def boom(_data):
            raise RuntimeError("inner detail")

        monkeypatch.setattr(main, "remove", boom)

        with caplog.at_level("ERROR", logger="digital_closet_ai"):
            post_file(client, make_image_bytes("PNG"))

        assert "inner detail" in caplog.text


class TestCors:
    def test_configured_origin_is_allowed(self, client):
        response = client.get("/health", headers={"Origin": "http://localhost:5173"})

        assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"

    def test_other_origins_get_no_cors_header(self, client):
        response = client.get("/health", headers={"Origin": "https://evil.example.com"})

        assert "access-control-allow-origin" not in response.headers

    def test_credentials_are_not_allowed(self, client):
        response = client.get("/health", headers={"Origin": "http://localhost:5173"})

        assert "access-control-allow-credentials" not in response.headers


# The one place the actual model runs: proves "PNG contains alpha channel"
# for real, not against a stand-in. Skipped unless the U2-Net weights are
# already on this machine - the test never triggers the 170MB download.
MODEL_FILE = os.path.join(os.path.expanduser("~"), ".u2net", "u2net.onnx")


@pytest.mark.real_model
@pytest.mark.skipif(not os.path.exists(MODEL_FILE), reason="U2-Net model not downloaded locally")
class TestRealModel:
    def test_output_is_a_png_with_an_alpha_channel(self, client):
        # A red rectangle on a white background: something to cut out.
        image = Image.new("RGB", (160, 160), (255, 255, 255))
        for x in range(50, 110):
            for y in range(40, 120):
                image.putpixel((x, y), (200, 20, 20))
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")

        response = post_file(client, buffer.getvalue())

        assert response.status_code == 200
        assert response.content.startswith(PNG_SIGNATURE)
        result = Image.open(io.BytesIO(response.content))
        assert result.format == "PNG"
        assert result.mode == "RGBA"
        assert result.size == (160, 160)
