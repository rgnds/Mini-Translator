// ============================================================
// DeepSeek 翻译助手 — 弹窗逻辑
// ============================================================

// ---------- DOM 引用：获取所有界面元素 ----------
const configSection       = document.getElementById('config-section');       // API Key 配置区
const translateSection    = document.getElementById('translate-section');   // 翻译主界面
const apiKeyInput         = document.getElementById('api-key-input');       // API Key 输入框
const saveKeyBtn          = document.getElementById('save-key-btn');        // 保存 Key 按钮
const backToTranslateBtn  = document.getElementById('back-to-translate-btn'); // 返回翻译页按钮
const clearKeyBtn         = document.getElementById('clear-key-btn');       // 清除 Key 按钮
const keyStatus           = document.getElementById('key-status');          // Key 状态提示
const settingsBtn         = document.getElementById('settings-btn');        // 设置齿轮按钮
const sourceText          = document.getElementById('source-text');         // 原文输入框
const targetLang          = document.getElementById('target-lang');         // 目标语言下拉
const translateBtn        = document.getElementById('translate-btn');       // 翻译按钮
const resultText          = document.getElementById('result-text');         // 翻译结果显示区
const copyBtn             = document.getElementById('copy-btn');            // 复制结果按钮
const errorMsg            = document.getElementById('error-msg');           // 错误消息提示

// ---------- 常量 ----------
const STORAGE_KEY = 'deepseek_api_key';         // chrome.storage 中保存 API Key 的键名
const SAVE_TEXT_KEY = 'last_text';              // 保存上次输入文本的键名
const SAVE_LANG_KEY = 'last_lang';              // 保存上次选择语言的键名
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';  // DeepSeek API 端点

// ---------- 初始化 ----------
document.addEventListener('DOMContentLoaded', async () => {
  // 检查是否已保存 API Key
  const { [STORAGE_KEY]: apiKey } = await chrome.storage.local.get(STORAGE_KEY);

  // 解析 URL 参数（从右键菜单传入的文本和语言）
  const params = new URLSearchParams(window.location.search);
  const incomingText = params.get('text');
  const incomingLang = params.get('lang');

  if (!apiKey) {
    showConfigSection();  // 无 Key → 显示配置页
    return;
  }

  showTranslateSection();

  if (incomingText) {
    // 来自右键菜单：自动填入文本和语言，触发翻译
    sourceText.value = incomingText;
    if (incomingLang) {
      targetLang.value = incomingLang;
    }
    translateBtn.click();
  } else {
    // 来自工具栏弹窗：恢复上次保存的输入内容和语言
    const { [SAVE_TEXT_KEY]: savedText, [SAVE_LANG_KEY]: savedLang } =
      await chrome.storage.local.get([SAVE_TEXT_KEY, SAVE_LANG_KEY]);
    if (savedText) sourceText.value = savedText;
    if (savedLang) targetLang.value = savedLang;
    if (savedText) sourceText.focus();  // 聚焦到末尾以便继续输入
  }
});

// ---------- 视图切换 ----------

function showConfigSection(prefilled) {
  configSection.classList.remove('hidden');
  translateSection.classList.add('hidden');
  clearStatus();
  saveKeyBtn.disabled = false;
  saveKeyBtn.textContent = '保存 Key';
  if (prefilled) {
    apiKeyInput.value = prefilled;
  }
}

function showTranslateSection() {
  configSection.classList.add('hidden');
  translateSection.classList.remove('hidden');
  clearStatus();
  sourceText.focus();
}

function clearStatus() {
  keyStatus.textContent = '';
  keyStatus.className = 'status-msg';
  errorMsg.textContent = '';
  errorMsg.className = 'status-msg';
}

// ---------- 保存 API Key ----------
saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    setKeyStatus('请输入 API Key', 'error');
    return;
  }
  if (!key.startsWith('sk-')) {
    setKeyStatus('API Key 格式不正确，应以 sk- 开头', 'error');
    return;
  }

  saveKeyBtn.disabled = true;
  saveKeyBtn.textContent = '验证中...';

  const valid = await verifyApiKey(key);
  if (!valid) {
    saveKeyBtn.disabled = false;
    saveKeyBtn.textContent = '保存 Key';
    setKeyStatus('Key 无效或网络错误，请检查后重试', 'error');
    return;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: key });
  setKeyStatus('✓ Key 保存成功', 'success');
  setTimeout(() => showTranslateSection(), 800);
});

// ---------- 验证 API Key ----------
async function verifyApiKey(key) {
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 2
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

function setKeyStatus(text, type) {
  keyStatus.textContent = text;
  keyStatus.className = `status-msg ${type}`;
}

// ---------- 设置按钮 ----------
settingsBtn.addEventListener('click', async () => {
  const { [STORAGE_KEY]: apiKey } = await chrome.storage.local.get(STORAGE_KEY);
  showConfigSection(apiKey || '');
});

// ---------- 返回按钮 ----------
backToTranslateBtn.addEventListener('click', () => {
  showTranslateSection();
});

// ---------- 清除 Key ----------
clearKeyBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(STORAGE_KEY);
  apiKeyInput.value = '';
  keyStatus.textContent = '';
  keyStatus.className = 'status-msg';
  apiKeyInput.focus();
});

// ---------- 粘贴自动翻译：粘贴到输入框后延迟触发翻译 ----------
sourceText.addEventListener('paste', () => {
  // 用 setTimeout 等粘贴完成后读取内容
  setTimeout(() => {
    const text = sourceText.value.trim();
    if (text && !translateBtn.disabled) {
      translateBtn.click();
    }
  }, 100);
});

// ---------- 翻译 ----------
translateBtn.addEventListener('click', async () => {
  const text = sourceText.value.trim();
  if (!text) {
    setError('请输入要翻译的文本');
    return;
  }

  const lang = targetLang.value;
  const { [STORAGE_KEY]: apiKey } = await chrome.storage.local.get(STORAGE_KEY);
  if (!apiKey) {
    showConfigSection();
    return;
  }

  setLoading(true);
  setError('');
  resultText.textContent = '翻译中...';
  resultText.className = '';
  copyBtn.classList.add('hidden');

  try {
    const translated = await translate(text, lang, apiKey);
    resultText.textContent = translated;
    resultText.className = '';
    copyBtn.classList.remove('hidden');
    // 翻译成功 → 保存本次输入内容和语言
    chrome.storage.local.set({ [SAVE_TEXT_KEY]: text, [SAVE_LANG_KEY]: lang });
  } catch (err) {
    resultText.textContent = '';
    resultText.className = '';
    copyBtn.classList.add('hidden');
    setError(err.message || '翻译失败，请重试');
  } finally {
    setLoading(false);
  }
});

// ---------- 调用 DeepSeek API ----------
async function translate(text, targetLang, apiKey) {
  const systemPrompt = `You are a professional translator. Translate the following text to ${targetLang}. Return ONLY the translated text, no explanations, no notes, no quotation marks. Preserve the original formatting (line breaks, paragraphs).`;

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 4096
    })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errMsg = body.error?.message || `HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// ---------- 复制到剪贴板 ----------
copyBtn.addEventListener('click', async () => {
  const text = resultText.textContent;
  if (!text || text === '翻译中...' || resultText.classList.contains('result-placeholder')) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    const originalHTML = copyBtn.innerHTML;
    copyBtn.innerHTML = '✓ 已复制';
    setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 1500);
  } catch {
    // 剪贴板写入失败，不做处理
  }
});

// ---------- 辅助函数 ----------

function setLoading(loading) {
  translateBtn.disabled = loading;
  translateBtn.textContent = loading ? '翻译中...' : '翻译';
  document.body.classList.toggle('loading', loading);
}

function setError(msg) {
  errorMsg.textContent = msg;
  errorMsg.className = `status-msg ${msg ? 'error' : ''}`;
}

// ---------- 快捷键 ----------
sourceText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    translateBtn.click();
  }
});
