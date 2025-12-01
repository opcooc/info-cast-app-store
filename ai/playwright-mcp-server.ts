import { createConnection } from "@playwright/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium } from "playwright";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type {
  BrowserContextOptions,
  LaunchOptions,
  Browser,
  BrowserContext,
} from "playwright";

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
    console.log("Missing Data JSON. Usage: node server.js 'JSON String'");
    process.exit(1);
  }

  try {
    return JSON.parse(dataJson);
  } catch (err) {
    console.log(`Failed to parse config JSON:`, err);
    process.exit(1);
  }
}

// 最终配置
const args: ConfigArgs = loadConfig();

// -----------------------
// MCP 服务器创建
// -----------------------
(async () => {
  try {
    let server: Server = await createConnection(
      {
        capabilities: ["core", "core-tabs", "core-install"],
      },
      async () => {
        let browser: Browser = await chromium.launch({
          args: args.english ? ["--lang=en-US"] : [],
          headless: args.headless,
          proxy: args.proxy,
          executablePath: args.executablePath,
        });

        let browserContext: BrowserContext = await browser.newContext({
          permissions: ["geolocation"],
          viewport: { width: 1920, height: 1080 },
          storageState: args.cookieInfoPath,
          locale: args.english ? "en-US" : undefined,
        });

        browserContext.addInitScript({ path: "stealth.min.js" });
        browserContext.addInitScript({ path: "fix-viewport.js" });

        browser.on("disconnected", () => {
          console.log("Browser disconnected unexpectedly");
          process.exit(1);
        });

        browserContext.on("close", async () => {
          console.log("BrowserContext closed");
          if (browser.isConnected()) {
            await browser.close();
          }
          process.exit(1);
        });

        return browserContext;
      }
    );

    let transport = new StdioServerTransport(process.stdin, process.stdout);
    await server.connect(transport);

    transport.onclose = () => {
      console.log("MCP client disconnected. Server shutting down.");
      process.exit(0);
    };

    transport.onerror = (err: Error) => {
      console.log("MCP client error. occurred", err);
      process.exit(1);
    };

    console.log("Playwright MCP server created");
  } catch (err) {
    console.log("Failed to create Playwright MCP connection", err);
    process.exit(1);
  }
})();

// -----------------------
// 全局异常捕捉
// -----------------------

process.on("uncaughtException", async (err: Error) => {
  console.log("Uncaught Exception", err.stack || err);
  process.exit(1);
});

process.on("unhandledRejection", async (reason: unknown) => {
  console.log("Unhandled Promise Rejection", reason);
  process.exit(1);
});

["SIGINT", "SIGTERM"].forEach((sig) => {
  process.on(sig as NodeJS.Signals, async () => {
    console.log(`Received ${sig}. Shutting down...`);
    process.exit(0);
  });
});
