import dayjs from 'dayjs';
import RunnerContext from "../../RunnerContext.cjs";
import { info } from "../../log.cjs";
import type { Page, BrowserContext, ElementHandle } from 'playwright';

interface PublishData {
  content: string[];
  title: string;
  tags?: string;
  category?: string;
  scheduled_release_time?: string | Date;
}

function formatShortTitle(originTitle: string): string {
  const allowedSpecialChars = '《》“”:+?%°';
  let filtered = [...originTitle].map(char => {
    if (/\w|[\u4e00-\u9fa5]/.test(char) || allowedSpecialChars.includes(char)) return char;
    if (char === ',') return ' ';
    return '';
  }).join('');
  if (filtered.length > 16) return filtered.slice(0, 16);
  if (filtered.length < 6) return filtered + ' '.repeat(6 - filtered.length);
  return filtered;
}

export async function execute(): Promise<void> {
  const page: Page = RunnerContext.getPage();
  const context: BrowserContext = RunnerContext.getContext();
  const data: PublishData = RunnerContext.getData();

  await page.goto('https://channels.weixin.qq.com/platform/post/create', { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);

  if (await isLoginRelatedPage(page)) {
    throw new Error('AuthInvalid');
  }

  await info('open_page', null);

  if (page.url().includes('/platform') && !page.url().includes('/platform/post/create')) { 
    await page.waitForSelector('button:has-text("发表视频")', { timeout: 10 * 60 * 1000 });
    await page.getByRole('button', { name: '发表视频' }).click();
    await page.waitForTimeout(5000);
  }

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('.post-upload-wrap').click()
  ]);
  await fileChooser.setFiles(data.content);

  const result = await detectUploadStatus(page);
  if (result === 'fail') {
    throw new Error('UploadError');
  }

  await page.locator('div.input-editor').click();
  await page.keyboard.type(data.title);
  await page.keyboard.press('Enter');

  const tags = data.tags
      ? data.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
      : [];
  for (const tag of tags) {
    await page.keyboard.type(`#${tag}`);
    await page.keyboard.press('Space');
  }

  const collectionElements = page.getByText("添加到合集")
      .locator("xpath=following-sibling::div")
      .locator(".option-list-wrap > div");
  if ((await collectionElements.count()) > 1) {
    await page.getByText("添加到合集").locator("xpath=following-sibling::div").click();
    await collectionElements.first().click();
  }

  if (await page.getByLabel('视频为原创').count()) {
    await page.getByLabel('视频为原创').check();
  }

  const labelVisible = await page.locator('label:has-text("我已阅读并同意 《视频号原创声明使用条款》")').isVisible();
  if (labelVisible) {
    await page.getByLabel('我已阅读并同意 《视频号原创声明使用条款》').check();
    await page.getByRole('button', { name: '声明原创' }).click();
  }

  const declareExist = await page.locator('div.label span:has-text("声明原创")').count();
  if (declareExist && data.category) {
    const checkbox = page.locator('div.declare-original-checkbox input.ant-checkbox-input');
    const disabled = await checkbox.isDisabled();
    if (!disabled) {
      await checkbox.click();
      const checkedVisible = await page.locator(
          'div.declare-original-dialog label.ant-checkbox-wrapper.ant-checkbox-wrapper-checked:visible'
      ).count();
      if (!checkedVisible) {
        await page.locator('div.declare-original-dialog input.ant-checkbox-input:visible').click();
      }
    }

    const hasCategory = await page.locator('div.original-type-form > div.form-label:has-text("原创类型"):visible').count();
    if (hasCategory) {
      await page.locator('div.form-content:visible').click();
      await page.locator(`div.form-content:visible ul.weui-desktop-dropdown__list li.weui-desktop-dropdown__list-ele:has-text("${data.category}")`)
          .first().click();
      await page.waitForTimeout(1000);
    }

    const declareButton = await page.locator('button:has-text("声明原创"):visible').count();
    if (declareButton) {
      await page.locator('button:has-text("声明原创"):visible').click();
    }
  }

  const shortTitle = formatShortTitle(data.title);
  const shortTitleInput = page.getByText('短标题', { exact: true }).locator('..').locator('xpath=following-sibling::div').locator('span input[type="text"]');
  if (await shortTitleInput.count()) await shortTitleInput.fill(shortTitle);

  if (data.scheduled_release_time) {
    await page.locator('label:has-text("定时")').nth(1).click();
    await page.click('input[placeholder="请选择发表时间"]');

    const d = dayjs(data.scheduled_release_time);
    const publishDateDay = `${d.date()}`;
    const currentMonth = `${d.month() + 1}月`;

    const pageMonth = await page.innerText('span.weui-desktop-picker__panel__label:has-text("月")');
    if (pageMonth !== currentMonth) await page.click('button.weui-desktop-btn__icon__right');

    const elements: ElementHandle<HTMLElement>[] = await page.$$('table.weui-desktop-picker__table a');
    for (const el of elements) {
      if (!(await el.evaluate(el => el.className.includes('weui-desktop-picker__disabled')))) {
        if ((await el.innerText()).trim() === publishDateDay) {
          await el.click();
          break;
        }
      }
    }

    await page.click('input[placeholder="请选择时间"]');
    await page.keyboard.press('Control+A');
    await page.keyboard.type(`${d.hour()}`);
    await page.locator('div.input-editor').click();
  }

  await info('publish_content_complete', null);

  await page.locator('div.form-btns button:has-text("发表")').click();
  await page.waitForTimeout(3000 + Math.floor(Math.random() * 1000));

  if (await isVerificationCode(page)) {
    throw new Error('AppearVerification');
  }

  await page.waitForURL('https://channels.weixin.qq.com/platform/post/list', { timeout: 5 * 60 * 1000 });
  await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));

  const state = await context.storageState();
  await info('published_successfully', state);
}

async function isLoginRelatedPage(page: Page): Promise<boolean> {
  return (await page.locator('div.title-name:has-text("微信小店")').count()) > 0;
}

async function isVerificationCode(page: Page): Promise<boolean> {
  return (await page.locator('text=验证码').count()) > 0;
}

async function detectUploadStatus(page: Page, timeout = 10 * 60 * 1000): Promise<'success' | 'fail'> {
  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > timeout) {
      throw new Error('TimeoutError');
    }

    const btnClass = await page.locator('button.weui-desktop-btn_primary:has-text("发表")').getAttribute('class');

    if (btnClass && !btnClass.includes('weui-desktop-btn_disabled')) {
      return 'success';
    } else {
      await page.waitForTimeout(2000);
    }

    const hasErrorMsg = (await page.locator('div.status-msg.error').count()) > 0;
    const hasDeleteTag = (await page.locator('div.tag-inner:has-text("删除")').count()) > 0;
    if (hasErrorMsg && hasDeleteTag) {
      return 'fail';
    }
  }
}
