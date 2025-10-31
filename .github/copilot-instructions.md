# 插件发布平台开发指南

## 项目概述

这是一个用于构建和发布短视频平台插件的自动化工具。主要功能包括：
- 从 TypeScript 源码构建插件
- 自动版本管理
- 发布插件到 Gitee 仓库
- 生成插件清单和文档

## 项目结构

```
.
├── platform/         # 平台插件实现
│   ├── douyin/      # 抖音平台插件
│   └── tiktok/      # TikTok平台插件
├── scripts/         # 构建和发布脚本
└── dist/           # 构建输出目录
```

## 开发工作流

1. 插件开发
   - 在 `platform/` 目录下创建新的平台插件
   - 参考 `platform/douyin/index.ts` 的实现方式
   - 每个插件都需要包含 `version.json` 文件定义版本信息

2. 构建和发布
   - 本地开发: `npm run dev` 启动 watch 模式
   - 构建插件: `npm run build-plugins`
   - 发布插件: `npm run publish-plugins`

## 关键约定

1. 插件结构
   ```typescript
   // platform/example/index.ts
   export default function ExamplePlatform() {
     console.log('This is Example plugin v1.0.0');
   }
   ```

2. 版本管理
   - 版本号采用语义化版本（semver）
   - 当插件文件变更时会自动增加补丁版本号
   - 版本信息存储在每个插件目录下的 `version.json` 中

3. 环境变量
   - 需要配置 `.env` 文件包含 Gitee 相关配置:
     ```
     GITEE_TOKEN=xxx
     GITEE_OWNER=your_name
     GITEE_REPO=plugin-repo
     ```

## 自动化流程

- GitHub Actions 会在 main/dev 分支收到推送时自动触发构建和发布
- 发布过程会更新:
  1. 插件版本号 (`version.json`)
  2. 插件清单 (`plugins.json`)
  3. 插件文档 (`README.md`)

## 集成要点

- 使用 tsup 进行 TypeScript 构建，配置在 `tsup.config.ts`
- 发布的插件通过 Gitee Releases 分发
- 插件元数据通过 `plugins.json` 维护，包含版本、类别等信息