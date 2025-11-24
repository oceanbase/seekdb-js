import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 使用 threads 池但禁用隔离来避免 worker 终止问题
    pool: 'threads',
    poolOptions: {
      threads: {
        // 使用单线程模式
        singleThread: true,
        // 禁用隔离以避免 worker 终止问题
        isolate: false,
      },
    },
    
    // 设置超时时间
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    
    // 禁用文件并行，确保稳定性
    fileParallelism: false,
    
    // 设置单线程运行测试
    maxConcurrency: 1,
    
    // 确保在测试失败后也能正常退出
    bail: 0,
  },
});

