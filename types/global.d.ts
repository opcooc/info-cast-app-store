declare namespace Global {

  type Browser = import('playwright').Browser;
  type BrowserContext = import('playwright').BrowserContext;
  type Page = import('playwright').Page;

    interface RunnerContextType {
        id: string | null;
        data: RunnerData | null;
        browser: Browser | null;
        context: BrowserContext | null;
        page: Page | null;
        waitingForWorker: boolean;
        english: boolean;
    }

    interface ProxyData {
        server: string;
        username?: string;
        password?: string;
    }

    interface RunnerData {
        app_dir: string;
        headless: boolean;
        executablePath?: string;
        proxy?: ProxyData;
        format: string;
        title: string;
        location: string | null;
        description: string | null;
        tags: string | null;
        category: string | null;
        visibility: string;
        enable_series: boolean;
        allow_comment: boolean;
        allow_share: boolean;
        allow_download: boolean;
        allow_remix: boolean;
        enable_danmu: boolean;
        enable_watermark: boolean;
        auto_subtitle: boolean;
        original_declare: boolean;
        ai_recommend: boolean;
        enable_ads: boolean;
        enable_goods: boolean;
        enable_revenue: boolean;
        enable_brand: boolean;
        schedule_execute_time: number;
        file_path: string;
        cover_path: string | null;
        cookie_info: string;
    }

}
 