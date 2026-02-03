import os
import shutil
import sys
import urllib.request
import zipfile


def _reporthook(block_num, block_size, total_size):
  if total_size <= 0:
    downloaded = block_num * block_size
    print("  downloaded %.1f MB" % (downloaded / (1024 * 1024)), file=sys.stderr)
  else:
    downloaded = min(block_num * block_size, total_size)
    pct = 100.0 * downloaded / total_size
    print("  %.0f%% (%.1f / %.1f MB)" % (pct, downloaded / (1024 * 1024), total_size / (1024 * 1024)), file=sys.stderr)
  sys.stderr.flush()


def fetch_libseekdb(zip_url, output_dir, local_zip_name):
  """
  Download zip from zip_url and extract all contents into output_dir.
  local_zip_name: filename for the local zip (e.g. libseekdb-darwin-arm64.zip).
  """
  if not os.path.exists(output_dir):
    os.makedirs(output_dir)

  local_zip_path = os.path.join(output_dir, local_zip_name)
  print("fetching: " + zip_url)
  urllib.request.urlretrieve(zip_url, local_zip_path, reporthook=_reporthook)
  print(file=sys.stderr)

  print("extracting to " + output_dir)
  zf = zipfile.ZipFile(local_zip_path)
  names = zf.namelist()
  n = len(names)
  for i, name in enumerate(names):
    zf.extract(name, output_dir)
    print("\r  %d/%d %s" % (i + 1, n, name), end="", file=sys.stderr)
    sys.stderr.flush()
  print(file=sys.stderr)
  zf.close()

  # If extracted archive has a libs dir, copy it to pkgs/js-bindings/libs (all platforms).
  module_root = os.path.dirname(output_dir)
  src_libs = os.path.join(output_dir, "libs")
  dst_libs = os.path.join(module_root, "pkgs", "js-bindings", "libs")
  if os.path.isdir(src_libs):
    os.makedirs(os.path.dirname(dst_libs), exist_ok=True)
    shutil.copytree(src_libs, dst_libs, dirs_exist_ok=True)