# Delve

一个沉浸式阅读平台，支持多种文档格式，集成 AI 智能解释功能。

## ✨ 功能特性

- 📖 **多格式支持** - 支持 EPUB、PDF、TXT、Markdown 格式文档
- 🤖 **AI 智能解释** - 选中文本即可获取 AI 解释，不中断阅读体验
- 🌐 **多语言支持** - 支持中文/英文 AI 回答
- 📚 **阅读历史** - 自动保存阅读进度，支持继续阅读
- 🎨 **Notion 风格 UI** - 简洁优雅的阅读体验
- 📱 **响应式设计** - 适配各种屏幕尺寸
- 🔤 **字体大小调节** - 可调节阅读字体大小

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
cd reading-platform
npm install
```

### 配置 API Key

在项目根目录创建 `.env` 文件：

```env
VITE_SILICONFLOW_API_KEY=your_api_key_here
```

获取 API Key: [SiliconFlow](https://cloud.siliconflow.cn/)

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173 开始使用

### 构建生产版本

```bash
npm run build
```

## 📖 使用指南

### 导入文档

1. **粘贴文本** - 直接粘贴文章内容
2. **导入文件** - 上传 EPUB、PDF、TXT 或 Markdown 文件
3. **继续阅读** - 从历史记录中继续之前的阅读

### AI 解释功能

阅读时选中不理解的字词或句子，点击弹出的 "Dig" 按钮，AI 将提供详细解释。

### 阅读器功能

- **目录导航** - 点击目录按钮查看章节列表
- **字体调节** - 点击字体按钮调整字号
- **翻页** - 使用左右箭头或底部按钮切换章节

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **AI 服务**: SiliconFlow API (GLM-4-9B)
- **文档解析**:
  - EPUB: JSZip
  - PDF: pdfjs-dist
  - Markdown: 自定义解析器

## 📁 项目结构

```
reading-platform/
├── src/
│   ├── components/        # React 组件
│   │   ├── ArticleInput.tsx    # 首页输入组件
│   │   ├── ArticleReader.tsx   # 文本阅读器
│   │   ├── EpubReader.tsx      # 电子书阅读器
│   │   ├── DigPopover.tsx      # AI 解释弹窗
│   │   └── HistoryModal.tsx    # 历史记录弹窗
│   ├── services/          # 服务层
│   │   ├── ai.ts              # AI API 服务
│   │   ├── fileParser.ts      # 文件解析服务
│   │   └── readingHistory.ts  # 阅读历史服务
│   ├── types/             # TypeScript 类型定义
│   └── lib/               # 工具函数
├── public/
│   └── pdf.worker.js      # PDF.js worker
└── package.json
```

## 🔧 配置说明

### AI 模型配置

默认使用 `THUDM/glm-4-9b-chat` 模型，可在 `src/services/ai.ts` 中修改：

```typescript
const model = 'THUDM/glm-4-9b-chat'
```

支持的其他模型：
- `deepseek-ai/DeepSeek-R1-0528-Qwen3-8B`
- 更多模型请参考 [SiliconFlow 文档](https://docs.siliconflow.cn/)

### 阅读历史配置

- 最大历史记录数: 20 条
- 存储位置: localStorage
- 配置文件: `src/services/readingHistory.ts`

## 📝 开发说明

### 代码规范

```bash
# 运行 lint 检查
npm run lint

# 类型检查
npm run build
```

### 添加新的文档格式支持

1. 在 `src/services/fileParser.ts` 中添加解析函数
2. 在 `src/components/ArticleInput.tsx` 中添加文件类型支持
3. 更新类型定义

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [SiliconFlow](https://siliconflow.cn/) - AI API 服务
- [pdf.js](https://mozilla.github.io/pdf.js/) - PDF 解析
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Lucide Icons](https://lucide.dev/) - 图标库
