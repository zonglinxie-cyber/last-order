// 部署到 GitHub Pages 子路径（/last-order/m/）时所有 public 资产都要带 BASE_URL 前缀。
// 在 node（规则测试）里 import.meta.env 不存在，`?.` 回落到 "/"；Vite 构建期会把它静态替换。
// asset 是导出的稳定契约：全仓 30+ 处 public 资产引用经这一处走，不要内联复制。
const BASE: string = import.meta.env?.BASE_URL ?? "/";

export const asset = (path: string) => `${BASE}${path.replace(/^\/+/, "")}`;
