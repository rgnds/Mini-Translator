# Mini Translator — DeepSeek 驱动の浏览器翻译插件

选中网页文本 → 右键翻译 | 点击图标 → 输入翻译

## 功能

- **工具栏弹窗**：点击插件图标，输入文本翻译
- **右键菜单翻译**：选中网页文字 → 右键 → DeepSeek 翻译选中文本 → 选择目标语言
- **粘贴自动翻译**：往输入框粘贴文本后自动触发翻译
- **一键复制结果**：翻译结果旁有复制按钮
- **内容持久化**：关闭弹窗后，输入内容和语言选择下次打开自动恢复
- **弹出窗口不消失**：右键菜单打开的窗口点击页面不会关闭

## 开始使用

### 1. 获取 DeepSeek API Key

前往 [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) 注册账号并创建 API Key。

### 2. 安装插件

**Chrome / Edge 浏览器：**

1. 下载本项目代码到本地
2. 地址栏打开 `chrome://extensions/`（Edge 打开 `edge://extensions/`）
3. 打开右上角 **"开发者模式"**
4. 点击 **"加载已解压的扩展程序"**，选择 `translator-extension/` 文件夹
5. 工具栏会出现插件图标

### 3. 配置 API Key

首次点击插件图标，会进入 API Key 配置页面：

1. 输入你的 DeepSeek API Key（格式 `sk-...`）
2. 点击 **保存 Key**，插件会自动验证 Key 是否有效
3. 验证通过后进入翻译界面

## 使用方式

| 方式 | 操作 |
|------|------|
| **工具栏弹窗** | 点击浏览器工具栏的插件图标 → 输入文本 → 选择目标语言 → 点击翻译（或 `Ctrl+Enter`） |
| **右键菜单** | 在网页上选中文字 → 右键 → DeepSeek 翻译选中文本 → 选择目标语言 |
| **粘贴翻译** | 直接往输入框粘贴文本，自动触发翻译 |
| **复制结果** | 翻译完成后，点击结果区的 **📋 复制** 按钮 |

## 技术栈

- **Manifest V3** — Chrome 扩展最新标准
- **DeepSeek API** — 大模型翻译引擎
- **原生 JavaScript** — 无框架依赖
- **chrome.storage.local** — 本地持久化存储

## 项目结构

```
translator-extension/
├── manifest.json      # 扩展配置文件
├── background.js      # 后台 Service Worker（右键菜单注册）
├── popup.html         # 弹窗界面
├── popup.js           # 弹窗核心逻辑
├── popup.css          # 弹窗样式
└── icons/
    └── icon128.png    # 扩展图标
```

## 支持的语言

中文、英语、日语、韩语、法语、德语、西班牙语、俄语、阿拉伯语、葡萄牙语

## 许可证

MIT
