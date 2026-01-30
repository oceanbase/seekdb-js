import os
import urllib.request
import zipfile

def fetch_libseekdb(zip_url, output_dir, files):
  # Check if all files already exist
  all_files_exist = True
  if os.path.exists(output_dir):
    for file in files:
      file_path = os.path.join(output_dir, file)
      if not os.path.exists(file_path):
        all_files_exist = False
        break
  else:
    all_files_exist = False
  
  if all_files_exist:
    print("libseekdb files already exist, skipping download")
    return
  
  if not os.path.exists(output_dir):
    os.makedirs(output_dir)
  
  local_zip_path = os.path.join(output_dir, "libseekdb.zip")
  print("fetching: " + zip_url)
  urllib.request.urlretrieve(zip_url, local_zip_path)

  zip = zipfile.ZipFile(local_zip_path)
  for file in files:
    print("extracting: " + file)
    zip.extract(file, output_dir)