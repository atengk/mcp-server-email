/**
 * MCP Server Email 服务主入口
 *
 * @author Ateng
 * @since 2026-10-08
 */
import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "./config/index.js";
import { registerEmailTools } from "./tools/index.js";

/**
 * 启动 MCP 邮件服务端
 */
async function main(): Promise<void> {
  // 1. 初始化 MCP 服务端实例
  const server = new McpServer({
    name: "mcp-server-email",
    version: "1.0.0",
  });

  // 2. 注册邮件交互工具
  registerEmailTools(server);

  // 3. 命令行参数解析优先级高于环境变量
  const args = process.argv.slice(2);
  let transportMode = config.MCP_TRANSPORT;
  let port = config.MCP_PORT;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--transport" && args[i + 1]) {
      transportMode = args[i + 1] === "sse" ? "sse" : "stdio";
      i++;
    } else if (args[i] === "--port" && args[i + 1]) {
      port = parseInt(args[i + 1], 10) || 3000;
      i++;
    }
  }

  // 4. 根据模式启动通信监听
  if (transportMode === "sse") {
    let sseTransport: SSEServerTransport | null = null;

    const httpServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      // 允许跨域调用 (CORS)
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204).end();
        return;
      }

      if (url.pathname === "/sse") {
        sseTransport = new SSEServerTransport("/messages", res);
        await server.connect(sseTransport);
        console.error("[MCP Email Server] SSE 传输连接已建立");
      } else if (url.pathname === "/messages" && req.method === "POST") {
        if (sseTransport) {
          await sseTransport.handlePostMessage(req, res);
        } else {
          res.writeHead(400).end("SSE 传输会话尚未建立");
        }
      } else if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
      } else {
        res.writeHead(404).end("Not Found");
      }
    });

    httpServer.listen(port, () => {
      console.error(`[MCP Email Server] SSE 模式正在监听端口: ${port}`);
    });
  } else {
    // 默认 Stdio 模式 (标准输入输出，供本地 Claude Desktop / Cursor 进程拉起)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[MCP Email Server] Stdio 传输已就绪，正在监听标准输入输出");
  }
}

main().catch((err: unknown) => {
  console.error("[MCP Email Server 崩溃]", err);
  process.exit(1);
});
