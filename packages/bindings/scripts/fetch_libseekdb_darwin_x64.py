import os
import sys

from fetch_libseekdb import fetch_libseekdb
from libseekdb_url_config import get_zip_url, is_platform_supported

PLATFORM_KEY = "darwin_x64"
ZIP_NAME = "libseekdb-darwin-x64.zip"

if not is_platform_supported(PLATFORM_KEY):
    print("warning: darwin_x64 is not supported yet; download may fail or be unusable.", file=sys.stderr)

zip_url = get_zip_url(ZIP_NAME)
output_dir = os.path.join(os.path.dirname(__file__), "..", "libseekdb")

fetch_libseekdb(zip_url, output_dir)
