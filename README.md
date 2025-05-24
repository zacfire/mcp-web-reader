# MCP Web Reader

一个强大的 MCP (Model Context Protocol) 服务器，让 Claude 和其他大语言模型能够读取和解析网页内容。

## 功能特点

- 🚀 **双引擎支持**：集成 Jina Reader API 和本地解析器
- 🔄 **智能降级**：Jina Reader 失败时自动切换到本地解析
- 📦 **批量处理**：支持同时获取多个 URL
- 🎯 **灵活控制**：可选择强制使用特定解析方式
- 📝 **Markdown 输出**：自动转换为清晰的 Markdown 格式

## 安装

### 方法 1：从源码安装

\`\`\`bash
# 克隆仓库
git clone https://github.com/zacfire/mcp-web-reader.git
cd mcp-web-reader

# 安装依赖
npm install

# 构建项目
npm run build
\`\`\`

### 方法 2：使用 npm 安装（如果已发布）

\`\`\`bash
npm install -g mcp-web-reader
\`\`\`

## 配置

在 Claude Desktop 的配置文件中添加：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

\`\`\`json
{
  "mcpServers": {
    "web-reader": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-web-reader/dist/index.js"]
    }
  }
}
\`\`\`

## 使用方法

配置完成后，在 Claude 中可以使用以下命令：

1. **获取单个网页**
   - "请获取 https://example.com 的内容"

2. **批量获取**
   - "请获取这些网页：[url1, url2, url3]"

3. **强制使用 Jina Reader**
   - "使用 Jina Reader 获取 https://example.com"

4. **强制使用本地解析**
   - "使用本地解析器获取 https://example.com"

## 工具列表

- `fetch_url` - 智能获取（优先 Jina，失败切换本地）
- `fetch_url_with_jina` - 强制使用 Jina Reader
- `fetch_url_local` - 强制使用本地解析器
- `fetch_multiple_urls` - 批量获取多个 URL

## 开发

\`\`\`bash
# 开发模式（自动重新编译）
npm run dev

# 构建
npm run build

# 测试运行
npm start
\`\`\`

## 贡献

欢迎提交 Pull Request！

## 许可证

MIT License