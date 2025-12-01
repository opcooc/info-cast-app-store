import type { Browser, BrowserContext, Page, LaunchOptions } from 'playwright';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const stealthScript = readFileSync(path.resolve(__dirname, 'stealth.min.js'), 'utf-8');
const viewportScript = readFileSync(path.resolve(__dirname, 'fix-viewport.js'), 'utf-8');


class RunnerContext {
    private props: Partial<Global.RunnerContextType>;

    constructor() {
        this.props = {
            id: null,
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
    setContext(id: string, english: boolean, data: Global.RunnerData) {
        this.props.id = id;
        this.props.english = english;
        this.props.data = data;
    }

    /**
     * 初始化浏览器、context 和 page
     */
    async init() {
        const data = this.props.data;
        if (!data) throw new Error('RunnerContext data not initialized');

        const launchOptions: LaunchOptions = {
            args: this.props.english ? ['--lang=en-US'] : [],
            headless: data.headless,
        };

        if (data.executablePath) launchOptions.executablePath = data.executablePath;
        if (data.proxy) launchOptions.proxy = data.proxy;

        this.props.browser = await chromium.launch(launchOptions);

        const storageState = data.cookie_info ? JSON.parse(data.cookie_info) : undefined;

        this.props.context = await this.props.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            storageState,
            ...(this.props.english ? { locale: 'en-US' } : {})
        });

        // 注入 stealth 脚本
        await this.props.context.addInitScript({ content: stealthScript });

        // 针对 douyin 平台修复 viewport
        await this.props.context.addInitScript({ content: viewportScript });

        await this.props.context.grantPermissions(['geolocation']);
        this.props.page = (await this.props.context.newPage());
        this.props.page.setDefaultTimeout(60 * 1000);

        this.setupPageEventListeners();
    }

    private setupPageEventListeners() {
        if (!this.props.page) return;

        const errorIfWaiting = (msg: string) => {
            if (this.props.waitingForWorker) {
                throw new Error(msg);
            }
        };

        this.props.page.on('close', () => errorIfWaiting('Page closed by user'));
        this.props.page.on('crash', () => errorIfWaiting('Page crash by user'));
    }

    getId(): string { return this.props.id!; }
    getAppDir(): string { return this.props.data!.app_dir!; }
    getFormat(): string { return this.props.data!.format!; }
    getData(): Global.RunnerData { return this.props.data!; }
    getBrowser(): Browser { return this.props.browser!; }
    getContext(): BrowserContext { return this.props.context!; }
    getPage(): Page { return this.props.page!; }
    setWaitingState(bol: boolean) { this.props.waitingForWorker = bol; }

    async safeClose() {
        if (this.props.context) {
            try { await this.props.context.close(); } catch(e: any) { console.warn('Context close failed', e?.message); }
            this.props.context = null;
        }
        if (this.props.browser) {
            try { await this.props.browser.close(); } catch(e: any) { console.warn('Browser close failed', e?.message); }
            this.props.browser = null;
        }
        this.props.page = null;
    }

    clear() {
        this.props = {
            id: null,
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
