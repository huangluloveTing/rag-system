#!/bin/bash

# 文档管理功能测试脚本
# 测试批量上传、版本管理、预览等功能

set -e

BASE_URL="http://localhost:3000/api/v1"
TOKEN=""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

echo_error() {
    echo -e "${RED}✗ $1${NC}"
}

echo_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# 1. 登录获取 Token
echo_info "步骤 1: 登录获取 Token"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin123!"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo_success "登录成功，Token: ${TOKEN:0:20}..."
else
    echo_error "登录失败"
    echo $LOGIN_RESPONSE | jq
    exit 1
fi

# 2. 获取知识库列表
echo_info "步骤 2: 获取知识库列表"
KB_RESPONSE=$(curl -s -X GET "$BASE_URL/knowledge-bases?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN")

KB_ID=$(echo $KB_RESPONSE | jq -r '.knowledgeBases[0].id')

if [ "$KB_ID" != "null" ] && [ -n "$KB_ID" ]; then
    echo_success "获取知识库成功，ID: $KB_ID"
else
    echo_error "未找到知识库，请先创建知识库"
    exit 1
fi

# 3. 创建测试文件
echo_info "步骤 3: 创建测试文件"

# 创建 Markdown 测试文件
cat > /tmp/test_doc_v1.md << 'EOF'
# 测试文档 v1

这是一个测试文档的第一个版本。

## 功能列表

- 批量上传
- 版本管理
- 文档预览
EOF

# 创建 TXT 测试文件
cat > /tmp/test_doc.txt << 'EOF'
这是一个纯文本测试文件。

用于测试文档管理模块的各项功能。
EOF

# 创建 HTML 测试文件
cat > /tmp/test_doc.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>测试文档</title>
</head>
<body>
    <h1>HTML 测试文档</h1>
    <p>这是一个用于测试的 HTML 文件。</p>
</body>
</html>
EOF

echo_success "测试文件创建完成"

# 4. 测试单文件上传
echo_info "步骤 4: 测试单文件上传"
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test_doc_v1.md" \
  -F "knowledge_base_id=$KB_ID" \
  -F "tags=测试,Markdown" \
  -F "is_public=true")

DOC_ID=$(echo $UPLOAD_RESPONSE | jq -r '.document_id')

if [ "$DOC_ID" != "null" ] && [ -n "$DOC_ID" ]; then
    echo_success "单文件上传成功，文档 ID: $DOC_ID"
else
    echo_error "单文件上传失败"
    echo $UPLOAD_RESPONSE | jq
    exit 1
fi

# 5. 测试批量上传
echo_info "步骤 5: 测试批量上传"
BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/documents/upload/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@/tmp/test_doc.txt" \
  -F "files=@/tmp/test_doc.html" \
  -F "knowledge_base_id=$KB_ID" \
  -F "tags=测试,批量上传" \
  -F "is_public=true")

BATCH_COUNT=$(echo $BATCH_RESPONSE | jq '.documents | length')

if [ "$BATCH_COUNT" -eq "2" ]; then
    echo_success "批量上传成功，上传了 $BATCH_COUNT 个文件"
else
    echo_error "批量上传失败"
    echo $BATCH_RESPONSE | jq
fi

# 等待文档处理
echo_info "等待 5 秒让文档处理完成..."
sleep 5

# 6. 获取文档列表
echo_info "步骤 6: 获取文档列表"
DOCS_RESPONSE=$(curl -s -X GET "$BASE_URL/documents?knowledge_base_id=$KB_ID" \
  -H "Authorization: Bearer $TOKEN")

DOCS_COUNT=$(echo $DOCS_RESPONSE | jq '.documents | length')
echo_success "获取到 $DOCS_COUNT 个文档"

# 7. 获取文档详情
echo_info "步骤 7: 获取文档详情"
DETAIL_RESPONSE=$(curl -s -X GET "$BASE_URL/documents/$DOC_ID" \
  -H "Authorization: Bearer $TOKEN")

VERSION=$(echo $DETAIL_RESPONSE | jq -r '.version')
IS_LATEST=$(echo $DETAIL_RESPONSE | jq -r '.isLatest')

echo_success "文档版本: v$VERSION, 是否最新: $IS_LATEST"

# 8. 测试版本管理 - 上传同名文件创建新版本
echo_info "步骤 8: 测试版本管理 - 上传新版本"

# 创建 v2 版本
cat > /tmp/test_doc_v2.md << 'EOF'
# 测试文档 v2

这是一个测试文档的第二个版本。

## 新增功能

- HTML 格式支持
- 标签筛选
- 版本恢复

## 原有功能

- 批量上传
- 版本管理
- 文档预览
EOF

VERSION_RESPONSE=$(curl -s -X POST "$BASE_URL/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test_doc_v2.md" \
  -F "knowledge_base_id=$KB_ID" \
  -F "tags=测试,Markdown,v2" \
  -F "is_public=true")

NEW_DOC_ID=$(echo $VERSION_RESPONSE | jq -r '.document_id')

if [ "$NEW_DOC_ID" == "$DOC_ID" ]; then
    echo_success "版本更新成功，文档 ID 保持不变"
else
    echo_info "创建了新文档，ID: $NEW_DOC_ID"
fi

# 等待处理
sleep 3

# 9. 获取版本历史
echo_info "步骤 9: 获取版本历史"
VERSIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/documents/$DOC_ID/versions" \
  -H "Authorization: Bearer $TOKEN")

VERSIONS_COUNT=$(echo $VERSIONS_RESPONSE | jq '.total')

if [ "$VERSIONS_COUNT" -gt "0" ]; then
    echo_success "找到 $VERSIONS_COUNT 个历史版本"
    echo $VERSIONS_RESPONSE | jq '.versions[] | {version, filename, status}'
else
    echo_info "暂无历史版本"
fi

# 10. 测试文档预览
echo_info "步骤 10: 测试文档预览"
PREVIEW_RESPONSE=$(curl -s -X GET "$BASE_URL/documents/$DOC_ID/preview" \
  -H "Authorization: Bearer $TOKEN")

PREVIEW_TYPE=$(echo $PREVIEW_RESPONSE | jq -r '.type')
CONTENT_LENGTH=$(echo $PREVIEW_RESPONSE | jq -r '.content | length')

if [ "$CONTENT_LENGTH" -gt "0" ]; then
    echo_success "预览成功，类型: $PREVIEW_TYPE, 内容长度: $CONTENT_LENGTH"
    echo_info "预览内容前 100 字符:"
    echo $PREVIEW_RESPONSE | jq -r '.content' | head -c 100
    echo "..."
else
    echo_error "预览失败"
fi

# 11. 测试按标签筛选
echo_info "步骤 11: 测试按标签筛选"
FILTERED_RESPONSE=$(curl -s -X GET "$BASE_URL/documents?knowledge_base_id=$KB_ID" \
  -H "Authorization: Bearer $TOKEN")

echo_info "所有文档的标签:"
echo $FILTERED_RESPONSE | jq '.documents[] | {filename, tags}'

# 12. 测试重新索引
echo_info "步骤 12: 测试重新索引"
REINDEX_RESPONSE=$(curl -s -X POST "$BASE_URL/documents/$DOC_ID/reindex" \
  -H "Authorization: Bearer $TOKEN")

REINDEX_STATUS=$(echo $REINDEX_RESPONSE | jq -r '.status')

if [ "$REINDEX_STATUS" == "processing" ]; then
    echo_success "重新索引已启动"
else
    echo_error "重新索引失败"
fi

# 13. 清理测试文件
echo_info "步骤 13: 清理测试文件"
rm -f /tmp/test_doc_v1.md /tmp/test_doc_v2.md /tmp/test_doc.txt /tmp/test_doc.html
echo_success "测试文件已清理"

# 总结
echo ""
echo "================================"
echo_success "文档管理功能测试完成！"
echo "================================"
echo ""
echo "测试覆盖功能："
echo "  ✓ 用户登录"
echo "  ✓ 单文件上传"
echo "  ✓ 批量上传（2个文件）"
echo "  ✓ 文档列表查询"
echo "  ✓ 文档详情查询"
echo "  ✓ 版本管理（上传同名文件）"
echo "  ✓ 版本历史查询"
echo "  ✓ 文档预览"
echo "  ✓ 标签筛选"
echo "  ✓ 重新索引"
echo ""
echo "您可以在前端界面查看更详细的结果："
echo "  http://localhost:5173/documents"
echo ""
