#!/bin/bash
# 系统性扫描 Python SDK 功能的脚本

PYSDK_PATH="../pyseekdb"
OUTPUT_FILE="pysdk-feature-scan.md"

echo "# Python SDK 功能扫描报告" > $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "扫描时间: $(date)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# ==================== 1. API 文档结构 ====================
echo "## 1. API 文档结构 (API.md)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "\`\`\`" >> $OUTPUT_FILE
if [ -f "$PYSDK_PATH/API.md" ]; then
    grep "^##" $PYSDK_PATH/API.md >> $OUTPUT_FILE
else
    echo "⚠️  API.md 未找到" >> $OUTPUT_FILE
fi
echo "\`\`\`" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# ==================== 2. README 目录结构 ====================
echo "## 2. README 目录结构" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "\`\`\`" >> $OUTPUT_FILE
if [ -f "$PYSDK_PATH/README.md" ]; then
    grep "^##" $PYSDK_PATH/README.md >> $OUTPUT_FILE
else
    echo "⚠️  README.md 未找到" >> $OUTPUT_FILE
fi
echo "\`\`\`" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# ==================== 3. 所有测试文件 ====================
echo "## 3. 测试文件列表" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "\`\`\`" >> $OUTPUT_FILE
if [ -d "$PYSDK_PATH/tests" ]; then
    ls -1 $PYSDK_PATH/tests/test_*.py | while read file; do
        filename=$(basename $file)
        echo "- $filename"
    done >> $OUTPUT_FILE
else
    echo "⚠️  tests 目录未找到" >> $OUTPUT_FILE
fi
echo "\`\`\`" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# ==================== 4. 源代码模块结构 ====================
echo "## 4. 源代码模块结构" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "\`\`\`" >> $OUTPUT_FILE
if [ -d "$PYSDK_PATH/src/pyseekdb" ]; then
    echo "pyseekdb/"
    find $PYSDK_PATH/src/pyseekdb -name "*.py" | while read file; do
        # 移除前缀路径
        relative_path=${file#$PYSDK_PATH/src/pyseekdb/}
        echo "  $relative_path"
    done >> $OUTPUT_FILE
else
    echo "⚠️  src/pyseekdb 目录未找到" >> $OUTPUT_FILE
fi
echo "\`\`\`" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# ==================== 5. 示例文件 ====================
echo "## 5. 示例文件列表" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "\`\`\`" >> $OUTPUT_FILE
if [ -d "$PYSDK_PATH/examples" ]; then
    ls -1 $PYSDK_PATH/examples/*.py 2>/dev/null | while read file; do
        filename=$(basename $file)
        echo "- $filename"
    done >> $OUTPUT_FILE
else
    echo "⚠️  examples 目录未找到" >> $OUTPUT_FILE
fi
echo "\`\`\`" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# ==================== 6. 导出的公共 API ====================
echo "## 6. 公共 API (从 __init__.py)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "\`\`\`python" >> $OUTPUT_FILE
if [ -f "$PYSDK_PATH/src/pyseekdb/__init__.py" ]; then
    grep -E "^(from|import|__all__|class|def)" $PYSDK_PATH/src/pyseekdb/__init__.py >> $OUTPUT_FILE
else
    echo "⚠️  __init__.py 未找到" >> $OUTPUT_FILE
fi
echo "\`\`\`" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# ==================== 7. AdminClient 类方法 ====================
echo "## 7. AdminClient 类方法" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "\`\`\`python" >> $OUTPUT_FILE
if [ -f "$PYSDK_PATH/src/pyseekdb/client/admin_client.py" ]; then
    grep -E "^\s*(def|async def)\s+\w+" $PYSDK_PATH/src/pyseekdb/client/admin_client.py | head -20 >> $OUTPUT_FILE
else
    echo "⚠️  admin_client.py 未找到" >> $OUTPUT_FILE
fi
echo "\`\`\`" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# ==================== 8. Client 类方法 ====================
echo "## 8. Client 基础类方法" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "\`\`\`python" >> $OUTPUT_FILE
if [ -f "$PYSDK_PATH/src/pyseekdb/client/client_base.py" ]; then
    grep -E "^\s*(def|async def)\s+\w+" $PYSDK_PATH/src/pyseekdb/client/client_base.py | head -30 >> $OUTPUT_FILE
else
    echo "⚠️  client_base.py 未找到" >> $OUTPUT_FILE
fi
echo "\`\`\`" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# ==================== 9. Collection 类方法 ====================
echo "## 9. Collection 类方法" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "\`\`\`python" >> $OUTPUT_FILE
if [ -f "$PYSDK_PATH/src/pyseekdb/client/collection.py" ]; then
    grep -E "^\s*(def|async def)\s+\w+" $PYSDK_PATH/src/pyseekdb/client/collection.py >> $OUTPUT_FILE
else
    echo "⚠️  collection.py 未找到" >> $OUTPUT_FILE
fi
echo "\`\`\`" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# ==================== 10. 过滤器支持 ====================
echo "## 10. 过滤器支持 (filters.py)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "\`\`\`python" >> $OUTPUT_FILE
if [ -f "$PYSDK_PATH/src/pyseekdb/client/filters.py" ]; then
    grep -E "(OPERATORS|LOGICAL|COMPARISON)" $PYSDK_PATH/src/pyseekdb/client/filters.py | head -20 >> $OUTPUT_FILE
else
    echo "⚠️  filters.py 未找到" >> $OUTPUT_FILE
fi
echo "\`\`\`" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

echo "✅ 扫描完成！结果已保存到: $OUTPUT_FILE"

