import dayjs from 'dayjs';
import RunnerContext from '../../../scripts/runner-context';
import { info } from '../../../scripts/log';
import type { Page, BrowserContext } from 'playwright';

interface PublishData {
  content: string;
  title: string;
  tags?: string;
  scheduled_release_time?: string | number | Date;
  [key: string]: any;
}

export async function execute(): Promise<void> {
  const page: Page = RunnerContext.getPage();
  const context: BrowserContext = RunnerContext.getContext();
  const data: PublishData = RunnerContext.getData();

  await page.goto('https://cp.kuaishou.com/article/publish/video', { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);

  if (await isLoginRelatedPage(page)) {
    throw new Error('AuthInvalid');
  }

  await info('open_page', null);

  const uploadBtn = page.locator("button[class^='_upload-btn']");
  await uploadBtn.waitFor({ state: 'visible' });
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    uploadBtn.click(),
  ]);
  await fileChooser.setFiles(data.content);

  await guideSkip(page);

  await page.waitForSelector('text=上传中', { state: 'visible', timeout: 10 * 60 * 1000 });
  await page.waitForSelector('text=上传中', { state: 'hidden', timeout: 10 * 60 * 1000 });
  await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));

  // 输入标题
  await page.locator('#work-description-edit').click();
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Control+KeyA');
  await page.keyboard.press('Delete');
  await page.keyboard.type(data.title);
  await page.keyboard.press('Enter');

  // 输入标签
  const tags =
    data.tags?.split(',').map(tag => tag.trim()).filter(tag => tag !== '') ?? [];
  for (const tag of tags.slice(0, 3)) {
    await page.keyboard.type(`#${tag} `);
    await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));
  }

  // 定时发布时间
  if (data.scheduled_release_time) {
    const publishDateHour = dayjs(data.scheduled_release_time).format('YYYY-MM-DD HH:mm:ss');
    await page.locator("label:has-text('定时发布')").click();
    await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));

    await page.locator('div.ant-picker-input input[placeholder="选择日期时间"]').click();
    await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));

    await page.keyboard.press('Control+KeyA');
    await page.keyboard.type(publishDateHour);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));
  }

  await info('publish_content_complete', null);

  await page.getByText('发布', { exact: true }).click();
  await page.waitForTimeout(3000 + Math.floor(Math.random() * 1000));

  if (await isVerificationCode(page)) {
    throw new Error('AppearVerification');
  }

  const confirmBtn = page.getByText('确认发布', { exact: true });
  if (await confirmBtn.count() > 0) {
    await confirmBtn.click();
    await page.waitForTimeout(3000 + Math.floor(Math.random() * 1000));
    if (await isVerificationCode(page)) {
      throw new Error('AppearVerification');
    }
  }

  await page.waitForURL(
    'https://cp.kuaishou.com/article/manage/video?status=2&from=publish',
    { timeout: 5 * 60 * 1000 },
  );
  await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));

  const state = await context.storageState();
  await info('published_successfully', state);
}

// 检测是否在登录页
async function isLoginRelatedPage(page: Page): Promise<boolean> {
  return (
    (await page.locator('a.login:has-text("立即登录")').count()) > 0 ||
    (await page.locator('div.name:has-text("机构服务")').count()) > 0
  );
}

// 检测验证码弹窗
async function isVerificationCode(page: Page): Promise<boolean> {
  return (await page.locator('text=验证码').count()) > 0;
}

// 引导跳过提示
async function guideSkip(page: Page): Promise<void> {
  await page.waitForTimeout(3000);
  await page.click('[aria-label="Skip"][title="Skip"][data-action="skip"]', { force: true });
  const newFeatureButton = page.locator('button[type="button"] span:text("我知道了")');
  if (await newFeatureButton.count()) {
    await newFeatureButton.click();
  }
}
