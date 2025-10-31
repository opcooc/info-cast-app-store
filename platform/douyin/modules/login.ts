import RunnerContext from '../../../scripts/runner-context';
import { success } from '../../../scripts/log';
import type { Page, BrowserContext } from 'playwright';

export async function execute(): Promise<void> {
  const page: Page = RunnerContext.getPage();
  const context: BrowserContext = RunnerContext.getContext();

  await page.goto('https://creator.douyin.com', { timeout: 60_000 });

  const start = Date.now();
  const maxWait = 10 * 60 * 1000; // 10分钟超时

  // 等待登录完成（页面跳转到主页）
  while (true) {
    const currentUrl = page.url();
    if (currentUrl.includes('creator-micro/home')) break;

    if (Date.now() - start > maxWait) {
      throw new Error('TimeoutError');
    }

    await delay(1000);
  }

  // 保存登录态
  const state = await context.storageState();
  await success('persist_auth', state, false);
}

/** 延迟函数 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
