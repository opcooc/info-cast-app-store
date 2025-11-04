import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLATFORM_DIR = path.resolve(__dirname, '../platform');
const DIST_DIR = path.resolve(__dirname, '../dist');
const PACKAGE_FILE = path.resolve(__dirname, '../package.json');
const NODE_MODULES_DIR = path.resolve(__dirname, '../node_modules');

if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
} else {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

interface Readme {
  key_id: string;
  name: string;
  display_name: string;
  version: string;
  category: string;
  description: string;
  author: string;
  support_formats: string[];
  color?: string;
}

/** 复制文件夹（递归） */
function copyDirSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** 打包 zip */
async function zipFolder(sourceDir: string, outPath: string) {
  return new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', err => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function build() {
  const platformFolders = fs.readdirSync(PLATFORM_DIR).filter(f => {
    const fullPath = path.join(PLATFORM_DIR, f);
    return fs.statSync(fullPath).isDirectory();
  });

  const pkg = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf-8'));
  const version = `v${pkg.version}`;

  const appStoreList: any[] = [];

  for (const folder of platformFolders) {
    const mainFile = path.join(PLATFORM_DIR, folder, 'main.ts');
    const readmeFile = path.join(PLATFORM_DIR, folder, 'readme.json');
    const iconFile = path.join(PLATFORM_DIR, folder, 'icon.svg');
    if (!fs.existsSync(mainFile) || !fs.existsSync(readmeFile) || !fs.existsSync(iconFile)) continue;

    const targetDir = path.join(DIST_DIR, folder);
    fs.mkdirSync(targetDir, { recursive: true });

    console.log(`Building -> ${folder}`);
    await execa('tsup', [
      mainFile,
      '--format', 'cjs',
      '--out-dir', targetDir,
      '--clean'
    ], { stdio: 'inherit' });

    fs.copyFileSync(iconFile, path.join(targetDir, 'icon.svg'));

    // 额外文件
    const filesToCopy = ['stealth.min.js', 'fix-viewport.js'];
    for (const file of filesToCopy) {
      const src = path.join('./', file);
      const dest = path.join(targetDir, file);
      if (fs.existsSync(src)) fs.copyFileSync(src, dest);
    }

    // 复制指定依赖到插件中
    const depsToInclude = ['playwright', 'dayjs'];
    const targetNodeModules = path.join(targetDir, 'node_modules');
    for (const dep of depsToInclude) {
      const srcDep = path.join(NODE_MODULES_DIR, dep);
      const destDep = path.join(targetNodeModules, dep);
      if (fs.existsSync(srcDep)) {
        console.log(`  → Copying dependency: ${dep}`);
        copyDirSync(srcDep, destDep);
      } else {
        console.warn(`⚠️ Dependency not found: ${dep}`);
      }
    }

    // 打包成 zip
    const zipPath = path.join(DIST_DIR, `${folder}.zip`);
    await zipFolder(targetDir, zipPath);

    // 清理
    fs.rmSync(targetDir, { recursive: true, force: true });

    const readme: Readme = JSON.parse(fs.readFileSync(readmeFile, 'utf-8'));
    const item = {
      key_id: readme.key_id,
      name: readme.name,
      display_name: readme.display_name,
      version: readme.version,
      category: readme.category,
      install_url: `https://gitee.com/opcooc/info-cast-app-store/releases/download/latest/${folder}.zip`,
      description: readme.description,
      author: readme.author,
      config_schema: JSON.stringify({
        support_formats: readme.support_formats,
        color: readme.color || '#000000'
      })
    };

    appStoreList.push(item);
  }

  const finalJson = {
    version,
    pub_date: Date.now(),
    app_store_list: {
      platforms: appStoreList
    }
  };

  const outputJsonPath = path.join(DIST_DIR, 'app_store.json');
  fs.writeFileSync(outputJsonPath, JSON.stringify(finalJson, null, 2), 'utf-8');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
