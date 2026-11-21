/**
 * 给 Markdown 正文里的站内绝对链接和图片补上部署子路径。
 *
 * Astro 会为它自己生成的资源路径加上 base，但正文里手写的
 * `[链接](/intro/)`、`![](/images/a.png)` 不会。部署在
 * `https://<用户>.github.io/<仓库名>/` 时这些链接会 404，
 * 因此在构建阶段统一补前缀。
 *
 * 已经是相对路径、带协议、协议相对或已含 base 的路径不动。
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
