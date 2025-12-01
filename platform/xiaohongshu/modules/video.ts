import dayjs from "dayjs";
import RunnerContext from "../../../scripts/runner-context";
import { info } from "../../../scripts/log";
import type { Page, BrowserContext } from "playwright";

export async function execute(): Promise<void> {
  const page: Page = RunnerContext.getPage();
  const context: BrowserContext = RunnerContext.getContext();
  const data = RunnerContext.getData();

  await page.goto(
    "https://creator.xiaohongshu.com/publish/publish?from=homepage&target=video",
    { timeout: 60000 }
  );

  if (!(await waitPage(page))) {
    throw new Error("AuthInvalid");
  }

  await info("open_page", null);

  await fill_video(page, data.file_path);

  if (!(await waitUploadStatus(page))) {
    throw new Error("UploadError");
  }

  await fill_title(page, data.title);
  await fill_cover_path(page, data.cover_path);
  await fill_location(page, data.location);
  await fill_tags(page, data.tags);
  await fill_schedule_execute_time(page, data.schedule_execute_time);

  await info("publish_content_complete", null);

  if (!(await waitResult(page))) {
    throw new Error("AppearVerification");
  }

  const state = await context.storageState();
  await info("published_successfully", state);
}

async function waitPage(page: Page) {
  return await Promise.race([
    page
      .locator("div[class^='upload-content'] input.upload-input")
      .waitFor({ state: "visible", timeout: 60 * 1000 })
      .then(() => true),

    (async () => {
      while (true) {
        await page.waitForTimeout(500);
        const loginBtn = await page.locator('button:has-text("登 录")').count();
        const smsBtn = await page.locator("text=短信登录").count();
        if (loginBtn > 0 || smsBtn > 0) return false;
      }
    })(),
  ]);
}

async function waitUploadStatus(page: Page) {
  return await Promise.race([
    page
      .locator("div.stage", { hasText: "上传成功" })
      .waitFor({ state: "visible", timeout: 10 * 60 * 1000 })
      .then(() => true),

    page
      .locator("div.stage", { hasText: "上传失败" })
      .waitFor({ state: "visible", timeout: 10 * 60 * 1000 })
      .then(() => false),
  ]);
}

async function fill_tags(page: Page, tags?: string[]) {
  if (!tags) {
    return;
  }
  const editor = page.locator(
    'div.tiptap-container div.tiptap[contenteditable="true"]'
  );
  await editor.focus();
  for (const tag of tags) {
    await editor.fill(`#${tag}`);
    await editor.press("Space");
  }
}

async function fill_title(page: Page, title: string) {
  await page
    .locator("div.input div.d-input input.d-text")
    .fill(title.slice(0, 20));
}

async function fill_cover_path(page: Page, cover_path?: string) {
  if (cover_path) {
    await page.locator("div.text:has-text('设置封面')").click();
    const modal = page.locator("div.cover-modal");

    const uploadBtn = modal.locator("div.upload-btn:has-text('上传图片')");
    await uploadBtn.waitFor({ state: "visible", timeout: 60 * 1000 });

    const [thumbnailChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      await uploadBtn.click(),
    ] as const);

    await thumbnailChooser.setFiles(cover_path);
    await modal.locator("button:has-text('确认')").click();
    await modal.waitFor({ state: "hidden", timeout: 60 * 1000 });
  }
}

async function fill_schedule_execute_time(
  page: Page,
  schedule_execute_time: number
) {
  if (!schedule_execute_time) {
    return;
  }
  await page.locator("label:has-text('定时发布')").click();
  const d = dayjs(schedule_execute_time);
  const formatted = d.format("YYYY-MM-DD HH:mm");
  await page.locator('.el-input__inner[placeholder="选择日期和时间"]').click();
  await page.keyboard.press("Control+KeyA");
  await page.keyboard.type(formatted);
  await page.keyboard.press("Enter");
}

async function fill_video(page: Page, file_path: string) {
  await page
    .locator("div[class^='upload-content'] input.upload-input")
    .setInputFiles(file_path);
}

async function waitResult(page: Page) {
  return await Promise.race([
    page
      .waitForURL("https://creator.xiaohongshu.com/publish/success?**", {
        timeout: 60 * 1000,
      })
      .then(() => true),

    (async () => {
      while (true) {
        await page.waitForTimeout(500);
        const hasCaptcha = (await page.locator("text=验证码").count()) > 0;
        if (hasCaptcha) return false;
      }
    })(),
  ]);
}

async function fill_location(page: Page, location?: string) {
  if (!location) {
    return;
  }
  const locationInput = page
    .locator("div.address-input")
    .locator("div.d-select-placeholder:has-text('添加地点')");

  if (await locationInput.count()) {
    await locationInput.click();
    await page.keyboard.press("Control+KeyA");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(location);

    const dropdown = page.locator("div.d-popover.d-dropdown");

    const firstItem = dropdown.locator("div.d-grid-item >> div.item").first();
    await firstItem.waitFor({ state: "visible", timeout: 60 * 1000 });
    await firstItem.click();
  }
}

async function fill_location(page: Page, location?: string) {
  if (!location) {
    return;
  }
  const locationInput = page
    .locator("div.address-input")
    .locator("div.d-select-placeholder:has-text('添加地点')");

  if (await locationInput.count()) {
    await locationInput.click();
    await page.keyboard.press("Control+KeyA");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(location);

    const dropdown = page.locator("div.d-popover.d-dropdown");

    const firstItem = dropdown.locator("div.d-grid-item >> div.item").first();
    await firstItem.waitFor({ state: "visible", timeout: 60 * 1000 });
    await firstItem.click();
  }
}
