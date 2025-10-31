import RunnerContext from '../../RunnerContext.cjs';
import { success } from '../../log.cjs';
import type { Page, BrowserContext } from 'playwright';

export async function execute(): Promise<void> {
  const page: Page = RunnerContext.getPage();
  const context: BrowserContext = RunnerContext.getContext();

  await page.goto('https://creator.xiaohongshu.com');

  const start = Date.now();
  while (true) {
    if (page.url().includes('new/home')) break;
    if (Date.now() - start > 10 * 60 * 1000) {
      throw new Error('TimeoutError');
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const state = await context.storageState();
  await success('persist_auth', state, false);
}
