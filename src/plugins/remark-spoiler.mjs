/**
 * 把 :::spoiler[标题] 容器渲染成 <details><summary>，实现「点击才展开」。
 *
 *   :::spoiler[内含剧透]
 *   这里的文字默认折叠。
 *   :::
 *
 *   :::spoiler{title="另一个标题"}
 *   属性写法的标题。
 *   :::
 *
 * 说明：Astro 7 默认的 Sätteri 处理器自带 spoiler 指令，但它不支持 hast/remark 插件，
 * 而站内图片需要插件补部署子路径，所以这里统一走 unified 处理器，spoiler 由本插件实现。
 *
 * 细节：
 *   - 加 data-pagefind-ignore，折叠内容不会被站内搜索索引；
 *   - 标签既支持方括号（remark-directive 会塞进 children 的 directiveLabel 段落），
 *     也支持 {title="…"} 属性。
 */
import { visit } from 'unist-util-visit';

const DEFAULT_LABEL = '剧透，点击展开';

function plainText(node) {
  if (!node) return '';
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(plainText).join('');
}

export default function remarkSpoiler() {
  return (tree) => {
    visit(tree, 'containerDirective', (node) => {
      if (node.name !== 'spoiler') return;

      let label = (node.attributes?.title ?? '').trim();
      // 方括号标签：remark-directive 会把它作为首个段落塞进 children，并带上 directiveLabel
      const labelIndex = (node.children ?? []).findIndex((child) => child?.data?.directiveLabel);
      if (!label && labelIndex >= 0) {
        label = plainText(node.children[labelIndex]).trim();
        node.children.splice(labelIndex, 1);
      }

      node.data = node.data ?? {};
      node.data.hName = 'details';
      node.data.hProperties = {
        className: ['spoiler'],
        'data-pagefind-ignore': '',
      };
      node.children.unshift({
        type: 'paragraph',
        data: {
          hName: 'summary',
          hProperties: { className: ['spoiler__summary'] },
        },
        children: [{ type: 'text', value: label || DEFAULT_LABEL }],
      });
    });
  };
}
