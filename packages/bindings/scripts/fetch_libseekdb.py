import os
import platform
import shutil
import sys
import urllib.request
import zipfile


def _reporthook(block_num, block_size, total_size):
  if total_size <= 0:
    downloaded = block_num * block_size
    print("  downloaded %.1f MB" % (downloaded / (1024 * 1024)), file=sys.stderr)
    sys.stderr.flush()
    return
  downloaded = min(block_num * block_size, total_size)
  pct = 100.0 * downloaded / total_size
  pct_int = int(pct)
  if not hasattr(_reporthook, "_last_pct"):
    _reporthook._last_pct = -1
  if pct_int > _reporthook._last_pct or downloaded >= total_size:
    _reporthook._last_pct = pct_int
    print("  %.0f%% (%.1f / %.1f MB)" % (pct, downloaded / (1024 * 1024), total_size / (1024 * 1024)), file=sys.stderr)
    sys.stderr.flush()


def _ensure_output_dir_valid(output_dir):
  """
  Remove output_dir if it exists but is empty or missing the native lib.
  So gyp will re-run fetch and we re-download.
  """
  if not os.path.exists(output_dir) or not os.path.isdir(output_dir):
    return
  entries = os.listdir(output_dir)
  if not entries:
    shutil.rmtree(output_dir)
    return
  has_lib = (
    os.path.isfile(os.path.join(output_dir, "libseekdb.dylib")) or
    os.path.isfile(os.path.join(output_dir, "libseekdb.so")))
  if not has_lib:
    shutil.rmtree(output_dir)


def fetch_libseekdb(zip_url, output_dir, local_zip_name):
  """
  Download zip from zip_url and extract all contents into output_dir.
  local_zip_name: filename for the local zip (e.g. libseekdb-darwin-arm64.zip).
  """
  _ensure_output_dir_valid(output_dir)
  if not os.path.exists(output_dir):
    os.makedirs(output_dir)

  local_zip_path = os.path.join(output_dir, local_zip_name)
  print("fetching: " + zip_url)
  _reporthook._last_pct = -1
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

  # If extracted archive has a libs dir, copy it to pkgs/js-bindings/libs.
  module_root = os.path.dirname(output_dir)
  copy_libs_to_package(module_root)


def copy_libs_to_package(module_root):
  """
  Copy libseekdb/libs to pkgs/js-bindings/libs if source exists.
  Used after fetch (in fetch_libseekdb) and when fetch is skipped (--copy-only).
  """
  os.makedirs(os.path.join(module_root, "pkgs", "js-bindings"), exist_ok=True)
  src_libs = os.path.join(module_root, "libseekdb", "libs")
  dst_libs = os.path.join(module_root, "pkgs", "js-bindings", "libs")
  if os.path.isdir(src_libs):
    shutil.copytree(src_libs, dst_libs, dirs_exist_ok=True)


def _sign_dylibs_macos(bindings_dir):
  """
  Ad-hoc sign dylibs in pkgs/js-bindings so macOS does not kill the process (SIGKILL)
  when loading libseekdb.dylib with invalid/modified signature.
  """
  if sys.platform != "darwin":
    return
  import subprocess
  main_dylib = os.path.join(bindings_dir, "libseekdb.dylib")
  if os.path.isfile(main_dylib):
    subprocess.run(["codesign", "--force", "--sign", "-", main_dylib], check=False)
  libs_dir = os.path.join(bindings_dir, "libs")
  if os.path.isdir(libs_dir):
    for name in os.listdir(libs_dir):
      if name.endswith(".dylib"):
        subprocess.run(
          ["codesign", "--force", "--sign", "-", os.path.join(libs_dir, name)],
          check=False,
        )


def _need_fetch(output_dir):
  """True if output_dir is missing or empty or does not contain the native lib."""
  if not os.path.exists(output_dir) or not os.path.isdir(output_dir):
    return True
  entries = os.listdir(output_dir)
  if not entries:
    return True
  has_lib = (
    os.path.isfile(os.path.join(output_dir, "libseekdb.dylib")) or
    os.path.isfile(os.path.join(output_dir, "libseekdb.so")))
  return not has_lib


def fetch_if_empty(module_root):
  """
  If libseekdb is empty or missing the lib, run platform-appropriate fetch so node-gyp build can link.
  Called before node-gyp build to avoid COPY/cp failures when libseekdb was empty but build/ existed.
  """
  output_dir = os.path.join(module_root, "libseekdb")
  if not _need_fetch(output_dir):
    return
  machine = platform.machine().lower()
  uname = getattr(platform, "uname", lambda: None)()
  if uname:
    system = (uname[0] or "").lower()
  else:
    system = "darwin" if sys.platform == "darwin" else "linux"
  arch = "arm64" if machine in ("arm64", "aarch64") else "x64"
  if system == "darwin":
    zip_name = "libseekdb-darwin-arm64.zip" if arch == "arm64" else "libseekdb-darwin-x64.zip"
  else:
    zip_name = "libseekdb-linux-%s.zip" % arch
  from libseekdb_url_config import get_zip_url
  zip_url = get_zip_url(zip_name)
  fetch_libseekdb(zip_url, output_dir, "libseekdb.zip")


if __name__ == "__main__":
  if len(sys.argv) < 2:
    sys.exit(0)
  module_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
  if sys.argv[1] == "--copy-only":
    copy_libs_to_package(module_root)
  elif sys.argv[1] == "--fetch-if-empty":
    fetch_if_empty(module_root)
  elif sys.argv[1] == "--sign-dylibs":
    bindings_dir = os.path.join(module_root, "pkgs", "js-bindings")
    _sign_dylibs_macos(bindings_dir)