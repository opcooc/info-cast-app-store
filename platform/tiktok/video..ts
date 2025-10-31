import dayjs from 'dayjs';
import RunnerContext from '../../RunnerContext.cjs';
import { info } from '../../log.cjs';
import type { Page, BrowserContext, FileChooser, Locator, FrameLocator } from 'playwright';

const months = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export async function execute(): Promise<void> {
  const page: Page = RunnerContext.getPage();
  const context: BrowserContext = RunnerContext.getContext();
  const data: any = RunnerContext.getData();

  await page.goto('https://www.tiktok.com/tiktokstudio/upload', { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);

  if (await isLoginRelatedPage(page)) {
    throw new Error('AuthInvalid');
  }

  await info('open_page', null);

  const iframeExists = await page.locator('iframe[data-tt="Upload_index_iframe"]').first().isVisible().catch(() => false);
  const locatorBase: Locator | FrameLocator = iframeExists
      ? page.frameLocator('iframe[data-tt="Upload_index_iframe"]')
      : page.locator('body');

  const uploadButton: Locator = locatorBase.locator('button:has-text("Select video"):visible');
  await uploadButton.waitFor({ state: 'visible' });

  const [fileChooser]: FileChooser[] = await Promise.all([
    page.waitForEvent('filechooser'),
    uploadButton.click(),
  ]);
  await fileChooser.setFiles(data.content);

  await page.waitForFunction(() => {
    const el = document.querySelector('[data-e2e="upload_status_container"] .info-status');
    if (!el) return false;
    const cls = el.className;
    return cls.includes('success') || cls.includes('fail');
  }, {}, { timeout: 10 * 60 * 1000 });

  const className = await page.getAttribute('[data-e2e="upload_status_container"] .info-status', 'class');
  if (className?.includes('fail')) {
    throw new Error('UploadError');
  }

  const editor: Locator = locatorBase.locator('div.public-DraftEditor-content');
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.keyboard.press("End");
  await page.waitForTimeout(1000);
  await page.keyboard.insertText(data.title);
  await page.waitForTimeout(1000);
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");

  const tags: string[] = data.tags
      ? data.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag !== '')
      : [];
  for (const tag of tags) {
    await page.keyboard.press("End");
    await page.waitForTimeout(1000);
    await page.keyboard.insertText(` #${tag}`);
    await page.keyboard.press("Space");
    await page.waitForTimeout(1000);
  }
  await page.keyboard.press("Backspace");
  await page.keyboard.press("End");

  if (data.thumbnail_path) {
    await locatorBase.locator('.cover-container').click();
    await locatorBase.locator('.cover-edit-container >> text=Upload cover').click();

    const [thumbnailChooser]: FileChooser[] = await Promise.all([
      page.waitForEvent('filechooser'),
      locatorBase.locator('.upload-image-upload-area').click()
    ]);
    await thumbnailChooser.setFiles(data.thumbnail_path);
    await locatorBase.locator('div.cover-edit-panel:not(.hide-panel)').getByRole('button', { name: 'Confirm' }).click();
    await page.waitForTimeout(3000);
  }

  if (data.scheduled_release_time) {
    const d = dayjs(data.scheduled_release_time);
    const scheduleMonth = d.month() + 1;
    const day = d.date().toString().padStart(2, '0');
    const hour = d.hour().toString().padStart(2, '0');
    const rounded = Math.round(d.minute() / 5) * 5;
    const final = rounded === 55 ? 0 : rounded;
    const minute = final.toString().padStart(2, '0');

    const scheduleInputElement: Locator = locatorBase.getByLabel('Schedule');
    await scheduleInputElement.waitFor({ state: 'visible' });
    await scheduleInputElement.click({ force: true });

    if ((await locatorBase.locator('div.TUXButton-content >> text=Allow').count()) > 0) {
      await locatorBase.locator('div.TUXButton-content >> text=Allow').click();
    }

    const scheduledPicker: Locator = locatorBase.locator('div.scheduled-picker');
    await scheduledPicker.locator('div.TUXInputBox').nth(1).click();

    const calendarMonth: string = await locatorBase.locator('div.calendar-wrapper span.month-title').innerText();
    const nCalendarMonth = months.indexOf(calendarMonth) + 1;

    if (nCalendarMonth !== scheduleMonth) {
      let arrow: Locator;
      if (nCalendarMonth < scheduleMonth) {
        arrow = locatorBase.locator('div.calendar-wrapper span.arrow').nth(-1);
      } else {
        arrow = locatorBase.locator('div.calendar-wrapper span.arrow').nth(0);
      }
      await arrow.click();
    }

    const validDaysLocator: Locator = locatorBase.locator('div.calendar-wrapper span.day.valid');
    const validDaysCount = await validDaysLocator.count();
    for (let i = 0; i < validDaysCount; i++) {
      const dayElement = validDaysLocator.nth(i);
      const text = (await dayElement.innerText()).trim();
      if (text === day) {
        await dayElement.click();
        break;
      }
    }

    await scheduledPicker.locator('div.TUXInputBox').nth(0).click();
    await page.waitForTimeout(1000);
    await locatorBase.locator(`span.tiktok-timepicker-left:has-text("${hour}")`).click();
    await page.waitForTimeout(1000);
    await locatorBase.locator(`span.tiktok-timepicker-right:has-text("${minute}")`).click();
  }

  await info('publish_content_complete', null);

  const publishButton: Locator = locatorBase.locator('div.button-group button').nth(0);
  if (await publishButton.count() > 0) {
    await publishButton.click();
  }

  await page.waitForTimeout(3000 + Math.floor(Math.random() * 1000));
  if (await isVerificationCode(page)) {
    throw new Error('AppearVerification');
  }

  const postNowButton: Locator = page.getByRole('button', { name: 'Post now' });
  if (await postNowButton.count() > 0) {
    await postNowButton.click();
  }

  await page.waitForURL('https://www.tiktok.com/tiktokstudio/content', { timeout: 5 * 60 * 1000 });
  await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));

  const state = await context.storageState();
  await info('published_successfully', state);
}

async function isLoginRelatedPage(page: Page): Promise<boolean> {
  const hasLoginModal = await page.locator('#loginContainer, [data-e2e="login-title"]').count() > 0;
  const hasTopRightLoginButton = await page.locator('#top-right-action-bar-login-button').count() > 0;
  const hasLoginLabel = await page.locator('.TUXButton-label', { hasText: 'Log in' }).count() > 0;
  return hasLoginModal || hasTopRightLoginButton || hasLoginLabel;
}

async function isVerificationCode(page: Page): Promise<boolean> {
  return await page.locator('text=验证码').count() > 0;
}
