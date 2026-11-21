#!/usr/bin/env node
/**
 * 把 Word / PDF 资料导入站点。
 *
 *   npm run import:docs -- "D:\资料\社区公约.docx"
 *   npm run import:docs -- "D:\资料\待导入"        # 整个文件夹
 *   npm run import:docs -- 文件.docx --slug charter # 指定网址 slug
 *
 * 处理规则：
 *   .docx  → 转成 Markdown，写入 src/content/docs/documents/，图片抽到 public/images/imported/
 *   .pdf   → 复制到 public/files/，生成一页带下载链接的文档
 *   .md    → 补上缺少的头部信息后复制进文档目录
 *
 * 转换只保证「内容不丢」，排版仍需人工过一眼（见创作者手册「导入 Word / PDF」）。
 */
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import mammoth from 'mammoth';
import TurndownService from 'turndown';
import * as gfmPlugin from 'turndown-plugin-gfm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = resolve(ROOT, 'src/content/docs/documents');
const FILES_DIR = resolve(ROOT, 'public/files');
const IMAGES_DIR = resolve(ROOT, 'public/images/imported');

const gfm = gfmPlugin.gfm ?? gfmPlugin.default?.gfm;

/** 命令行参数解析：位置参数是待导入路径，--slug 覆盖单个文件的网址名。 */
function parseArgs(argv) {
  const paths = [];
  let slug = '';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--slug') {
      slug = argv[i + 1] ?? '';
      i += 1;
    } else if (arg.startsWith('--')) {
      console.warn(`[跳过] 未知参数 ${arg}`);
    } else {
      paths.push(arg);
    }
  }
  return { paths, slug };
}

const SAFE_SLUG = /[\\/:*?"<>|#%\s]+/g;

/** 文件名 → 网址 slug。保留中英文，去掉空格和危险字符。 */
function toSlug(name) {
  const cleaned = name
    .normalize('NFC')
    .replace(/\.(docx|pdf|md|markdown)$/i, '')
    .replace(SAFE_SLUG, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return cleaned || `doc-${Date.now()}`;
}

function yamlString(value) {
  return JSON.stringify(value ?? '');
}

/** 递归收集支持的文件。 */
async function collect(target, out = []) {
  const info = await stat(target);
  if (info.isDirectory()) {
    const entries = await readdir(target, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('~$')) continue; // Word 临时文件
      await collect(join(target, entry.name), out);
    }
  } else {
    const ext = extname(target).toLowerCase();
    if (['.docx', '.pdf', '.md', '.markdown'].includes(ext)) out.push(target);
  }
  return out;
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
});
if (gfm) turndown.use(gfm);

/**
 * Word 表格的单元格里通常包着 <p>，turndown 的 GFM 表格规则处理不了块级内容，
 * 会退化成原样输出的 HTML 表格。先把单元格里的段落摊平再转换。
 */
function unwrapCellParagraphs(html) {
  return html.replace(/<(td|th)([^>]*)>([\s\S]*?)<\/\1>/g, (_match, tag, attrs, inner) => {
    const flattened = inner
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1')
      .replace(/<br\s*\/?>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return `<${tag}${attrs}>${flattened}</${tag}>`;
  });
}

/**
 * GFM 表格必须有表头行，而 Word 导出的表格全是 <td>。
 * 把第一行提升为 <th> 并包进 <thead>，turndown 才会输出 Markdown 表格。
 */
function normalizeTables(html) {
  return html.replace(/<table[^>]*>([\s\S]*?)<\/table>/g, (match, inner) => {
    const rows = inner.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    if (rows.length === 0) return match;
    const toHeader = (row) =>
      row.replace(/<td(\s[^>]*)?>/gi, '<th$1>').replace(/<\/td>/gi, '</th>');
    const head = `<thead>${toHeader(rows[0])}</thead>`;
    const body = `<tbody>${rows.slice(1).join('')}</tbody>`;
    return `<table>${head}${body}</table>`;
  });
}

/** 转 Markdown 之前对 Word 输出的 HTML 做必要整理。 */
function preprocessHtml(html) {
  return normalizeTables(unwrapCellParagraphs(html));
}

/** 清理 Markdown：压缩多余空行，去掉行尾空格。 */
function tidy(markdown) {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/^(\s*)-\s{2,}/gm, '$1- ')
    .replace(/!\[\]\(/g, '![插图](')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 取正文第一个一级标题作为标题，没有就用文件名。 */
function splitTitle(markdown, fallback) {
  const lines = markdown.split('\n');
  const index = lines.findIndex((line) => /^#\s+\S/.test(line));
  if (index >= 0) {
    const title = lines[index].replace(/^#\s+/, '').trim();
    lines.splice(index, 1);
    return { title, body: tidy(lines.join('\n')) };
  }
  return { title: fallback, body: tidy(markdown) };
}

function frontmatter({ title, description }) {
  const lines = ['---', `title: ${yamlString(title)}`];
  if (description) lines.push(`description: ${yamlString(description)}`);
  lines.push('---', '');
  return lines.join('\n');
}

function firstParagraphText(markdown, max = 100) {
  const paragraph = markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith('#') && !block.startsWith('![') && !block.startsWith('|'));
  if (!paragraph) return '';
  const plain = paragraph.replace(/[*_`>#-]/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

/** 转换单个 .docx。 */
async function importDocx(file, slugOverride) {
  const warnings = [];
  let imageCount = 0;

  const result = await mammoth.convertToHtml(
    { path: file },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const buffer = await image.read();
        const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 10);
        const ext = image.contentType?.split('/')[1] ?? 'png';
        const filename = `${hash}.${ext}`;
        await mkdir(IMAGES_DIR, { recursive: true });
        await writeFile(join(IMAGES_DIR, filename), buffer);
        imageCount += 1;
        return { src: `/images/imported/${filename}` };
      }),
    },
  );

  for (const message of result.messages) {
    if (message.type === 'warning') warnings.push(message.message);
  }

  let markdown = tidy(turndown.turndown(preprocessHtml(result.value)));
  const fallbackTitle = basename(file, extname(file));
  const { title, body } = splitTitle(markdown, fallbackTitle);
  markdown = body;

  const slug = slugOverride || toSlug(fallbackTitle);
  const description = firstParagraphText(markdown);
  const target = join(DOCS_DIR, `${slug}.md`);

  await mkdir(DOCS_DIR, { recursive: true });
  await writeFile(target, `${frontmatter({ title, description })}\n${markdown}\n`, 'utf8');

  return { target, title, slug, imageCount, warnings };
}

/** PDF 作为附件 + 一页说明。 */
async function importPdf(file, slugOverride) {
  const name = basename(file, extname(file));
  const slug = slugOverride || toSlug(name);
  const filename = `${slug}.pdf`;
  await mkdir(FILES_DIR, { recursive: true });
  await copyFile(file, join(FILES_DIR, filename));

  const target = join(DOCS_DIR, `${slug}.md`);
  const content = `${frontmatter({
    title: name,
    description: `附件：${basename(file)}`,
  })}
完整内容见 PDF 附件：[下载 ${basename(file)}](/files/${filename})

> 这里是自动生成的页面。建议补一段摘要，说明这份 PDF 里有什么、什么时候该看它。
`;

  await mkdir(DOCS_DIR, { recursive: true });
  await writeFile(target, content, 'utf8');
  return { target, title: name, slug, imageCount: 0, warnings: [] };
}

/** 已有的 Markdown：缺头部信息就补一份。 */
async function importMarkdown(file, slugOverride) {
  const raw = await readFile(file, 'utf8');
  const name = basename(file, extname(file));
  const slug = slugOverride || toSlug(name);
  const target = join(DOCS_DIR, `${slug}.md`);

  let content = raw;
  if (!raw.startsWith('---')) {
    const { title, body } = splitTitle(tidy(raw), name);
    content = `${frontmatter({ title, description: firstParagraphText(body) })}\n${body}\n`;
  }

  await mkdir(DOCS_DIR, { recursive: true });
  await writeFile(target, content, 'utf8');
  return { target, title: name, slug, imageCount: 0, warnings: [] };
}

async function main() {
  const { paths, slug } = parseArgs(process.argv.slice(2));

  if (paths.length === 0) {
    console.log('用法：npm run import:docs -- <文件或文件夹> [--slug 网址名]');
    process.exitCode = 1;
    return;
  }

  const files = [];
  for (const target of paths) {
    try {
      await collect(resolve(target), files);
    } catch {
      console.error(`[跳过] 找不到 ${target}`);
    }
  }

  if (files.length === 0) {
    console.log('没有找到可导入的 .docx / .pdf / .md 文件。');
    return;
  }

  const results = [];
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    // 只有单个文件时才应用 --slug，批量导入时容易互相覆盖。
    const slugOverride = files.length === 1 ? slug : '';
    try {
      if (ext === '.docx') results.push(await importDocx(file, slugOverride));
      else if (ext === '.pdf') results.push(await importPdf(file, slugOverride));
      else results.push(await importMarkdown(file, slugOverride));
    } catch (error) {
      console.error(`[失败] ${relative(process.cwd(), file)}：${error.message}`);
    }
  }

  console.log(`\n导入完成，共 ${results.length} 个文件：\n`);
  for (const item of results) {
    const rel = relative(ROOT, item.target).replace(/\\/g, '/');
    console.log(`  ✓ ${item.title}`);
    console.log(`    文件：${rel}`);
    if (item.imageCount > 0) console.log(`    图片：${item.imageCount} 张 → public/images/imported/`);
    for (const warning of item.warnings.slice(0, 5)) {
      console.log(`    提示：${warning}`);
    }
  }
  console.log('\n下一步：npm run dev 本地预览，确认排版后再提交。');
}

await main();
