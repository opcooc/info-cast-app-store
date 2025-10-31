import RunnerContext from '../../../scripts/runner-context';
import { success } from '../../../scripts/log';

export async function execute(): Promise<void> {
  const page = RunnerContext.getPage();
  const context = RunnerContext.getContext();

  // 前往登录页
  await page.goto('https://baijiahao.baidu.com/builder/theme/bjh/login');

  // 等待登录成功（检测 URL 是否变为主页）
  const start = Date.now();
  const timeout = 10 * 60 * 1000; // 10 分钟超时

  while (true) {
    if (page.url().includes('builder/rc/home')) break;

    if (Date.now() - start > timeout) {
      throw new Error('TimeoutError');
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // 保存登录状态
  const state = await context.storageState();
  await success('persist_auth', state, false);
}
