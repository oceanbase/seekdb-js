import os
import urllib.request
import zipfile


def fetch_libseekdb(zip_url, output_dir):
  """
  Download zip from zip_url and extract all contents into output_dir.
  """
  if not os.path.exists(output_dir):
    os.makedirs(output_dir)

  local_zip_path = os.path.join(output_dir, "libseekdb.zip")
  print("fetching: " + zip_url)
  urllib.request.urlretrieve(zip_url, local_zip_path)

  print("extracting all files to " + output_dir)
  zf = zipfile.ZipFile(local_zip_path)
  zf.extractall(output_dir)
  zf.close()