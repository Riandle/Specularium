/**
 * 站点级配置 —— 部署前把这里和 astro.config.mjs、public/admin/config.yml 里的
 * YOUR_OWNER / YOUR_REPO 换成你的 GitHub 仓库。
 */
export const siteConfig = {
  repo: {
    owner: 'YOUR_OWNER',
    name: 'YOUR_REPO',
    branch: 'main',
  },

  /**
   * 评论：Giscus（把 GitHub Discussions 变成评论区）。
   * 打开 https://giscus.app/zh-CN ，填入仓库后会生成 repoId 和 categoryId。
   * 需要先在仓库 Settings → General → Features 里勾选 Discussions。
   * 三项都填好后把 enable 改成 true 即可。
   */
  giscus: {
    enable: false,
    repo: 'YOUR_OWNER/YOUR_REPO',
    repoId: '',
    category: 'Announcements',
    categoryId: '',
    mapping: 'pathname',
    reactionsEnabled: '1',
    inputPosition: 'top',
    lang: 'zh-CN',
  },
} as const;
