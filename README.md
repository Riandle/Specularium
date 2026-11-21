# 观园

一个放在 GitHub 上的公开文档站：**读者不用登录即可阅读，创作者在网页后台里编辑，保存即提交到仓库并自动上线**。
没有服务器、没有数据库，成本和维护都接近于零。

- 文档站框架：[Astro](https://astro.build/) + [Starlight](https://starlight.astro.build/)（侧边栏、目录、全文搜索、深色模式）
- 在线编辑：[Sveltia CMS](https://sveltiacms.app/)（Git 作为内容库，保存直接生成 commit）
- 托管：GitHub Pages（GitHub Actions 自动构建部署）
- 评论：可选 [Giscus](https://giscus.app/zh-CN)（基于 GitHub Discussions）

---

## 一、当前配置

仓库地址已填入 `Riandle/Specularium`，站点部署在 <https://riandle.github.io/Specularium/>：

| 文件 | 已填内容 |
| --- | --- |
| `astro.config.mjs` | `REPO_URL = https://github.com/Riandle/Specularium` |
| `public/admin/config.yml` | `backend.repo`、`site_url`、`display_url`、审核流程、草稿等字段 |
| `src/data/site.ts` | 评论仓库 `Riandle/Specularium` 与 giscus 两个 ID |

**本地私有资料**：`_local/` 目录已被 `.gitignore` 排除，既不会提交也不会发布，
目前放着《开始写作》和《Markdown 语法速查》两份内部文档。

**还需要你处理的两件事**

1. 仓库必须是**公开**的：GitHub Pages 免费版只对公开仓库开放，giscus 的评论区也是公开 Discussion。
2. 拿到 giscus 的两个 ID 填进 `src/data/site.ts`（第七节）。

改名的话要同步四个地方：`astro.config.mjs` 的 `REPO_URL`、`public/admin/config.yml` 的 `repo`/`site_url`/`display_url`、`src/data/site.ts` 的 `repo`、以及工作流里的 base 会自动跟着仓库名变。

## 二、本地跑起来

需要 Node.js 20 以上。

```bash
npm install
npm run dev        # http://localhost:4321
```

构建静态文件：

```bash
npm run build      # 产物在 dist/
npm run preview    # 本地预览构建结果
```

> 如果构建时报 Pagefind 相关的 `spawn EPERM`（常见于受限的执行环境），
> 用 `SKIP_PAGEFIND=1 npm run build` 先跳过搜索索引；GitHub Actions 里不会有这个问题。
> 在批处理/PowerShell 里这样设置：`$env:SKIP_PAGEFIND='1'; npm run build`。

## 三、部署到 GitHub Pages

1. 在 GitHub 新建仓库（公开仓库才能免费用 Pages），**不要**勾选初始化 README。
2. 推送代码：

   ```bash
   git remote add origin https://github.com/Riandle/Specularium.git
   git push -u origin main
   ```

3. 打开仓库 **Settings → Pages**，在 **Build and deployment → Source** 里选 **GitHub Actions**
   （不要选 "Deploy from a branch"）。**这一步不做，部署会报 `Failed to create deployment (status: 404)`。**
4. 推送后 **Actions** 里会自动跑「部署站点」，第一次大约 1–2 分钟。
5. 构建完成后访问 <https://riandle.github.io/Specularium/>。

站点地址和子路径由工作流自动计算：

- 仓库名是 `<账号>.github.io` → 部署在 `https://<账号>.github.io/`，base 为 `/`
- 其他仓库名 → 部署在 `https://<账号>.github.io/<仓库名>/`，base 自动设为 `/<仓库名>/`

正文里的站内链接和图片会自动补上子路径（`src/plugins/rehype-base-links.mjs`），
所以创作者照常写 `/stories/xxx/` 这样的绝对路径即可。

## 四、创作者怎么编辑

访问 `https://riandle.github.io/Specularium/admin/`，用 **GitHub 个人访问令牌**登录，不需要装任何软件：

1. 点「Sign in with Token」，按提示到 GitHub 生成 **Fine-grained token**。
2. 仓库选 `Specularium`，权限勾 **两项**：
   - **Contents: Read and write**
   - **Pull requests: Read and write**（审核流程需要，缺了会报 `Resource not accessible by personal access token`）
3. 粘贴令牌登录，之后就能编辑文档、上传图片、保存。

**审核流程是默认开启的**（`public/admin/config.yml` 里的 `publish_mode: editorial_workflow`）：
保存会提交到独立分支并自动开一个 Pull Request，维护者合并后才构建上线。作者在后台把状态从
Draft 改成 In review，维护者就能在 GitHub 上审阅。

**关于权限与安全**

- 只有拥有仓库 **Write 及以上**权限的人能登录后台。
- 令牌保存在**创作者自己的浏览器**里，不经过任何第三方服务器。
- 收回权限：把对方从仓库 Collaborators 里移除，或让他吊销令牌。
- 如果希望「作者自己不能合并自己的改动」，给 `main` 加分支保护，要求 PR 审阅通过才能合并。

**批量合并待审改动**

审核流程下**一条内容一个 PR**（同一篇反复编辑只会更新同一个 PR，不会越攒越多）。
攒了几条之后不用逐个点合并：

1. 打开仓库 **Actions → 合并待审改动 → Run workflow**；
2. 先勾 `dry_run` 跑一次，看清单对不对；
3. 再跑一次（不勾 dry_run），会把所有 `cms/` 开头的 PR 依次 squash 合并、删掉分支，
   并在最后触发**一次**部署——比逐条合并少跑好几次构建。

工作流文件：[.github/workflows/merge-pending.yml](.github/workflows/merge-pending.yml)。
合并失败的 PR（冲突、已关闭）会被跳过，不影响其他条目。

如果你本来就不需要审核，也可以把 `config.yml` 里的 `publish_mode` 那行注释掉，
保存会直接提交到 `main`，不再产生 PR。

**可选：换成一键登录**

令牌方式对非技术创作者略麻烦。想升级成「点一下用 GitHub 授权」，可以部署
[Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) 到 Cloudflare Workers（免费额度足够），
然后在 `config.yml` 的 `backend` 里加一行 `base_url: <你的 Worker 地址>`。这一步不影响现有用法。

## 五、目录结构

```
src/
  content/
    docs/            # 文档正文：Markdown，决定站点的侧边栏
      index.mdx      # 首页（splash 模板，含 hero）
      intro.md       # 观园简介
      stories/       # 「故事集」栏目
      settings/      # 「设定」栏目
    gallery/         # 作品画廊，一份 .md = 一件作品
  components/        # Gallery、Comments、MarkdownContent 覆盖
  pages/             # /gallery 列表页与作品详情页
  data/site.ts       # 评论等站点配置
  plugins/           # 构建期 rehype 插件（补子路径）
  styles/custom.css  # 主题色与版面
public/
  admin/             # Sveltia CMS 后台（index.html + config.yml）
  images/            # 图片（后台上传的也会进这里）
  files/             # PDF 等附件
scripts/
  import-docs.mjs    # Word/PDF 批量导入
  copy-cms.mjs       # 构建前把 CMS 脚本复制到 public/admin/
  md_to_docx.py      # 本地 Markdown → Word/PDF
.github/workflows/deploy.yml
```

## 六、导入已有的 Word / PDF

```bash
npm run import:docs -- "D:\资料\长夜.docx"
npm run import:docs -- "D:\资料\待导入"            # 整个文件夹
npm run import:docs -- 文件.docx --slug changye    # 指定网址
npm run import:docs -- 文件.docx --to settings     # 导入到「设定」而非「故事集」
```

- `.docx`：转成 Markdown，图片抽到 `public/images/imported/`
- `.pdf`：复制到 `public/files/`，生成一页带下载链接的说明
- `.md`：补上头部信息后放进 `src/content/docs/stories/`（或 `--to settings`）

转换保证内容不丢，但标题层级、复杂表格、文本框、公式仍需人工过一眼。

## 七、评论（可选）

评论靠 Giscus：每篇文档底部的留言会变成仓库里的 Discussion。**仓库必须公开。**

### 1. 打开 Discussions

仓库 **Settings → General → Features**，勾选 **Discussions**。

### 2. 装 Giscus App

打开 <https://github.com/apps/giscus>，点 **Install**，只授权 `Specularium` 这一个仓库
（`Install` 之后会让你选 "All repositories" 还是 "Only select repositories"）。

### 3. 建一条讨论

打开仓库的 **Discussions** 页，新建一条（分类选 **Announcements**）并发布。
giscus 只能挂到「已经存在的分类」上，空分类选不了。

### 4. 拿两个 ID

打开 <https://giscus.app/zh-CN>，依次：

1. **仓库**填 `Riandle/Specularium`——下方出现绿色对勾才说明协议装对了；
2. **Discussion 分类**选 `Announcements`；
3. 往下滚到 **「启用 giscus」**，代码框里是这样一段：

   ```html
   <script src="https://giscus.app/client.js"
           data-repo="Riandle/Specularium"
           data-repo-id="R_kgDOxxxxxxx"        ← 这个
           data-category="Announcements"
           data-category-id="DIC_kwDOxxxxxxxx"  ← 和这个
           ...>
   ```

   `data-repo-id`（`R_` 开头）和 `data-category-id`（`DIC_` 开头）就是要的两串。

### 5. 填进站点

打开 `src/data/site.ts`，替换这两个值，并把 `enable` 改成 `true`：

```ts
enable: true,
repoId: 'R_kgDOxxxxxxx',
categoryId: 'DIC_kwDOxxxxxxxx',
```

提交后，每篇文档底部就会出现评论区。

## 八、绑定自定义域名

1. 在 `public/` 下放一个 `CNAME` 文件，内容是你的域名（如 `docs.example.com`）。
2. 按 GitHub 文档配置 DNS 记录。
3. 把 `.github/workflows/deploy.yml` 里计算 base 的分支改成固定 `BASE="/"`。

## 九、常见问题

**build 成功，deploy 报 `Failed to create deployment (status: 404)`**
Pages 还没启用。到 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**，
然后回到 Actions 页面点 **Re-run all jobs**。启用之前每次部署都会是这个 404。

**页面能打开但样式全丢 / 图片 404**
base 子路径不对。确认 Pages 的地址是 `https://<账号>.github.io/<仓库名>/`，
工作流算出的 base 是否与之一致；自定义域名要改成 `/`。

**`/admin/` 打开是 404**
Pages 的 Source 必须选 **GitHub Actions**，并且第一次部署已成功。

**后台登录失败、提示权限不足**
令牌缺 `Contents: Read and write`；对方账号对仓库没有 Write 权限。

**保存了但线上没变**
看仓库 **Actions** 里最新一次运行是否失败；构建失败的日志会指出具体文件。

**搜索找不到内容**
搜索索引在构建时生成（Pagefind）。确认构建没有跳过索引，且文档不是 `draft: true`。

**想加新栏目**
在 `src/content/docs/` 下建文件夹，再在 `astro.config.mjs` 的 `sidebar` 里加一组
`{ label: '栏目名', items: [{ autogenerate: { directory: '文件夹名' } }] }`，
并在 `public/admin/config.yml` 里加一个对应的 collection，创作者就能在后台看到它。
