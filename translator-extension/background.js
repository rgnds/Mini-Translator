// ============================================================
// DeepSeek 翻译助手 — 后台服务（Service Worker）
// ============================================================
// 负责右键菜单注册和点击处理。
// 工具栏图标使用 default_popup（标准弹窗），不再单独开窗口。
// 右键菜单选中文本后，打开一个独立弹窗并自动填入文本。
// ============================================================

// 支持的语言列表（与 popup.html 保持一致）
const LANGUAGES = [
  '中文', '英语', '日语', '韩语',
  '法语', '德语', '西班牙语', '俄语',
  '阿拉伯语', '葡萄牙语'
];

// ---------- 安装 / 更新时注册右键菜单 ----------
chrome.runtime.onInstalled.addListener(() => {
  // 父菜单：显示在右键菜单中
  chrome.contextMenus.create({
    id: 'translate-root',
    title: 'DeepSeek 翻译选中文本',
    contexts: ['selection']  // 只在选中文本时显示
  });

  // 子菜单：每个语言一个选项
  LANGUAGES.forEach(lang => {
    chrome.contextMenus.create({
      id: `translate-${lang}`,
      parentId: 'translate-root',
      title: lang,
      contexts: ['selection']
    });
  });
});

// ---------- 点击右键菜单项 → 打开翻译弹窗并传入文本 ----------
chrome.contextMenus.onClicked.addListener((info) => {
  // 从菜单项 ID 中提取目标语言（格式: "translate-英语"）
  const lang = info.menuItemId.replace('translate-', '');
  const text = info.selectionText || '';

  // 用 URL 参数把选中文本和语言传给 popup.html
  const params = new URLSearchParams({
    text: text,
    lang: lang
  });

  chrome.windows.create({
    url: `popup.html?${params.toString()}`,
    type: 'popup',
    width: 440,
    height: 500
  });
});
