# libseekdb zip download URL config

# Current: S3 build artifacts
LIBSEEKDB_URL_PREFIX = (
    "https://oceanbase-seekdb-builds.s3.ap-southeast-1.amazonaws.com/libseekdb/all_commits/"
    "347e3a1c7a1af979d4be5fc6a74a5817cf3af7b0/"
)

# LIBSEEKDB_URL_PREFIX = "https://github.com/oceanbase/seekdb/releases/download/v1.1.0/"

def get_zip_url(platform_zip_name):
    """Return full download URL for the given zip name (e.g. libseekdb-darwin-arm64.zip)."""
    return LIBSEEKDB_URL_PREFIX + platform_zip_name
