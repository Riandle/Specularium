import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  // 文档库：src/content/docs/**/*.{md,mdx}，Starlight 负责渲染、侧边栏、搜索。
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),

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
