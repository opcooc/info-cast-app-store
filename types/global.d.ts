declare namespace Global {

  type Browser = import('playwright').Browser;
  type BrowserContext = import('playwright').BrowserContext;
  type Page = import('playwright').Page;

  interface ProxyInfo {
      server: string;
      username?: string;
      password?: string;
  }

  interface RunnerData {
      headless?: boolean;
      executablePath?: string;
      proxy?: ProxyInfo;
      content?: string;
      cookie_info?: string;
  }

  interface RunnerContextType {
      id: string;
      app_dir: string;
      media_type: string;
      data: RunnerData;
      browser: Browser;
      context: BrowserContext;
      page: Page;
      waitingForWorker: boolean;
      english: boolean;
  }
}
 