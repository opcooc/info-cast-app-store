import RunnerContext from '../../../scripts/runner-context';
import { success } from '../../../scripts/log';
import type { Page, BrowserContext } from 'playwright';

export async function execute(): Promise<void> {
  const page: Page = RunnerContext.getPage();
  const context: BrowserContext = RunnerContext.getContext();

  await page.goto('https://www.tiktok.com/login?lang=en');

  const start = Date.now();
  while (true) {
    if (page.url().includes('/foryou')) break;
    if (Date.now() - start > 10 * 60 * 1000) {
      throw new Error('TimeoutError');
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const state = await context.storageState();
  await success('persist_auth', state, false);
}
