import type { Browser, BrowserContext, Page, LaunchOptions } from 'playwright';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const stealthScript = readFileSync(path.resolve(__dirname, 'stealth.min.js'), 'utf-8');
const viewportScript = readFileSync(path.resolve(__dirname, 'fix-viewport.js'), 'utf-8');


class RunnerContext {
    private context: Global.RunnerContextType;

    constructor() {
        this.context = {
            id: null,
            app_dir: null,
            media_type: null,
            data: null,
            browser: null,
            context: null,
            page: null,
            waitingForWorker: false,
            english: false
        };
    }

    /**
     * 设置参数信息
     */
    setContext({ id, app_dir, media_type, english, data }: {
        id: string;
        app_dir: string;
        media_type: string;
        english: boolean;
        data: Global.RunnerData;
    }) {
        this.context.id = id;
        this.context.app_dir = app_dir;
        this.context.media_type = media_type;
        this.context.english = english;
        this.context.data = data;
    }

    /**
     * 初始化浏览器、context 和 page
     */
    async init() {
        const data = this.context.data;
        if (!data) throw new Error('RunnerContext data not initialized');

        const launchOptions: LaunchOptions = {
            args: this.context.english ? ['--lang=en-US'] : [],
            headless: Boolean(data.headless),
        };

        if (data.executablePath) launchOptions.executablePath = data.executablePath;

        if (data.proxy) {
            const proxy: Global.ProxyInfo = {
                server: data.proxy.server
            };
            if (data.proxy.username) proxy.username = data.proxy.username;
            if (data.proxy.password) proxy.password = data.proxy.password;
            launchOptions.proxy = proxy;
        }

        this.context.browser = await chromium.launch(launchOptions);

        const storageState = data.cookie_info ? JSON.parse(data.cookie_info) : undefined;

        this.context.context = await this.context.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            storageState,
            ...(this.context.english ? { locale: 'en-US' } : {})
        });

        // 注入 stealth 脚本
        await this.context.context.addInitScript({ content: stealthScript });

        // 针对 douyin 平台修复 viewport
        await this.context.context.addInitScript({ content: viewportScript });


        await this.context.context.grantPermissions(['geolocation']);
        this.context.page = await this.context.context.newPage();
        this.setupPageEventListeners();
    }

    private setupPageEventListeners() {
        if (!this.context.page) return;

        const errorIfWaiting = (msg: string) => {
            if (this.context.waitingForWorker) {
                throw new Error(msg);
            }
        };

        this.context.page.on('close', () => errorIfWaiting('Page closed by user'));
        this.context.page.on('crash', () => errorIfWaiting('Page crash by user'));
        this.context.page.on('detached', () => errorIfWaiting('Page detached by user'));
    }

    getId(): string { return this.context.id; }
    getAppDir(): string { return this.context.app_dir; }
    getMediaType(): string { return this.context.media_type; }
    getData(): Global.RunnerData { return this.context.data; }
    getBrowser(): Browser { return this.context.browser; }
    getContext(): BrowserContext { return this.context.context; }
    getPage(): Page { return this.context.page; }
    setWaitingState(bol: boolean) { this.context.waitingForWorker = bol; }

    async safeClose() {
        if (this.context.context) {
            try { await this.context.context.close(); } catch(e: any) { console.warn('Context close failed', e?.message); }
            this.context.context = null;
        }
        if (this.context.browser) {
            try { await this.context.browser.close(); } catch(e: any) { console.warn('Browser close failed', e?.message); }
            this.context.browser = null;
        }
        this.context.page = null;
    }

    clear() {
        this.context = {
            id: null,
            app_dir: null,
            media_type: null,
            data: null,
            browser: null,
            context: null,
            page: null,
            waitingForWorker: false,
            english: false
        };
    }

}

export default new RunnerContext();
