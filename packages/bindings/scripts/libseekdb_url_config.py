# libseekdb zip download URL config

LIBSEEKDB_URL_PREFIX = "https://oceanbase-seekdb-builds.s3.ap-southeast-1.amazonaws.com/libseekdb/all_commits/fd681fdabfe8b5a2191b11007b70641e1a091c13/"

# LIBSEEKDB_URL_PREFIX = "https://github.com/oceanbase/seekdb/releases/download/v1.1.0/"

def get_zip_url(platform_zip_name):
    """Return full download URL for the given zip name (e.g. libseekdb-darwin-arm64.zip)."""
    return LIBSEEKDB_URL_PREFIX + platform_zip_name
