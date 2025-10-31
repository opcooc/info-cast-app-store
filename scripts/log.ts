import path from 'node:path';
import fs from 'node:fs/promises';
import RunnerContext from './runner-context';
import type { Page } from 'playwright';

type LogLevel = 'info' | 'success' | 'error';

interface LogPayload {
    log_level: LogLevel;
    log_code: string;
    id: string | null;
    data: any;
    image_url?: string | null;
}

/**
 * 核心日志方法
 */
async function log(
    log_level: LogLevel,
    log_code: string,
    data: any,
    screenshot: boolean = true
): Promise<void> {
    let image_url: string | null = null;

    if (screenshot) {
        image_url = await doScreenshot(
            RunnerContext.getPage(),
            RunnerContext.getId(),
            RunnerContext.getAppDir()
        );
    }

    const payload: LogPayload = {
        log_level,
        log_code,
        id: RunnerContext.getId(),
        data,
        image_url,
    };

    console.log(JSON.stringify(payload));
}

/**
 * 日志快捷方法
 */
export async function info(log_code: string, data: any, screenshot: boolean = true): Promise<void> {
    await log('info', log_code, data, screenshot);
}

export async function success(log_code: string, data: any, screenshot: boolean = true): Promise<void> {
    await log('success', log_code, data, screenshot);
}

export async function error(log_code: string, data: any, screenshot: boolean = true): Promise<void> {
    await log('error', log_code, data, screenshot);
}

/**
 * 执行截图
 */
async function doScreenshot(
    page: Page | null,
    id: string | null,
    app_dir: string | null
): Promise<string | null> {
    try {
        // 1. page 或路径为空直接返回
        if (!page || !app_dir || !id) return null;

        // 2. 生成目录路径
        const dirPath = path.join(app_dir, 'screenshot', String(id));
        await fs.mkdir(dirPath, { recursive: true });

        // 3. 生成文件路径
        const imagePath = path.join(dirPath, `${Date.now()}.png`);

        // 4. 截图
        await page.screenshot({ path: imagePath, fullPage: true });

        return imagePath;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Screenshot error:', message);
        return null;
    }
}

/**
 * 错误码映射
 */
interface ErrorMapping {
    match: RegExp;
    code: string;
}

const ERROR_MAP: ErrorMapping[] = [
    // 1. 超时类
    { match: /TimeoutError|Timeout exceeded|Navigation timeout|waiting for .* failed: timeout/i, code: 'timeout_error' },

    // 2. 元素相关
    { match: /No node found for selector/i, code: 'element_not_found' },
    { match: /not attached to the DOM/i, code: 'element_detached' },
    { match: /not visible/i, code: 'element_not_visible' },
    { match: /element is not enabled/i, code: 'element_not_enabled' },
    { match: /element is not editable/i, code: 'element_not_editable' },
    { match: /outside of the viewport/i, code: 'element_outside_viewport' },

    // 3. 页面 & 上下文
    { match: /Execution context was destroyed/i, code: 'context_destroyed' },
    { match: /Target page, context or browser has been closed/i, code: 'page_or_browser_closed' },
    { match: /browser has been closed/i, code: 'browser_closed' },

    // 4. 网络相关
    { match: /net::ERR_CONNECTION_REFUSED/i, code: 'network_connection_refused' },
    { match: /net::ERR_NAME_NOT_RESOLVED/i, code: 'network_dns_failed' },
    { match: /net::ERR_TIMED_OUT/i, code: 'network_timeout' },
    { match: /net::ERR_ABORTED/i, code: 'network_aborted' },
    { match: /net::ERR_CERT_AUTHORITY_INVALID/i, code: 'network_ssl_error' },
    { match: /net::ERR_/i, code: 'network_error' },

    // 5. 浏览器启动 & 崩溃
    { match: /Executable doesn't exist/i, code: 'browser_executable_missing' },
    { match: /Chromium revision is not downloaded/i, code: 'browser_revision_missing' },
    { match: /Failed to launch browser/i, code: 'browser_launch_failed' },
    { match: /Playwright stopped unexpectedly/i, code: 'browser_crashed' },

    // 6. 协议 & 通信
    { match: /Protocol error/i, code: 'protocol_error' },
    { match: /WebSocket is not open/i, code: 'websocket_not_open' },

    // 7. 脚本 & 执行
    { match: /Unexpected token/i, code: 'script_unexpected_token' },
    { match: /SyntaxError/i, code: 'script_syntax_error' },
    { match: /Cannot read properties of null/i, code: 'script_null_property' },
    { match: /UnhandledPromiseRejection/i, code: 'unhandled_promise' },

    // 8. 安全 & 权限
    { match: /SecurityError/i, code: 'security_error' },
    { match: /Operation denied/i, code: 'security_denied' },

    // 9. 业务自定义
    { match: /Target item not found/i, code: 'target_item_not_found' },
    { match: /AuthInvalid/i, code: 'auth_invalid' },
    { match: /ValidateLicenseError/i, code: 'validate_license_error' },
    { match: /LicenseInvalidError/i, code: 'license_invalid_error' },
    { match: /UploadError/i, code: 'upload_error' },
    { match: /AppearVerification/i, code: 'appear_verification' },

    // 默认
    { match: /.*/, code: 'unknown_error' },
];

/**
 * 将错误消息转换为错误码
 */
export function convertError(message: string): string {
    for (const { match, code } of ERROR_MAP) {
        if (match.test(message)) return code;
    }
    return 'unknown_error';
}

export default { log, info, success, error, convertError };
