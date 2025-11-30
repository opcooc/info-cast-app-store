import { createConnection } from '@playwright/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { randomUUID } from 'node:crypto';
import fs from "node:fs";
import { chromium } from 'playwright';
import type { BrowserContextOptions, LaunchOptions, Browser, BrowserContext } from 'playwright';

interface ConfigArgs {
  english?: boolean;
  headless?: boolean;
  proxy?: {
    server: string;
    bypass?: string;
    username?: string;
    password?: string;
  };
  executablePath?: string;
  cookieInfoPath?: string;
}

function loadConfig(): ConfigArgs {
  const dataJson = process.argv[2];

  if (!dataJson) {
    console.error("Missing config file path. Usage: node server.js <config.json>");
    process.exit(1);
  }

  try {
    return JSON.parse(dataJson);
  } catch (err) {
    console.error(`Failed to parse config JSON:`, err);
    process.exit(1);
  }
}

// 最终配置
const args: ConfigArgs = loadConfig();

/**
 * 日志输出类型
 */
type LogType = "log" | "error";

/**
 * 统一格式化日志输出
 */

function log(type: LogType, msg: string, data: unknown = null): void {
  const contentItem = {
    type: "text",
    text: msg + (data ? "\n" + JSON.stringify(data, null, 2) : "")
  };

  const out = {
    jsonrpc: "2.0",
    id: 0,
    result: {
      content: [contentItem],
      isError: type === "error"
    }
  };

  (type === "error" ? console.error : console.log)(JSON.stringify(out));
}

// -----------------------
// MCP 服务器创建
// -----------------------

let server: Server;
let browser: Browser;
let browserContext: BrowserContext;

try {
  server = await createConnection({
    capabilities: ["core", "core-tabs", "core-install"]
  }, async () => {
     browser = await chromium.launch({
        args: args.english ? ["--lang=en-US"] : [],
        headless: args.headless,
        proxy: args.proxy,
        executablePath: args.executablePath,
     });
    
    browserContext = await browser.newContext({
        permissions: ["geolocation"],
        viewport: { width: 1920, height: 1080 },
        storageState: args.cookieInfoPath,
        locale: args.english ? "en-US" : undefined
    });

    browserContext.addInitScript({ path: 'stealth.min.js' });
    browserContext.addInitScript({ path: 'fix-viewport.js' });

    browser?.on('disconnected', () => {
      log("error", "Browser disconnected unexpectedly");
      process.exit(1); // 浏览器意外关闭时退出
    });

    browserContext?.on('close', () => {
      log("log", "BrowserContext closed");
      // 如果浏览器还活着，可以选择是否退出
      if (browser.isConnected()) {
        process.exit(0);
      }
    });

    return browserContext;
  });

  log("log", "Playwright MCP server created");
} catch (err) {
  log("error", "Failed to create MCP connection", err);
  process.exit(1);
}

// -----------------------
// STDIO Transport
// -----------------------

let transport: StdioServerTransport;

try {
  transport = new StdioServerTransport(process.stdin, process.stdout);

  await server.connect(transport);

  log("log", "MCP Server running via STDIO...");
} catch (err) {
  log("error", "Transport connection error", err);
  if (server) {
    log("log", "Closing Server...");
    await server.close().catch(() => {});
  }
  process.exit(1);
}

// -----------------------
// Transport 事件处理
// -----------------------

transport.onclose = async () => {
  log("log", "MCP client disconnected. Server shutting down.");
  process.exit(0);
};

transport.onerror = async (err: unknown) => {
  log("error", "Transport error occurred", err);
  process.exit(1);
};

// 客户端连接成功
server.oninitialized = () => {
  log("log", "MCP client oninitialized");
};

// 客户端断开连接
server.onclose = () => {
  log("log", "MCP client onclose");
    process.exit(0);
};

// 服务器内部错误
server.onerror = () => {
  log("log", "MCP client 服务器内部错误");
    process.exit(1);
};

// -----------------------
// 全局异常捕捉
// -----------------------

process.on("uncaughtException", async (err: Error) => {
  log("error", "Uncaught Exception", err.stack || err);
  await gracefulExit(1);
});

process.on("unhandledRejection", async (reason: unknown) => {
  log("error", "Unhandled Promise Rejection", reason);
  await gracefulExit(1);
});

async function gracefulExit(code = 0) {

  try {
    if (server) {
      log("log", "Closing Server...");
      await server.close().catch(() => {});
    }
  } catch (err) {
    log("error", "Error during graceful shutdown", err);
  }

  // process.exit(code);
}


["SIGINT", "SIGTERM"].forEach(sig => {
  process.on(sig as NodeJS.Signals, async () => {
    log("log", `Received ${sig}. Shutting down...`);
    await gracefulExit(0);
  });
});

