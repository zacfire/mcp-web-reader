import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

// 创建服务器实例
const server = new Server(
  {
    name: "web-reader",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 初始化Turndown服务（将HTML转换为Markdown）
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// 配置Turndown规则
turndownService.addRule("skipScripts", {
  filter: ["script", "style", "noscript"],
  replacement: () => "",
});

// URL验证函数
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// 使用Jina Reader获取内容
async function fetchWithJinaReader(url: string): Promise<{
  title: string;
  content: string;
  metadata: {
    url: string;
    fetchedAt: string;
    contentLength: number;
    method: string;
  };
}> {
  try {
    // Jina Reader API URL
    const jinaUrl = `https://r.jina.ai/${url}`;
    
    // 创建超时控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/markdown",
        "User-Agent": "MCP-URLFetcher/2.0",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Jina Reader API error! status: ${response.status}`);
    }

    const markdown = await response.text();
    
    // 从Markdown中提取标题（通常是第一个#标题）
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : "无标题";
    
    return {
      title,
      content: markdown,
      metadata: {
        url,
        fetchedAt: new Date().toISOString(),
        contentLength: markdown.length,
        method: "jina-reader",
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Jina Reader请求超时（30秒）`);
      }
      throw new Error(`Jina Reader获取失败: ${error.message}`);
    }
    throw new Error(`Jina Reader获取失败: ${String(error)}`);
  }
}

// 本地提取网页内容的函数
async function fetchWithLocalParser(url: string): Promise<{
  title: string;
  content: string;
  metadata: {
    url: string;
    fetchedAt: string;
    contentLength: number;
    method: string;
  };
}> {
  try {
    // 创建超时控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    // 发送HTTP请求
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MCP-URLFetcher/2.0)",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 获取HTML内容
    const html = await response.text();
    
    // 使用JSDOM解析HTML
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // 获取标题
    const title = document.querySelector("title")?.textContent || "无标题";
    
    // 移除不需要的元素
    const elementsToRemove = document.querySelectorAll(
      "script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar, .comments"
    );
    elementsToRemove.forEach(el => el.remove());
    
    // 获取主要内容区域
    const mainContent = 
      document.querySelector("main") || 
      document.querySelector("article") || 
      document.querySelector('[role="main"]') ||
      document.querySelector(".content") ||
      document.querySelector("#content") ||
      document.querySelector(".post") ||
      document.querySelector(".entry-content") ||
      document.body;
    
    // 转换为Markdown
    const markdown = turndownService.turndown(mainContent.innerHTML);
    
    // 清理多余的空行和空格
    const cleanedContent = markdown
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+$/gm, "")
      .trim();
    
    return {
      title,
      content: cleanedContent,
      metadata: {
        url,
        fetchedAt: new Date().toISOString(),
        contentLength: cleanedContent.length,
        method: "local-parser",
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`本地解析请求超时（30秒）`);
      }
      throw new Error(`本地解析失败: ${error.message}`);
    }
    throw new Error(`本地解析失败: ${String(error)}`);
  }
}

// 智能获取网页内容（先尝试Jina，失败则使用本地）
async function fetchWebContent(url: string, preferJina: boolean = true): Promise<{
  title: string;
  content: string;
  metadata: {
    url: string;
    fetchedAt: string;
    contentLength: number;
    method: string;
  };
}> {
  if (preferJina) {
    try {
      return await fetchWithJinaReader(url);
    } catch (jinaError) {
      console.error("Jina Reader失败，尝试本地解析:", jinaError instanceof Error ? jinaError.message : String(jinaError));
      try {
        return await fetchWithLocalParser(url);
      } catch (localError) {
        throw new Error(
          `所有方法都失败了。Jina: ${jinaError instanceof Error ? jinaError.message : String(jinaError)}, 本地: ${localError instanceof Error ? localError.message : String(localError)}`
        );
      }
    }
  } else {
    return await fetchWithLocalParser(url);
  }
}

// 处理工具列表请求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "fetch_url",
        description: "获取指定URL的网页内容，并转换为Markdown格式。默认使用Jina Reader，失败时自动切换到本地解析",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "要获取内容的网页URL（必须是http或https协议）",
            },
            preferJina: {
              type: "boolean",
              description: "是否优先使用Jina Reader（默认为true）",
              default: true,
            },
          },
          required: ["url"],
        },
      },
      {
        name: "fetch_multiple_urls",
        description: "批量获取多个URL的网页内容",
        inputSchema: {
          type: "object",
          properties: {
            urls: {
              type: "array",
              items: {
                type: "string",
              },
              description: "要获取内容的网页URL列表",
              maxItems: 10, // 限制最多10个URL
            },
            preferJina: {
              type: "boolean",
              description: "是否优先使用Jina Reader（默认为true）",
              default: true,
            },
          },
          required: ["urls"],
        },
      },
      {
        name: "fetch_url_with_jina",
        description: "强制使用Jina Reader获取网页内容（适用于复杂网页）",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "要获取内容的网页URL",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "fetch_url_local",
        description: "强制使用本地解析器获取网页内容（适用于简单网页或Jina不可用时）",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "要获取内容的网页URL",
            },
          },
          required: ["url"],
        },
      },
    ],
  };
});

// 处理工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "fetch_url") {
      const { url, preferJina = true } = args as { url: string; preferJina?: boolean };
      
      // 验证URL
      if (!isValidUrl(url)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "无效的URL格式，请提供http或https协议的URL"
        );
      }
      
      // 获取网页内容
      const result = await fetchWebContent(url, preferJina);
      
      return {
        content: [
          {
            type: "text",
            text: `# ${result.title}\n\n**URL**: ${result.metadata.url}\n**获取时间**: ${result.metadata.fetchedAt}\n**内容长度**: ${result.metadata.contentLength} 字符\n**解析方法**: ${result.metadata.method}\n\n---\n\n${result.content}`,
          },
        ],
      };
    } else if (name === "fetch_url_with_jina") {
      const { url } = args as { url: string };
      
      if (!isValidUrl(url)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "无效的URL格式"
        );
      }
      
      const result = await fetchWithJinaReader(url);
      
      return {
        content: [
          {
            type: "text",
            text: `# ${result.title}\n\n**URL**: ${result.metadata.url}\n**获取时间**: ${result.metadata.fetchedAt}\n**内容长度**: ${result.metadata.contentLength} 字符\n**解析方法**: Jina Reader\n\n---\n\n${result.content}`,
          },
        ],
      };
    } else if (name === "fetch_url_local") {
      const { url } = args as { url: string };
      
      if (!isValidUrl(url)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "无效的URL格式"
        );
      }
      
      const result = await fetchWithLocalParser(url);
      
      return {
        content: [
          {
            type: "text",
            text: `# ${result.title}\n\n**URL**: ${result.metadata.url}\n**获取时间**: ${result.metadata.fetchedAt}\n**内容长度**: ${result.metadata.contentLength} 字符\n**解析方法**: 本地解析器\n\n---\n\n${result.content}`,
          },
        ],
      };
    } else if (name === "fetch_multiple_urls") {
      const { urls, preferJina = true } = args as { urls: string[]; preferJina?: boolean };
      
      // 验证所有URL
      const invalidUrls = urls.filter(url => !isValidUrl(url));
      if (invalidUrls.length > 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `以下URL格式无效: ${invalidUrls.join(", ")}`
        );
      }
      
      // 并发获取所有URL内容
      const results = await Promise.allSettled(
        urls.map(url => fetchWebContent(url, preferJina))
      );
      
      // 整理结果
      let combinedContent = "# 批量URL内容获取结果\n\n";
      
      results.forEach((result, index) => {
        const url = urls[index];
        combinedContent += `## ${index + 1}. ${url}\n\n`;
        
        if (result.status === "fulfilled") {
          const { title, content, metadata } = result.value;
          combinedContent += `**标题**: ${title}\n`;
          combinedContent += `**获取时间**: ${metadata.fetchedAt}\n`;
          combinedContent += `**内容长度**: ${metadata.contentLength} 字符\n`;
          combinedContent += `**解析方法**: ${metadata.method}\n\n`;
          combinedContent += `### 内容\n\n${content}\n\n`;
        } else {
          combinedContent += `**错误**: ${result.reason}\n\n`;
        }
        
        combinedContent += "---\n\n";
      });
      
      return {
        content: [
          {
            type: "text",
            text: combinedContent,
          },
        ],
      };
    } else {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `未知的工具: ${name}`
      );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `工具执行失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Web Reader v2.0 已启动（支持Jina Reader）");
}

main().catch((error) => {
  console.error("服务器启动失败:", error);
  process.exit(1);
});