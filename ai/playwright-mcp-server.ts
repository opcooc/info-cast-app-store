import express from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { createConnection } from '@playwright/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { chromium } from 'playwright';

const app = express();
app.use(express.json());

app.post('/ic-mcp', async (req: Request, res: Response) => {
  // 每次请求创建一个独立 MCP Server
  const server = await createConnection({
    capabilities: ['core', 'core-tabs', 'core-install']
  }, async () => {
    const browser = await chromium.launch({
      headless: false,
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    });

   const context = await browser.newContext();
  await context.newPage();

  return context;
  });

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      enableJsonResponse: false,
    });

    // 建立连接，浏览器方法会注册在此时
    await server.connect(transport);

    // 处理 JSON-RPC 请求
    await transport.handleRequest(req, res, req.body);

    // 请求结束自动关闭
    res.on('close', () => {
      transport.close();
      server.close();
    });

  } catch (error) {
    console.error('Error handling MCP request:', error);

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`MCP Stateless Streamable HTTP Server listening on port ${PORT}`);
});

process.on('SIGINT', () => {
  console.log('Shutting down server...');
  process.exit(0);
});
