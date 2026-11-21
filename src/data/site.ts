/**
 * 站点级配置 —— 部署前把这里和 astro.config.mjs、public/admin/config.yml 里的
 * YOUR_OWNER / YOUR_REPO 换成你的 GitHub 仓库。
 */
export const siteConfig = {
  repo: {
    owner: 'Riandle',
    name: 'Specularium',
    branch: 'main',
  },

  /**
   * 评论：Giscus（把 GitHub Discussions 变成评论区）。
   *
   * 拿这两个 ID 的步骤：
   *   1. 仓库必须是公开仓库，且 Settings → General → Features 里勾选了 Discussions；
   *   2. 在 https://github.com/apps/giscus 里把 App 装到这个仓库；
   *   3. 打开 https://giscus.app/zh-CN ，仓库填 Riandle/Specularium，
   *      分类选 Announcements（该分类下要先有至少一条 Discussion）；
   *   4. 滚到页面底部「启用 giscus」，代码框里
   *      data-repo-id="R_kgDO..." 和 data-category-id="DIC_kwDO..."
   *      就是这里要的两个值；
   *   5. 填进来，把 enable 改成 true。
   */
  giscus: {
    enable: false,
    repo: 'Riandle/Specularium',
    repoId: '',
    category: 'Announcements',
    categoryId: '',
    mapping: 'pathname',
    reactionsEnabled: '1',
    inputPosition: 'top',
    lang: 'zh-CN',
  },
} as const;
