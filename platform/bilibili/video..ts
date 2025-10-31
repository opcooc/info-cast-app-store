import dayjs from 'dayjs';
import RunnerContext from '../../RunnerContext';
import { info } from '../../log';
import type { Page, BrowserContext, Locator } from 'playwright';

export async function execute(): Promise<void> {
  const page: Page = RunnerContext.getPage();
  const context: BrowserContext = RunnerContext.getContext();
  const data = RunnerContext.getData();

  await page.goto('https://baijiahao.baidu.com/builder/rc/edit?type=videoV2', { timeout: 60_000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);

  if (await isLoginRelatedPage(page)) {
    throw new Error('AuthInvalid');
  }

  await info('open_page', null);

  // 上传视频
  await page.locator("div[class^='video-main-container'] input[type='file']").setInputFiles(data.content);
  await page.waitForSelector('div .cover-overlay:has-text("上传中")', { state: 'visible', timeout: 10 * 60 * 1000 });

  const result = await Promise.race([
    page.waitForSelector('div .cover-overlay:has-text("上传中")', { state: 'hidden', timeout: 10 * 60 * 1000 }).then(() => 'success'),
    page.waitForSelector('div .cover-overlay:has-text("上传失败")', { state: 'visible', timeout: 10 * 60 * 1000 }).then(() => 'fail'),
  ]);

  if (result === 'fail') throw new Error('UploadError');

  await page.waitForSelector('.cheetah-spin-container img', { state: 'visible', timeout: 10 * 60 * 1000 });
  await delayRandom(1000, 2000);

  // 填写标题
  const titleInput = page.getByPlaceholder('添加标题获得更多推荐');
  if (data.title.length <= 8) data.title += ' 后面没有啦';
  await titleInput.fill(data.title.slice(0, 30));

  await info('publish_content_complete', null);

  // 判断是否定时发布
  if (data.scheduled_release_time) {
    await handleScheduledPublish(page, data.scheduled_release_time);
  } else {
    await page.getByRole('button', { name: '发布', exact: true }).click();
  }

  await delayRandom(3000, 4000);
  if (await isVerificationCode(page)) {
    throw new Error('AppearVerification');
  }

  await page.waitForURL('**/builder/rc/clue**', { timeout: 5 * 60 * 1000 });
  await delayRandom(1000, 2000);

  const state = await context.storageState();
  await info('published_successfully', state);
}

/** 定时发布逻辑 */
async function handleScheduledPublish(page: Page, time: string) {
  await page.getByRole('button', { name: '定时发布', exact: true }).click();
  await page.waitForSelector('div.select-wrap', { timeout: 5000 });

  const d = dayjs(time);
  const publishDateDay = `${d.month() + 1}月${d.date().toString().padStart(2, '0')}日`;
  const publishDateHour = `${d.hour()}点`;
  const publishDateMin = `${d.minute()}分`;

  await scrollSelect(page, 0, publishDateDay);
  await scrollSelect(page, 1, publishDateHour);
  await scrollSelect(page, 2, publishDateMin);

  await info('scheduled_publish_time_set', null);
  await page.locator('.cheetah-modal-confirm-btns button:has-text("定时发布")').click();
}

/** 滚动选择项 */
async function scrollSelect(page: Page, columnIndex: number, targetText: string) {
  const container = page.locator('div.rc-virtual-list div.rc-virtual-list-holder-inner').nth(columnIndex);
  await scrollToItem(container, targetText);
  await delayRandom(1000, 2000);
}

/** 滚动到目标项并点击 */
async function scrollToItem(container: Locator, targetText: string) {
  await container.waitFor({ state: 'visible' });

  const extractNumber = (text: string) => parseInt(text.replace(/[^\d]/g, ''), 10);
  const targetNumber = extractNumber(targetText);

  for (let i = 0; i < 20; i++) {
    const options = container.locator('.cheetah-select-item-option-content');
    const count = await options.count();

    for (let j = 0; j < count; j++) {
      const item = options.nth(j);
      const text = (await item.innerText()).trim();
      if (text === targetText.trim()) {
        await item.scrollIntoViewIfNeeded();
        await item.click();
        return;
      }
    }

    const firstText = await options.nth(0).innerText();
    const direction = extractNumber(firstText) > targetNumber ? -80 : 80;
    await container.hover();
    await container.page().mouse.wheel(0, direction);
    await delay(200);
  }

  throw new Error(`Target item not found: ${targetText}`);
}

/** 是否为登录页 */
async function isLoginRelatedPage(page: Page): Promise<boolean> {
  return (await page.locator('text=注册/登录百家号').count()) > 0;
}

/** 是否触发验证码验证 */
async function isVerificationCode(page: Page): Promise<boolean> {
  return (await page.locator('text=百度安全验证').count()) > 0;
}

/** 随机延迟 */
function delayRandom(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min)) + min;
  return new Promise((r) => setTimeout(r, ms));
}

/** 固定延迟 */
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
