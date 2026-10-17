"""Disposable real API for cross-repository HTTP acceptance. Never production config."""
import html
import json
import os
from pathlib import Path
import re
import socket
import sys
from urllib.parse import parse_qs, urlsplit

backend_root, port = sys.argv[1], int(sys.argv[2])
assert os.environ["DATABASE_URL"].startswith("sqlite:///")
assert os.environ["APP_ENV"] == "fixture"
sys.path.insert(0, str(Path(backend_root).resolve()))

# Block every provider transport, including accidental startup/background work.
original_connect = socket.socket.connect
original_getaddrinfo = socket.getaddrinfo
def local_connect(self, address):
    if isinstance(address, tuple) and address[0] not in ("127.0.0.1", "::1", "localhost"):
        raise RuntimeError("External network disabled by real API acceptance fixture")
    return original_connect(self, address)
def local_resolve(host, *args, **kwargs):
    if host not in ("127.0.0.1", "::1", "localhost", None):
        raise RuntimeError("External DNS disabled by real API acceptance fixture")
    return original_getaddrinfo(host, *args, **kwargs)
socket.socket.connect = local_connect
socket.getaddrinfo = local_resolve

from cryptography.fernet import Fernet
os.environ["VERIFICATION_OUTBOX_ENCRYPTION_KEY"] = Fernet.generate_key().decode("ascii")
from fastapi import Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
import app.db.models
from app.db.base import Base
from app.db.session import get_engine
from app.db.models.verification_delivery import VerificationEmailOutbox
from app.services.verification_delivery import payload_cipher
from app.services.acquisition import register_artifact
from app.services.usage_service import record_usage
from app.main import app

Base.metadata.create_all(get_engine())
with Session(get_engine()) as db:
    register_artifact(db, dict(id="fixture-artifact", release_id="fixture-release", platform="windows",
        architecture="x64", repository="Nalanaio/Nalana-Fork-IDE", asset_id="123", filename="fixture.exe",
        length=10, sha256="a" * 64, signature_evidence="synthetic acceptance evidence",
        origin_url="https://github.com/Nalanaio/Nalana-Fork-IDE/releases/download/fixture/fixture.exe",
        published=True), resolve=False)
    db.commit()

@app.get("/_fixture/proof/{user_id}", include_in_schema=False)
def proof(user_id: str, x_fixture_key: str = Header()):
    if x_fixture_key != os.environ["FIXTURE_CONTROL_KEY"]:
        raise HTTPException(403)
    with Session(get_engine()) as db:
        row = db.scalar(select(VerificationEmailOutbox).where(VerificationEmailOutbox.user_id == user_id)
            .order_by(VerificationEmailOutbox.created_at.desc()))
        if not row:
            raise HTTPException(404)
        payload = json.loads(payload_cipher().decrypt(row.payload_ciphertext.encode("ascii")))
        link = html.unescape(re.search(r'href="([^"]+)"', payload["html"]).group(1))
        return {"token": parse_qs(urlsplit(link).query)["token"][0]}

@app.post("/_fixture/usage/{user_id}", include_in_schema=False)
def seed_usage(user_id: str, x_fixture_key: str = Header()):
    if x_fixture_key != os.environ["FIXTURE_CONTROL_KEY"]:
        raise HTTPException(403)
    # Exercise real accounting without calling a model or generation provider.
    with Session(get_engine()) as db:
        record_usage(db, user_id, credits_used=7, model="fixture-accounting", input_tokens=20, output_tokens=5)
    return {"recorded": True}

import uvicorn
uvicorn.run(app, host="127.0.0.1", port=port, log_level="error", access_log=False)
