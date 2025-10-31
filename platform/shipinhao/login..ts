import RunnerContext from '../../RunnerContext.cjs';
import { success } from '../../log.cjs';
import type { Page, BrowserContext } from 'playwright';

/**
 * 登录检测与认证状态持久化
 */
export async function execute(): Promise<void> {
  const page: Page = RunnerContext.getPage();
  const context: BrowserContext = RunnerContext.getContext();

  await page.goto('https://channels.weixin.qq.com');

  const start = Date.now();
  while (true) {
    // 检测是否已跳转到平台主界面
    if (page.url().includes('/platform')) break;

    // 超时 10 分钟
    if (Date.now() - start > 10 * 60 * 1000) {
      throw new Error('TimeoutError');
    }

    // 每秒检查一次
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 获取登录状态并持久化
  const state = await context.storageState();
  await success('persist_auth', state, false);
}
