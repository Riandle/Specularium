/**
 * 给 Markdown 正文里的站内图片补上部署子路径。
 *
 * Astro 会自动给正文里的站内链接加 base，但 `![](/images/a.png)` 这类图片路径不会，
 * 部署在 `https://<用户>.github.io/<仓库名>/` 时会 404，所以在构建阶段补前缀。
 *
 * 已经是相对路径、带协议、协议相对或已含 base 的路径不动。
 * 说明：Astro 7 默认的 Sätteri 处理器不支持 hast 插件，所以这里显式挂一个 unified 处理器。
 */
import { visit } from 'unist-util-visit';

/**
 * @param {{ base?: string }} options
 */
export default function rehypeBaseLinks(options = {}) {
  const raw = options.base ?? '/';
  const base = raw.endsWith('/') ? raw : `${raw}/`;

  return (tree) => {
    if (base === '/') return;

    visit(tree, 'element', (node) => {
      for (const attr of ['href', 'src']) {
        const value = node.properties?.[attr];
        if (typeof value !== 'string') continue;
        if (!value.startsWith('/')) continue;
        if (value.startsWith('//')) continue; // 协议相对地址
        if (value.startsWith(base)) continue; // 已经带前缀
        node.properties[attr] = `${base}${value.slice(1)}`;
      }
    });
  };
}
