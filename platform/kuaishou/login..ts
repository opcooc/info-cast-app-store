import RunnerContext from '../../RunnerContext.cjs';
import { success } from '../../log.cjs';
import type { Page, BrowserContext } from 'playwright';

export async function execute(): Promise<void> {
  const page: Page = RunnerContext.getPage();
  const context: BrowserContext = RunnerContext.getContext();

  await page.goto('https://cp.kuaishou.com');

  const start = Date.now();
  while (true) {
    // 检测“退出登录”按钮是否存在
    const logoutCount = await page.locator('text=退出登录').count();
    if (logoutCount > 0) break;

    if (Date.now() - start > 10 * 60 * 1000) {
      throw new Error('TimeoutError');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const state = await context.storageState();
  await success('persist_auth', state, false);
}
