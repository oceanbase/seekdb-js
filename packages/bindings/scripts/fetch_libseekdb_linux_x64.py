import os
from fetch_libseekdb import fetch_libseekdb

zip_url = "https://github.com/oceanbase/seekdb/releases/download/v1.1.0/libseekdb-linux-x64.zip"
output_dir = os.path.join(os.path.dirname(__file__), "..", "libseekdb")
files = [
  "seekdb.h",
  "libseekdb.so",
]

fetch_libseekdb(zip_url, output_dir, files)
