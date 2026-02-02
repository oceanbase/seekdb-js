# libseekdb zip download URL config - maintain in one place

# Current: S3 build artifacts
LIBSEEKDB_URL_PREFIX = (
    "https://oceanbase-seekdb-builds.s3.ap-southeast-1.amazonaws.com/libseekdb/all_commits/"
    "347e3a1c7a1af979d4be5fc6a74a5817cf3af7b0/"
)

# Original (kept for reference, commented out):
# LIBSEEKDB_URL_PREFIX = "https://github.com/oceanbase/seekdb/releases/download/v1.1.0/"

# Platforms not supported yet (download still runs; only a warning is printed)
UNSUPPORTED_PLATFORMS = frozenset(["darwin_x64"])


def get_zip_url(platform_zip_name):
    """Return full download URL for the given zip name (e.g. libseekdb-darwin-arm64.zip)."""
    return LIBSEEKDB_URL_PREFIX + platform_zip_name


def is_platform_supported(platform_key):
    """Return whether the platform (e.g. 'darwin_x64') is supported."""
    return platform_key not in UNSUPPORTED_PLATFORMS
