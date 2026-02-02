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
            'action': ['python3', '<(module_root_dir)/scripts/fetch_libseekdb_linux_x64.py'],
            'outputs': ['<(module_root_dir)/libseekdb/libseekdb.so'],
          }],
        }],
        ['OS=="linux" and target_arch=="arm64"', {
          'actions': [{
            'action_name': 'run_fetch_libseekdb_script',
            'message': 'Fetching and extracting libseekdb',
            'inputs': [],
            'action': ['python3', '<(module_root_dir)/scripts/fetch_libseekdb_linux_arm64.py'],
            'outputs': ['<(module_root_dir)/libseekdb/libseekdb.so'],
          }],
        }],
        ['OS=="mac" and target_arch=="arm64"', {
          'actions': [{
            'action_name': 'run_fetch_libseekdb_script',
            'message': 'Fetching and extracting libseekdb',
            'inputs': [],
            'action': ['python3', '<(module_root_dir)/scripts/fetch_libseekdb_darwin_arm64.py'],
            'outputs': ['<(module_root_dir)/libseekdb/libseekdb.dylib'],
          }],
        }],
        ['OS=="mac" and target_arch=="x64"', {
          'actions': [{
            'action_name': 'run_fetch_libseekdb_script',
            'message': 'Fetching and extracting libseekdb',
            'inputs': [],
            'action': ['python3', '<(module_root_dir)/scripts/fetch_libseekdb_darwin_x64.py'],
            'outputs': ['<(module_root_dir)/libseekdb/libseekdb.dylib'],
          }],
        }],
      ],
    },
    {
      'target_name': 'copy_libseekdb_runtime_libs',
      'type': 'none',
      'dependencies': ['fetch_libseekdb'],
      'conditions': [
        ['OS=="linux"', {
          'actions': [{
            'action_name': 'noop_linux',
            'message': 'No runtime libs copy for Linux',
            'inputs': [],
            'outputs': ['<(module_root_dir)/build/copy_libseekdb_runtime_libs.stamp'],
            'action': ['sh', '-c', 'mkdir -p "<(module_root_dir)/build" && touch "<(module_root_dir)/build/copy_libseekdb_runtime_libs.stamp"'],
          }],
        }],
        ['OS=="mac" and target_arch=="arm64"', {
          'actions': [{
            'action_name': 'copy_runtime_libs_darwin_arm64',
            'message': 'Copying libseekdb runtime libs (darwin-arm64)',
            'inputs': ['<(module_root_dir)/libseekdb/libs'],
            'outputs': ['<(module_root_dir)/build/copy_runtime_libs_darwin_arm64.stamp'],
            'action': ['sh', '-c', 'mkdir -p "<(module_root_dir)/pkgs/js-bindings-darwin-arm64/libs" && cp -R "<(module_root_dir)/libseekdb/libs/"* "<(module_root_dir)/pkgs/js-bindings-darwin-arm64/libs/" && mkdir -p "<(module_root_dir)/build" && touch "<(module_root_dir)/build/copy_runtime_libs_darwin_arm64.stamp"'],
          }],
        }],
        ['OS=="mac" and target_arch=="x64"', {
          'actions': [{
            'action_name': 'copy_runtime_libs_darwin_x64',
            'message': 'Copying libseekdb runtime libs (darwin-x64)',
            'inputs': ['<(module_root_dir)/libseekdb/libs'],
            'outputs': ['<(module_root_dir)/build/copy_runtime_libs_darwin_x64.stamp'],
            'action': ['sh', '-c', 'mkdir -p "<(module_root_dir)/pkgs/js-bindings-darwin-x64/libs" && cp -R "<(module_root_dir)/libseekdb/libs/"* "<(module_root_dir)/pkgs/js-bindings-darwin-x64/libs/" && mkdir -p "<(module_root_dir)/build" && touch "<(module_root_dir)/build/copy_runtime_libs_darwin_x64.stamp"'],
          }],
        }],
      ],
    },
    {
      'target_name': 'seekdb',
      'dependencies': [
        'fetch_libseekdb',
        'copy_libseekdb_runtime_libs',
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
              'destination': '<(module_root_dir)/pkgs/js-bindings-linux-x64',
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
              'destination': '<(module_root_dir)/pkgs/js-bindings-linux-arm64',
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
              'destination': '<(module_root_dir)/pkgs/js-bindings-darwin-arm64',
            },
          ],
        }],
        ['OS=="mac" and target_arch=="x64"', {
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
              'destination': '<(module_root_dir)/pkgs/js-bindings-darwin-x64',
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
              'destination': '<(module_root_dir)/pkgs/js-bindings-linux-x64',
            },
          ],
        }],
        ['OS=="linux" and target_arch=="arm64"', {
          'copies': [
            {
              'files': ['<(module_root_dir)/build/Release/seekdb.node'],
              'destination': '<(module_root_dir)/pkgs/js-bindings-linux-arm64',
            },
          ],
        }],
        ['OS=="mac" and target_arch=="arm64"', {
          'copies': [
            {
              'files': ['<(module_root_dir)/build/Release/seekdb.node'],
              'destination': '<(module_root_dir)/pkgs/js-bindings-darwin-arm64',
            },
          ],
        }],
        ['OS=="mac" and target_arch=="x64"', {
          'copies': [
            {
              'files': ['<(module_root_dir)/build/Release/seekdb.node'],
              'destination': '<(module_root_dir)/pkgs/js-bindings-darwin-x64',
            },
          ],
        }],
      ],
    },
  ],
}
