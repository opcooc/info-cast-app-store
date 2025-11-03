import RunnerContext from './runner-context';
import { error as logError, convertError } from './log';
import fs from "node:fs";

interface ArgsResult {
  id: string;
  data: Global.RunnerData;
}

/**
 * 校验启动参数
 */
export function validateArgs(readme: any): ArgsResult {
  const id = process.argv[2];
  if (!id) {
    console.error("Missing argument: id");
    process.exit(1);
  }

  let data: Global.RunnerData | undefined = undefined;

  try {
    const jsonPath = process.argv[3];
    if (jsonPath) {
      const jsonStr = fs.readFileSync(jsonPath, "utf-8");
      data = JSON.parse(jsonStr);
    } else { 
      const envData = process.env.DATA;
      if (envData) { 
        data = JSON.parse(envData);
      }
    }
  } catch (e: any) {
    console.error("JSON parse error:", e.message);
    process.exit(1);
  }

  if (!data) {
    console.error("Missing argument: jsonPath or DATA");
    process.exit(1);
  }

  data.format = data.format.toLowerCase();
  if (!readme.support_formats.includes(data.format)) {
    console.error(`[format] "${data.format}" is not supported`);
    process.exit(1);
  }

  return { id, data };
}

/**
 * 通用启动器
 */
export async function runApp(readme: any, modules: Record<string, any>) {
  try {
    const { id, data } = validateArgs(readme);

    RunnerContext.setWaitingState(true);
    RunnerContext.setContext(id, false , data);
    await RunnerContext.init();

    const module = modules[RunnerContext.getFormat()];

    if (!module || typeof module.execute !== 'function') {
      throw new Error(`Format module "${RunnerContext.getFormat()}" does not export a valid execute() method`);
    }

    await module.execute();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('main error:', message);
    await logError(convertError(message), null);
    process.exitCode = 1;
  } finally {
    RunnerContext.setWaitingState(false);
    await RunnerContext.safeClose();
    RunnerContext.clear();
  }
}
