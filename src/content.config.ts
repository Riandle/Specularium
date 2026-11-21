import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

/**
 * 后台（Sveltia CMS）在字段留空时会写成 `sidebar: null`、`description: null` 这样，
 * 而 Starlight 的 schema 只接受「字段不存在」或有效值。直接把 null 当成未填写删掉，
 * 创作者就不必知道这些细节；嵌套对象里的 null（如 sidebar.order）一并清理。
 */
function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (!value || typeof value !== 'object') return value;

  const cleaned: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === null) continue;
    if (raw && typeof raw === 'object') {
      const nested = stripNulls(raw);
      // 清理后变成空对象（如 sidebar: {}）也视为没填
      if (nested && typeof nested === 'object' && Object.keys(nested).length === 0) continue;
      cleaned[key] = nested;
      continue;
    }
    cleaned[key] = raw;
  }
  return cleaned;
}

const starlightDocsSchema = docsSchema();

export const collections = {
  // 文档库：src/content/docs/**/*.{md,mdx}，Starlight 负责渲染、侧边栏、搜索。
  docs: defineCollection({
    loader: docsLoader(),
    schema: (context) => z.preprocess(stripNulls, starlightDocsSchema(context)),
  }),

  // Starlight 界面文案的本地覆盖（内置中文翻译已够用，这里只做可选微调）。
  i18n: defineCollection({ loader: i18nLoader() }),

  // 作品画廊：一份 Markdown = 一件作品，图片放在 public/images/gallery/。
  gallery: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/gallery' }),
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
      artist: z.string().optional(),
      /** 作品发布日期，用于排序。 */
      date: z.coerce.date().optional(),
      /** 封面图，指向 public/ 下的路径，如 /images/gallery/example.svg */
      image: z.string(),
      /** 详情页可放的额外图片。 */
      gallery: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
      /** 是否在首页展示。 */
      featured: z.boolean().default(false),
    }),
  }),
};
