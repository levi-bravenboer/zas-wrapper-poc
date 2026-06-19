from app.services.storage.deps import StorageDep, get_storage
from app.services.storage.s3 import S3Storage

__all__ = [
    "S3Storage",
    "StorageDep",
    "get_storage",
]
