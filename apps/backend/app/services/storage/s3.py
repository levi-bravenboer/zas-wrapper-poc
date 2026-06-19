from __future__ import annotations

from typing import TYPE_CHECKING

import boto3
from botocore.config import Config

if TYPE_CHECKING:
    from app.core.settings import Settings

# SigV4 signs the request Host header, so a presigned URL is only valid for
# the host it was minted against. We therefore keep two clients:
#   - `_client`     points at the in-network endpoint (`BACKEND_S3_ENDPOINT_URL`)
#                   for any server-side object operations.
#   - `_presigner`  points at the browser-reachable public host
#                   (`BACKEND_S3_PUBLIC_URL`) so minted URLs resolve from the
#                   client's machine instead of an unreachable container name.
# When neither endpoint is set we pass `endpoint_url=None`, which targets the
# real AWS S3 endpoints for the configured region.


class S3Storage:
    def __init__(self, settings: Settings) -> None:
        self._bucket = settings.s3_bucket
        config = Config(signature_version="s3v4")
        common = {
            "service_name": "s3",
            "region_name": settings.s3_region,
            "aws_access_key_id": settings.s3_access_key,
            "aws_secret_access_key": settings.s3_secret_key,
            "config": config,
        }
        endpoint = str(settings.s3_endpoint_url) if settings.s3_endpoint_url else None
        public = str(settings.s3_public_url) if settings.s3_public_url else None
        self._client = boto3.client(endpoint_url=endpoint, **common)
        self._presigner = boto3.client(endpoint_url=public, **common)

    def presign_put(self, key: str, *, content_type: str, expires_in: int = 900) -> str:
        return self._presigner.generate_presigned_url(
            "put_object",
            Params={"Bucket": self._bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=expires_in,
        )

    def presign_get(self, key: str, *, expires_in: int = 900) -> str:
        return self._presigner.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )
