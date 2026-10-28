# 🔒 WebFinger - 网站技术栈指纹与漏洞分析

> **网安毕业设计项目** — 浏览器扩展，自动识别网站技术栈，关联历史漏洞，支持 AI 辅助验证。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![WXT](https://img.shields.io/badge/WXT-0.19-indigo)](https://wxt.dev/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)

## ✨ 三大核心功能

### 1. 🔍 技术指纹识别
自动识别访问网站使用的技术栈：
- **CMS**: WordPress, Drupal, 织梦CMS, 帝国CMS, Discuz!, Typecho 等
- **框架**: React, Vue, Angular, Next.js, ThinkPHP, Laravel, Spring Boot 等
- **服务器**: Nginx, Apache, IIS, Tomcat, Tengine, Caddy 等
- **CDN**: Cloudflare, 阿里云CDN, 腾讯云CDN, 百度云加速 等
- **WAF/安全**: 阿里云WAF, 长亭雷池, 安全狗, Cloudflare WAF 等
- **分析工具**: Google Analytics, 百度统计, CNZZ, 51LA 等

> 基于 9 个维度检测：HTTP Headers / HTML / Meta Tags / Scripts / CSS / Cookies / JavaScript Globals / Favicon Hash / URL Patterns

### 2. 🛡️ 漏洞情报关联
根据识别到的技术栈和版本，自动查询关联漏洞：
- **NVD** (美国国家漏洞数据库) — CVE 编号 + CVSS 评分
- **OSV** (开源漏洞库) — 精确的包版本匹配
- **CNVD** (中国国家信息安全漏洞库) — 国产软件漏洞

> 按严重等级排序展示，支持展开详情和参考链接

### 3. 🤖 AI 漏洞验证（可选）
用户可以接入自己的 AI 模型进行辅助分析：
- 支持 OpenAI / DeepSeek / Anthropic Claude / 智谱GLM-4 等
- API Key 本地加密存储，数据直连用户指定的端点
- 不配置 AI 则仅展示漏洞信息，不做验证
- AI 分析类型：漏洞可利用性评估 / 综合风险评估 / 攻击面分析

## 📦 安装

### 开发环境
```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/webfinger.git
cd webfinger

# 安装依赖
npm install

# 开发模式 (Chrome)
npm run dev

# 开发模式 (Firefox)
npm run dev:firefox
```

### 浏览器加载
1. 运行 `npm run build` 构建扩展
2. Chrome: 打开 `chrome://extensions` → 开发者模式 → 加载已解压的扩展 → 选择 `dist/` 目录
3. Firefox: 打开 `about:debugging` → 此 Firefox → 临时载入附加组件 → 选择 `dist/` 目录

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| TypeScript | 类型安全 |
| WXT Framework | 跨浏览器扩展开发框架 |
| React 18 | Popup UI |
| Tailwind CSS 4 | 样式 |
| Vitest | 单元测试 |

## 📁 项目结构

```
src/
├── entrypoints/        # 扩展入口
│   ├── background.ts   # Service Worker（核心调度）
│   ├── content.ts      # Content Script（DOM采集）
│   ├── main-world.ts   # MAIN World 脚本（JS全局变量）
│   ├── popup/          # 弹窗 UI
│   └── options/        # 设置页面
├── core/               # 核心引擎
│   ├── analyzer.ts     # 分析协调器
│   ├── rules-engine.ts # 规则匹配引擎
│   ├── collectors/     # 数据采集器
│   ├── vulnerability/  # 漏洞情报模块（开发中）
│   └── ai/             # AI 验证模块（开发中）
├── rules/              # 指纹规则库
│   └── technologies/   # 技术指纹 JSON
├── components/         # React UI 组件
│   ├── fingerprint/    # 技术展示
│   ├── vulnerability/  # 漏洞展示
│   └── ai/             # AI 面板
└── utils/              # 工具函数
```

## 🎯 毕业设计特色

1. **国产技术深度识别** — 织梦、帝国CMS、PHPCMS、Discuz、ThinkPHP、宝塔面板、阿里/腾讯云产品
2. **漏洞情报关联** — 指纹→CVE/CNVD 自动关联，多数据源整合
3. **AI 辅助分析** — 用户自配模型，辅助验证漏洞可利用性
4. **蜜罐识别** — 扩展可识别 HFish、DecoyMini 等常见蜜罐

## 📄 开源协议

MIT License

---

*本项目为网络安全毕业设计作品，仅供学习和授权测试使用。*
