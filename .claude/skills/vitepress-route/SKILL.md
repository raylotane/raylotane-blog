---
name: vitepress-route
description: "给 VitePress 项目新增的 .md 文件自动配置路由（侧边栏或目录索引），让新文章可被访问。触发场景：新增文章/页面后需要让它可被访问、或用户提到“路由配置”“配置路由”“注册到侧边栏”“加到目录”“配好这篇文章”等。"
---

# VitePress 路由配置

## 目标

给新增的 `.md` 文件自动完成路由配置，使其能被 VitePress 侧边栏或目录索引访问到。

## 核心判断逻辑

新增文件后，判断其所在目录是否已在 `.vitepress/config.mts` 中配置了 sidebar：

- **已配置 sidebar** → 在该目录的 sidebar `items` 数组里追加一条条目
- **未配置 sidebar** → 只在该目录的 `index.md` 列表里追加一条链接

## 工作流

### 1. 定位文件与目录

1. 确定新文件的相对路径（相对 `src/`，例如 `03_Reading/xxx.md`）。
2. 提取所在目录 `dir`（例如 `03_Reading/`，注意结尾斜杠）。
3. 提取展示文本 `text`：优先取 md 文件的一级标题（`# ` 后的文字），否则用文件名去掉 `.md` 后缀。

### 2. 判断分支

读取 `.vitepress/config.mts`，搜索是否存在 sidebar key 形如 `"/dir/"`（例如 `"/03_Reading/"`）。

### 3. 分支 A：目录已配置 sidebar

在 `config.mts` 中该目录对应的 `items` 数组末尾追加一条：

```ts
{ text: '<text>', link: '/<dir>/<文件名不带.md后缀>' },
```

**规则**：
- `link` **不带** `.md` 后缀（与现有条目保持一致）。
- 若该目录的 sidebar key 不存在，但目录本身已在导航（nav）中出现，仍按「未配置 sidebar」处理（走分支 B）。

### 4. 分支 B：目录未配置 sidebar

在该目录的 `index.md` 的列表末尾追加一条：

```markdown
- [<text>](./<文件名带.md后缀>)
```

**规则**：
- 目录 `index.md` 的链接 **带** `.md` 后缀。
- 若该目录下不存在 `index.md`，先创建它，包含骨架再追加链接：

```markdown
# <目录名>

<一句话说明>

---

## <列表标题>

- [<text>](./<文件名带.md后缀>)
```

## 约束

- 用 `replace_in_file` 做**最小改动**，绝不重写整个文件。
- 保持文件原有缩进、标点（含中文/英文引号、全角/半角字符）不变。
- 保留 sidebar 条目的中文书名号 `《》` 或引号等原文格式。
- 不要改动与本文件无关的其它条目。

## 完成后

提示用户运行 `npm run docs:dev`（或 `pnpm docs:dev`）验证链接可访问。
