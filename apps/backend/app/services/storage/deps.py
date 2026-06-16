from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.core.settings import SettingsDep
from app.services.storage.s3 import S3Storage


def get_storage(settings: SettingsDep) -> S3Storage:
    return S3Storage(settings)


StorageDep = Annotated[S3Storage, Depends(get_storage)]
