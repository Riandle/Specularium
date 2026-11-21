/**
 * 把 node_modules 里的 Sveltia CMS 单文件脚本复制到 public/admin/。
 * 由 npm run dev / npm run build 之前的钩子自动执行，通常不需要手动运行。
 */
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = resolve(root, 'node_modules/@sveltia/cms/dist/sveltia-cms.js');
const to = resolve(root, 'public/admin/sveltia-cms.js');

if (!existsSync(from)) {
  console.error('[cms] 找不到 @sveltia/cms。请先运行 npm install。');
  process.exit(1);
}

await mkdir(dirname(to), { recursive: true });

const [source, target] = await Promise.all([
  stat(from),
  stat(to).catch(() => null),
]);

if (target && target.size === source.size && target.mtimeMs >= source.mtimeMs) {
  console.log('[cms] sveltia-cms.js 已是最新，跳过复制。');
} else {
  await copyFile(from, to);
  console.log('[cms] 已复制 sveltia-cms.js 到 public/admin/。');
}
