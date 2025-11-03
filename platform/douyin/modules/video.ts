import dayjs from 'dayjs';
import type { Page, BrowserContext } from 'playwright';
import RunnerContext from '../../../scripts/runner-context';
import { info } from '../../../scripts/log';

export async function execute(): Promise<void> {
  const page: Page = RunnerContext.getPage();
  const context: BrowserContext = RunnerContext.getContext();
  const data = RunnerContext.getData();

  await page.goto('https://creator.douyin.com/creator-micro/content/upload', { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);

  if (await isLoginRelatedPage(page)) {
    throw new Error('AuthInvalid');
  }

  await info('open_page', null);

  // 上传视频
  await page.locator("div[class^='container'] input").setInputFiles(data.file_path);

  await Promise.any([
    page.waitForURL('https://creator.douyin.com/creator-micro/content/publish?enter_from=publish_page', { timeout: 60000 }),
    page.waitForURL('https://creator.douyin.com/creator-micro/content/post/video?enter_from=publish_page', { timeout: 60000 }),
  ]);

  await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));

  const result = await Promise.race([
    page
      .waitForSelector('div.progress-div > div:has-text("上传失败")', {
        state: 'visible',
        timeout: 10 * 60 * 1000,
      })
      .then(() => 'fail' as const),
    page
      .waitForSelector('[class^="long-card"] div:has-text("重新上传")', {
        state: 'visible',
        timeout: 10 * 60 * 1000,
      })
      .then(() => 'success' as const),
  ]);

  if (result === 'fail') {
    throw new Error('UploadError');
  }

  await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));

  // ---- 填写标题 ----
  const titleContainer = page
    .locator('text=作品标题')
    .locator('..')
    .locator('xpath=following-sibling::div[1]')
    .locator('input');

  if (await titleContainer.count()) {
    await titleContainer.fill(data.title.slice(0, 30));
  } else {
    const fallbackTitleContainer = page.locator('.notranslate');
    await fallbackTitleContainer.click();
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type(data.title);
    await page.keyboard.press('Enter');
  }

  // ---- 填写话题标签 ----
  const tags = data.tags
    ? data.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag !== '')
    : [];

  const tagInput = page.locator('.zone-container');
  for (const tag of tags) {
    await tagInput.pressSequentially(`#${tag}`);
    await tagInput.press('Space');
  }

  // ---- 上传封面 ----
  if (data.cover_path) {
    await page.getByText('选择封面').click();
    await page.waitForSelector('div.semi-modal-content', { state: 'visible' });
    await page.getByText('设置竖封面').click();

    await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));
    const fileInput = page.locator("div[class^='semi-upload upload'] input.semi-upload-hidden-input");
    await fileInput.waitFor({ state: 'attached' });
    await fileInput.setInputFiles(data.cover_path);

    const doneBtn = page.locator("div[class^='extractFooter'] button:has-text('完成')");
    await doneBtn.waitFor({ state: 'visible' });
    await doneBtn.click();
  }

  // ---- 填写地理位置 ----
  const location = data.location ?? '上海市';
  const locationInput = page.locator('div.semi-select span:has-text("输入地理位置")');

  if (await locationInput.count()) {
    await locationInput.click();
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));
    await page.keyboard.type(location);

    await page.waitForSelector('div[role="listbox"] [role="option"]', { timeout: 5000 });
    await page.locator('div[role="listbox"] [role="option"]').first().click();

    const switchSelector = '[class^="info"] > [class^="first-part"] div div.semi-switch';
    if (await page.locator(switchSelector).count()) {
      const className = await page.$eval(switchSelector, el => el.className);
      if (!className.includes('semi-switch-checked')) {
        await page.locator(switchSelector).locator('input.semi-switch-native-control').click();
      }
    }
  }

  // ---- 定时发布 ----
  if (data.schedule_execute_time) {
    await page.locator("[class^='radio']:has-text('定时发布')").click();
    const publishDateHour = dayjs(data.schedule_execute_time).format('YYYY-MM-DD HH:mm');
    await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));

    await page.locator('.semi-input[placeholder="日期和时间"]').click();
    await page.keyboard.press('Control+KeyA');
    await page.keyboard.type(publishDateHour);
    await page.keyboard.press('Enter');
  }

  await info('publish_content_complete', null);

  await page.getByRole('button', { name: '发布', exact: true }).click();

  await page.waitForTimeout(3000 + Math.floor(Math.random() * 1000));
  if (await isVerificationCode(page)) {
    throw new Error('AppearVerification');
  }

  await page.waitForURL(/creator-micro\/content\/manage/, { timeout: 5 * 60 * 1000 });
  await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));

  const state = await context.storageState();
  await info('published_successfully', state);
}

// ------------------ 辅助函数 ------------------

async function isLoginRelatedPage(page: Page): Promise<boolean> {
  return (
    (await page.locator('text=登录/注册').count()) > 0 ||
    (await page.locator('text=手机号登录').count()) > 0 ||
    (await page.locator('text=扫码登录').count()) > 0 ||
    (await page.locator('input[placeholder="请输入手机号"]').count()) > 0 ||
    (await page.locator('input[placeholder="请输入验证码"]').count()) > 0
  );
}

async function isVerificationCode(page: Page): Promise<boolean> {
  return (await page.locator('text=接收短信验证码').count()) > 0;
}
