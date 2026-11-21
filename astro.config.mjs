// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import rehypeBaseLinks from './src/plugins/rehype-base-links.mjs';
import remarkSpoiler from './src/plugins/remark-spoiler.mjs';

// 站点部署地址与子路径。GitHub Pages 的项目站点形如 https://<用户>.github.io/<仓库名>/，
// 因此 base 必须是 "/<仓库名>"；如果仓库名是 <用户>.github.io，或绑定了自定义域名，base 用 "/"。
// 部署工作流会自动注入这两个环境变量，本地开发时用默认值即可。
const SITE_URL = process.env.SITE_URL ?? 'http://localhost:4321';
const BASE_PATH = process.env.BASE_PATH ?? '/';

// TODO: 换成你自己的仓库地址（CMS 后台 public/admin/config.yml 里的 repo 也要同步改）。
const REPO_URL = 'https://github.com/Riandle/Specularium';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'always',
  // 正文里的站内图片补上子路径（链接由 Astro 自己处理，图片不会）。
  // Sätteri 不支持 hast 插件，所以显式挂一个 unified 处理器。
  markdown: {
    processor: unified({
      remarkPlugins: [remarkSpoiler],
      rehypePlugins: [[rehypeBaseLinks, { base: BASE_PATH }]],
    }),
  },
  integrations: [
    starlight({
      title: '观园3.18.19',
      description: '观园文档库：文档公开可读，创作者在网页上直接编辑，改动自动提交到 GitHub。',
      logo: { src: './src/assets/logo.svg', alt: '观园' },
      // 全站中文：把根语言设为简体中文，Starlight 的界面文案会说中文。
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
      },
      defaultLocale: 'root',
      titleDelimiter: '·',
      // 每篇文档底部的「编辑此页」直达 GitHub 在线编辑器。
      // Starlight 会在这后面拼上完整路径（含 src/content/docs/），所以只写到 edit/main/。
      editLink: {
        baseUrl: `${REPO_URL}/edit/main/`,
      },
      social: [{ icon: 'github', label: 'GitHub', href: REPO_URL }],
      customCss: ['./src/styles/custom.css'],
      // 覆盖 MarkdownContent，在正文后追加评论区（见 src/components/Comments.astro）。
      components: {
        MarkdownContent: './src/components/MarkdownContent.astro',
      },
      // 侧边栏：两个大组（故事集、设定）+ 简介和画廊。
      // 组内文档用 autogenerate 自动收纳；放子文件夹会自动多一层分组。
      sidebar: [
        { label: '观园简介', slug: 'intro' },
        {
          label: '故事集',
          items: [{ autogenerate: { directory: 'stories' } }],
        },
        {
          label: '设定',
          items: [{ autogenerate: { directory: 'settings' } }],
        },
        {
          label: '作品画廊',
          link: '/gallery/',
        },
      ],
      // 全文搜索（Pagefind）内置，中文分词开箱可用。
      // 在受限环境（如某些沙箱）里 Pagefind 需要启动子进程，可能会失败；
      // 本地临时构建可设 SKIP_PAGEFIND=1 跳过索引，CI 里保持开启。
      pagefind: process.env.SKIP_PAGEFIND === '1' ? false : true,
      head: [
        // 让浏览器知道站点语言，利于中文排版与翻译提示。
        { tag: 'meta', attrs: { name: 'robots', content: 'index, follow' } },
      ],
    }),
  ],
});
