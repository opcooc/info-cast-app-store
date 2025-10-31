import dayjs from 'dayjs';
import RunnerContext from '../../../scripts/runner-context';
import { info } from '../../../scripts/log';
import type { Page, BrowserContext } from 'playwright';

interface Data {
  content: string[];
  title: string;
  tags?: string;
  scheduled_release_time?: string | Date;
}

export async function execute(): Promise<void> {
  const page: Page = RunnerContext.getPage();
  const context: BrowserContext = RunnerContext.getContext();
  const data: Data = RunnerContext.getData();

  await page.goto('https://creator.xiaohongshu.com/publish/publish?from=homepage&target=video', { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);

  if (await isLoginRelatedPage(page)) {
    throw new Error('AuthInvalid');
  }

  await info('open_page', null);

  await page.locator("div[class^='upload-content'] input.upload-input").setInputFiles(data.content);

  const result = await Promise.race([
    page.locator('div.stage', { hasText: '上传成功' })
        .waitFor({ state: 'visible', timeout: 10 * 60 * 1000 })
        .then(() => 'success'),

    page.locator('div.stage', { hasText: '上传失败' })
        .waitFor({ state: 'visible', timeout: 10 * 60 * 1000 })
        .then(() => 'fail'),
  ]);

  if (result === 'fail') {
    throw new Error('UploadError');
  }

  await page.locator('div.input div.d-input input.d-text').fill(data.title.slice(0, 20));

  const tags = data.tags
    ? data.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
    : [];

  const editor = page.locator('div.tiptap-container div.tiptap[contenteditable="true"]');
  await editor.focus();

  for (const tag of tags) {
    await editor.type(`#${tag}`);
    await editor.press('Space');
  }

  if (data.scheduled_release_time) {
    await page.locator("label:has-text('定时发布')").click();
    const d = dayjs(data.scheduled_release_time);
    const formatted = d.format('YYYY-MM-DD HH:mm');
    await page.locator('.el-input__inner[placeholder="选择日期和时间"]').click();
    await page.keyboard.press("Control+KeyA");
    await page.keyboard.type(formatted);
    await page.keyboard.press("Enter");
  }

  await info('publish_content_complete', null);

  const publishBtn = data.scheduled_release_time ? '定时发布' : '发布';
  await page.locator(`button:has-text("${publishBtn}")`).click();

  await page.waitForTimeout(3000 + Math.floor(Math.random() * 1000));

  if (await isVerificationCode(page)) {
    throw new Error('AppearVerification');
  }

  await page.waitForURL('https://creator.xiaohongshu.com/publish/success?**', { timeout: 5 * 60 * 1000 });
  await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));

  const state = await context.storageState();
  await info('published_successfully', state);
}

async function isLoginRelatedPage(page: Page): Promise<boolean> {
  return (await page.locator('button:has-text("登 录")').count() > 0)
      || (await page.locator('text=短信登录').count() > 0);
}

async function isVerificationCode(page: Page): Promise<boolean> {
  return (await page.locator('text=验证码').count() > 0);
}
