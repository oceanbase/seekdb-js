import os

from fetch_libseekdb import fetch_libseekdb
from libseekdb_url_config import get_zip_url

ZIP_NAME = "libseekdb-linux-x64.zip"
zip_url = get_zip_url(ZIP_NAME)
output_dir = os.path.join(os.path.dirname(__file__), "..", "libseekdb")

fetch_libseekdb(zip_url, output_dir, "libseekdb.zip")
