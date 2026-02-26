{
  'targets': [
    {
      'target_name': 'fetch_libseekdb',
      'type': 'none',
      'conditions': [
        ['OS=="linux" and target_arch=="x64"', {
          'actions': [{
            'action_name': 'run_fetch_libseekdb_script',
            'message': 'Fetching and extracting libseekdb',
            'inputs': [],
            'action': ['sh', '-c', 'cd "<(module_root_dir)" && python3 scripts/fetch_libseekdb_linux_x64.py'],
            'outputs': ['<(module_root_dir)/libseekdb/libseekdb.so'],
          }],
        }],
        ['OS=="linux" and target_arch=="arm64"', {
          'actions': [{
            'action_name': 'run_fetch_libseekdb_script',
            'message': 'Fetching and extracting libseekdb',
            'inputs': [],
            'action': ['sh', '-c', 'cd "<(module_root_dir)" && python3 scripts/fetch_libseekdb_linux_arm64.py'],
            'outputs': ['<(module_root_dir)/libseekdb/libseekdb.so'],
          }],
        }],
        ['OS=="mac" and target_arch=="arm64"', {
          'actions': [{
            'action_name': 'run_fetch_libseekdb_script',
            'message': 'Fetching and extracting libseekdb',
            'inputs': [],
            'action': ['sh', '-c', 'cd "<(module_root_dir)" && python3 scripts/fetch_libseekdb_darwin_arm64.py'],
            'outputs': ['<(module_root_dir)/libseekdb/libseekdb.dylib'],
          }],
        }],
      ],
    },
    {
      'target_name': 'seekdb',
      'dependencies': [
        'fetch_libseekdb',
        '<!(node -p "require(\'node-addon-api\').targets"):node_addon_api_except_all',
      ],
      'sources': ['src/seekdb_js_bindings.cpp'],
      'include_dirs': ['<(module_root_dir)/libseekdb'],
      'conditions': [
        ['OS=="linux" and target_arch=="x64"', {
          'link_settings': {
            'libraries': [
              '-lseekdb',
              '-L<(module_root_dir)/libseekdb',
              '-Wl,-rpath,\'$$ORIGIN\'',
            ],
          },
          'copies': [
            {
              'files': ['<(module_root_dir)/libseekdb/libseekdb.so'],
              'destination': '<(module_root_dir)/pkgs/js-bindings',
            },
          ],
        }],
        ['OS=="linux" and target_arch=="arm64"', {
          'link_settings': {
            'libraries': [
              '-lseekdb',
              '-L<(module_root_dir)/libseekdb',
              '-Wl,-rpath,\'$$ORIGIN\'',
            ],
          },
          'copies': [
            {
              'files': ['<(module_root_dir)/libseekdb/libseekdb.so'],
              'destination': '<(module_root_dir)/pkgs/js-bindings',
            },
          ],
        }],
        ['OS=="mac" and target_arch=="arm64"', {
          'cflags+': ['-fvisibility=hidden'],
          'xcode_settings': {
            'GCC_SYMBOLS_PRIVATE_EXTERN': 'YES', # -fvisibility=hidden
          },
          'link_settings': {
            'libraries': [
              '-lseekdb',
              '-L<(module_root_dir)/libseekdb',
              '-Wl,-rpath,@loader_path',
            ],
          },
          'copies': [
            {
              'files': ['<(module_root_dir)/libseekdb/libseekdb.dylib'],
              'destination': '<(module_root_dir)/pkgs/js-bindings',
            },
          ],
        }],
      ],
    },
    {
      'target_name': 'copy_seekdb_node',
      'type': 'none',
      'dependencies': ['seekdb'],
      'conditions': [
        ['OS=="linux" and target_arch=="x64"', {
          'copies': [
            {
              'files': ['<(module_root_dir)/build/Release/seekdb.node'],
              'destination': '<(module_root_dir)/pkgs/js-bindings',
            },
          ],
        }],
        ['OS=="linux" and target_arch=="arm64"', {
          'copies': [
            {
              'files': ['<(module_root_dir)/build/Release/seekdb.node'],
              'destination': '<(module_root_dir)/pkgs/js-bindings',
            },
          ],
        }],
        ['OS=="mac" and target_arch=="arm64"', {
          'copies': [
            {
              'files': ['<(module_root_dir)/build/Release/seekdb.node'],
              'destination': '<(module_root_dir)/pkgs/js-bindings',
            },
          ],
        }],
      ],
    },
  ],
}
