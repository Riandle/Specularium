/**
 * 处理 GitHub Pages 的 base 子路径。
 * 仓库叫 <用户>.github.io 或绑了自定义域名时 base 是 "/"，
 * 否则是 "/<仓库名>/"，所以链接和图片都必须带上 base。
 */
const BASE = import.meta.env.BASE_URL; // 一定以 "/" 结尾

const join = (path: string) => `${BASE}${path.replace(/^\/+/, '')}`;

/** public/ 下的静态资源，如 asset('/images/gallery/a.jpg') */
export const asset = join;

/** 站内页面链接，如 link('/gallery/') */
export const link = join;
