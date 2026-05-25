# libseekdb zip download URL config

LIBSEEKDB_URL_PREFIX = "https://oceanbase-seekdb-builds.s3.ap-southeast-1.amazonaws.com/libseekdb/all_commits/08f10d5b0b63bd4bb8bd75e3276cc8cceb278e93/"

# LIBSEEKDB_URL_PREFIX = "https://github.com/oceanbase/seekdb/releases/download/v1.1.0/"

def get_zip_url(platform_zip_name):
    """Return full download URL for the given zip name (e.g. libseekdb-darwin-arm64.zip)."""
    return LIBSEEKDB_URL_PREFIX + platform_zip_name
