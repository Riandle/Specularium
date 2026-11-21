---
title: 开始写作
description: 创作者如何登录后台、编辑文档、把改动发布到线上。
sidebar:
  order: 1
---

整个流程只有四步，不需要安装任何软件。

## 1. 打开后台

在浏览器访问站点后台：`https://riandle.github.io/Specularium/admin/`。

## 2. 用 GitHub 令牌登录

后台支持直接粘贴 **GitHub 个人访问令牌**（Personal Access Token）登录，不需要另外注册账号。

首次登录时：

1. 点「Sign in with Token」。
2. 点对话框里的链接，跳到 GitHub 的令牌生成页（权限已预先勾选）。
3. 按提示创建 **Fine-grained token**，仓库选本仓库，权限勾选：
   - **Contents: Read and write**（必须，用于读写文档和图片）
   - **Pull requests: Read and write**（仅当你启用了「编辑流程」，见文末）
4. 复制生成的令牌，粘贴回后台对话框，登录。

:::caution[令牌不要外传]
令牌等同于你的 GitHub 写权限。后台会把它存在**你自己浏览器**的本地存储里，不会上传到站点服务器。
公共电脑上用完请点退出，并到 GitHub 设置里吊销该令牌。
:::

## 3. 写，然后保存

后台左侧是内容库，分「文档」「作品画廊」两组。

- **改已有文档**：点进去直接改正文，右上角「保存」。
- **写新文档**：点「新建」，填标题、摘要，正文用 Markdown 写。
  文档的文件名就是网址的一部分，建议用英文小写加连字符，例如 `reading-notes`。

保存后，后台会直接把改动**提交到 GitHub**（一次提交 = 一次修改记录）。

## 4. 等它上线

提交后，GitHub Actions 会自动重新构建站点，通常 **1–2 分钟**后线上就能看到。

可以在仓库的 **Actions** 页面看构建进度；如果构建失败，页面下方会显示是哪一步出的错。

## 关于「编辑流程」

默认是**直接发布**：保存即提交到主分支，立刻上线。

如果你的团队希望有人审一下再上线，可以打开「编辑流程」：改动先存到独立分支并自动开一个
Pull Request，审阅者合并后才会发布。打开方式是编辑 `public/admin/config.yml`，取消
`publish_mode: editorial_workflow` 这一行的注释；同时记得让创作者的令牌多勾一项
**Pull requests** 权限。
