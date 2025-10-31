import RunnerContext from './runner-context';
import { error as logError, convertError } from './log';

interface ArgsResult {
  id: string;
  app_dir: string;
  media_type: string;
  data: Record<string, any>;
}

/**
 * 校验启动参数
 */
export function validateArgs(readme: any): ArgsResult {
  const id = process.argv[2];
  const app_dir = process.argv[3];
  const media_type = process.argv[4];
  const envData = process.env.DATA;

  if (!id || !app_dir || !media_type || !envData) {
    console.error('[argv.id]、[argv.app_dir]、[argv.media_type]、[env.data] is required');
    process.exit(1);
  }

  let data: Record<string, any>;
  try {
    data = JSON.parse(envData);
  } catch (e: any) {
    console.error('[env.data] JSON parse error:', e.message);
    process.exit(1);
  }

  if (!readme.support_formats.includes(media_type.toLowerCase())) {
    console.error(`[media_type] "${media_type}" is not supported`);
    process.exit(1);
  }

  return { id, app_dir, media_type: media_type.toLowerCase(), data };
}

/**
 * 通用启动器
 */
export async function runApp(readme: any, modules: Record<string, any>) {
  try {
    const { id, app_dir, media_type, data } = validateArgs(readme);

    RunnerContext.setWaitingState(true);
    RunnerContext.setContext({ id, app_dir, media_type, english: false, data });
    await RunnerContext.init();

    const module = modules[RunnerContext.getMediaType()];

    if (!module || typeof module.execute !== 'function') {
      throw new Error(`MediaType module "${media_type}" does not export a valid execute() method`);
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
