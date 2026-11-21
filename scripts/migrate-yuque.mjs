#!/usr/bin/env node
/**
 * 把 _local/未处理的文件 里的语雀导出稿迁移进站点内容目录。
 *
 *   npm run migrate:yuque          # 预览（dry-run），只打印将要做什么
 *   npm run migrate:yuque -- --write  # 真正写入
 *
 * 做的事：
 *   1. 路径规范化：去掉书名号、《》和空格，作者文件夹的 "by " 前缀去掉
 *   2. 补 frontmatter：title 取文件名，description 取首段
 *   3. 标题层级整体上提，让第一个标题变成 ##（语雀导出普遍从 #### 开始）
 *   4. 外链图片下载到 public/images/imported/<文档名>/，链接改成站内路径
 *   5. 清掉语雀的 OCR 注释行
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, '_local/未处理的文件');
const DOCS = resolve(ROOT, 'src/content/docs');
const IMAGES = resolve(ROOT, 'public/images/imported');

const WRITE = process.argv.includes('--write');

/** 路径段落规范化：去书名号、去空格、作者目录去掉 by 前缀。 */
function normalizeSegment(segment, isDir) {
  let name = segment.replace(/[《》]/g, '').trim();
  if (isDir) name = name.replace(/^by\s+/i, '');
  name = name.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return name || '未命名';
}

function titleFromFile(file) {
  return basename(file, extname(file)).replace(/[《》]/g, '').trim() || '未命名';
}

/** 标题层级上提：让文件中最小的一级标题变成 H2。 */
function shiftHeadings(body) {
  const levels = [...body.matchAll(/^(#{1,6})\s+/gm)].map((m) => m[1].length);
  if (levels.length === 0) return body;
  const shift = 2 - Math.min(...levels);
  if (shift === 0) return body;
  return body.replace(/^(#{1,6})\s+/gm, (_m, hashes) => {
    const next = Math.min(6, Math.max(2, hashes.length + shift));
    return `${'#'.repeat(next)} `;
  });
}

function cleanBody(body) {
  return body
    .replace(/<!--[^>]*-->\s*/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function firstParagraph(body) {
  const line = body
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && !l.startsWith('![') && !l.startsWith('>') && !l.startsWith('|'));
  if (!line) return '';
  const plain = line.replace(/[*_`[\]]/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > 90 ? `${plain.slice(0, 90)}…` : plain;
}

const EXT_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (extname(entry.name).toLowerCase() === '.md') out.push(full);
  }
  return out;
}

async function downloadImage(url, docSlug) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim();
  const ext = EXT_BY_TYPE[type] ?? 'png';
  const buffer = Buffer.from(await response.arrayBuffer());
  const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 8);
  const dir = join(IMAGES, docSlug);
  await mkdir(dir, { recursive: true });
  const filename = `${hash}.${ext}`;
  await writeFile(join(dir, filename), buffer);
  return { src: `/images/imported/${docSlug}/${filename}`, bytes: buffer.length };
}

async function main() {
  const files = await walk(SOURCE);
  const report = { written: 0, images: 0, imageBytes: 0, failures: [] };

  for (const file of files) {
    const rel = relative(SOURCE, file);
    const parts = rel.split(/[\\/]/);
    const collection = parts[0]; // 故事集 | 设定
    const dirParts = parts.slice(0, -1).map((p, index) => normalizeSegment(p, index > 0));
    const filename = `${normalizeSegment(basename(file, extname(file)), false)}.md`;
    const target = join(DOCS, collection === '故事集' ? 'stories' : 'settings', ...dirParts.slice(1), filename);

    let raw = await readFile(file, 'utf8');
    const title = titleFromFile(file);
    const docSlug = filename.replace(/\.md$/, '');

    // 图片本地化
    const imageUrls = [...raw.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[2]);
    for (const url of imageUrls) {
      try {
        const { src, bytes } = await downloadImage(url, docSlug);
        raw = raw.split(url).join(src);
        report.images += 1;
        report.imageBytes += bytes;
      } catch (error) {
        report.failures.push(`${rel} 的图片 ${url}：${error.message}`);
      }
    }

    const body = shiftHeadings(cleanBody(raw));
    const description = firstParagraph(body);
    const frontmatter = ['---', `title: ${JSON.stringify(title)}`];
    if (description) frontmatter.push(`description: ${JSON.stringify(description)}`);
    frontmatter.push('---', '');
    const output = `${frontmatter.join('\n')}\n${body}\n`;

    if (WRITE) {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, output, 'utf8');
    }
    report.written += 1;
    console.log(`${WRITE ? '写入' : '将写入'} ${relative(ROOT, target).replace(/\\/g, '/')}`);
  }

  console.log('\n=== 汇总 ===');
  console.log(`文档：${report.written} 篇`);
  console.log(`本地化图片：${report.images} 张，共 ${(report.imageBytes / 1024 / 1024).toFixed(2)} MB`);
  if (report.failures.length > 0) {
    console.log(`失败：${report.failures.length} 项`);
    for (const failure of report.failures) console.log(`  - ${failure}`);
  }
  if (!WRITE) console.log('\n这只是预览，加 --write 才会真正写入。');
}

await main();
