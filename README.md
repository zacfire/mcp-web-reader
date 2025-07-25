# MCP Web Reader

一个强大的 MCP (Model Context Protocol) 服务器，让 Claude 和其他大语言模型能够读取和解析网页内容。支持突破访问限制，轻松获取微信文章、时代杂志等受保护内容。

## 功能特点

- 🚀 **三引擎支持**：集成 Jina Reader API、本地解析器和 Playwright 浏览器
- 🔄 **智能降级**：Jina Reader → 本地解析 → Playwright 浏览器三层自动切换
- 🌐 **突破限制**：使用 Playwright 处理 Cloudflare、验证码等访问限制
- 📦 **批量处理**：支持同时获取多个 URL
- 🎯 **灵活控制**：可选择强制使用特定解析方式
- 📝 **Markdown 输出**：自动转换为清晰的 Markdown 格式

## 安装

### 方法 1：从源码安装

```bash
# 克隆仓库
git clone https://github.com/zacfire/mcp-web-reader.git
cd mcp-web-reader

# 安装依赖
npm install

# 构建项目
npm run build

# 安装 Playwright 浏览器（必需）
npx playwright install chromium
```

### 方法 2：使用 npm 安装（如果已发布）

```bash
npm install -g mcp-web-reader
```

## 配置

在 Claude Desktop 的配置文件中添加：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "web-reader": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-web-reader/dist/index.js"]
    }
  }
}
```

## 使用方法

配置完成后，在 Claude 中可以使用以下命令：

1.  **智能获取（推荐）**
    * "请获取 [https://example.com](https://example.com) 的内容"
    * 自动三层降级：Jina Reader → 本地解析 → Playwright 浏览器

2.  **批量获取**
    * "请获取这些网页：[url1, url2, url3]"
    * 每个URL都享受智能降级策略

3.  **强制使用 Jina Reader**
    * "使用 Jina Reader 获取 [https://example.com](https://example.com)"

4.  **强制使用本地解析**
    * "使用本地解析器获取 [https://example.com](https://example.com)"

5.  **强制使用浏览器模式**
    * "使用浏览器获取 [https://example.com](https://example.com)"
    * 直接跳过其他方式，适用于确定有访问限制的网站

## 支持的受限网站类型

✅ **微信公众号文章** - 自动绕过访问限制  
✅ **时代杂志、纽约时报** - 突破付费墙和地区限制  
✅ **Cloudflare 保护网站** - 通过真实浏览器绕过检测  
✅ **需要 JavaScript 渲染的页面** - 完整执行页面脚本  
✅ **有验证码/人机验证的网站** - 模拟真实用户行为

## 工具列表

-   `fetch_url` - 智能获取（三层降级：Jina → 本地 → Playwright）
-   `fetch_url_with_jina` - 强制使用 Jina Reader
-   `fetch_url_local` - 强制使用本地解析器  
-   `fetch_url_with_browser` - 强制使用 Playwright 浏览器（突破访问限制）
-   `fetch_multiple_urls` - 批量获取多个 URL

## 技术架构

### 智能降级策略
```
用户请求 URL
    ↓
1. Jina Reader API (最快，成功率高)
    ↓ 失败
2. 本地解析器 (Node.js + JSDOM)
    ↓ 检测到访问限制
3. Playwright 浏览器 (真实浏览器，突破限制)
```

### 访问限制检测
自动识别以下情况并启用浏览器模式：
- HTTP 状态码：403, 429, 503, 520-524
- 错误关键词：Cloudflare, CAPTCHA, Access Denied, Rate Limit
- 内容关键词：Security Check, Human Verification

## 开发

```bash
# 开发模式（自动重新编译）
npm run dev

# 构建
npm run build

# 测试运行
npm start

# 安装浏览器二进制文件（首次使用必需）
npx playwright install chromium
```

## 性能优化

- ⚡ **浏览器实例复用** - 避免重复启动开销
- 🚫 **资源过滤** - 阻止图片、样式表等不必要加载
- 🎯 **智能选择** - 优先使用快速方法，必要时才用浏览器
- 💾 **优雅关闭** - 正确清理浏览器资源

## 贡献

欢迎提交 Pull Request！

## 许可证

MIT License

