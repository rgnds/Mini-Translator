// ============================================================
// DeepSeek 翻译助手 — 弹窗逻辑
// 本文件负责：
//   1. 弹窗的初始化（检查 API Key、恢复上次输入内容）
//   2. 视图切换（配置区 ↔ 翻译区）
//   3. API Key 的验证和持久化存储
//   4. 调用 DeepSeek API 执行翻译
//   5. 粘贴自动翻译、复制结果等交互
// ============================================================

// ---------- DOM 引用：获取所有界面元素 ----------
// 每个变量对应 HTML 中一个元素的 id。把它们提前声明在文件顶部，
// 后面的函数直接使用这些变量，不需要反复 document.getElementById。
const configSection       = document.getElementById('config-section');       // API Key 配置区（输入 Key 的页面）
const translateSection    = document.getElementById('translate-section');   // 翻译主界面（输入文本、翻译、看结果）
const apiKeyInput         = document.getElementById('api-key-input');       // API Key 输入框（密码类型，输入内容不可见）
const saveKeyBtn          = document.getElementById('save-key-btn');        // 保存 Key 按钮
const backToTranslateBtn  = document.getElementById('back-to-translate-btn'); // 返回翻译页按钮（在配置区底部）
const clearKeyBtn         = document.getElementById('clear-key-btn');       // 清除 Key 按钮（删除已保存的 Key）
const keyStatus           = document.getElementById('key-status');          // Key 状态提示文字（验证成功/失败信息）
const settingsBtn         = document.getElementById('settings-btn');        // 设置齿轮按钮（翻译区右上角 ⚙️）
const sourceText          = document.getElementById('source-text');         // 原文输入框（用户输入待翻译的文本）
const targetLang          = document.getElementById('target-lang');         // 目标语言下拉菜单
const translateBtn        = document.getElementById('translate-btn');       // 翻译按钮（点击触发翻译）
const resultText          = document.getElementById('result-text');         // 翻译结果显示区
const copyBtn             = document.getElementById('copy-btn');            // 复制结果按钮（点击把译文复制到剪贴板）
const errorMsg            = document.getElementById('error-msg');           // 错误消息提示（网络错误、API 错误等）

// ---------- 常量 ----------
// 这些键名用于 chrome.storage.local 存取数据。集中定义防止拼写错误。
const STORAGE_KEY = 'deepseek_api_key';         // chrome.storage 中保存 API Key 的键名
const SAVE_TEXT_KEY = 'last_text';              // 保存上次输入文本的键名（用于弹窗关闭后恢复）
const SAVE_LANG_KEY = 'last_lang';              // 保存上次选择语言的键名
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';  // DeepSeek API 端点（OpenAI 兼容格式）

// ---------- 初始化 ----------
// DOMContentLoaded 事件在 HTML 解析完成后触发。
// 这里做三件事：
//   1. 检查是否已保存 API Key，决定显示配置区还是翻译区
//   2. 解析 URL 参数（右键菜单传入的文本和语言）
//   3. 根据来源不同（右键菜单 vs 工具栏弹窗）做不同处理
document.addEventListener('DOMContentLoaded', async () => {
  // 从 chrome.storage 中读取已保存的 API Key
  const { [STORAGE_KEY]: apiKey } = await chrome.storage.local.get(STORAGE_KEY);

  // 解析 URL 参数（从右键菜单传入的文本和语言）
  // 格式：popup.html?text=hello&lang=英语
  const params = new URLSearchParams(window.location.search);
  const incomingText = params.get('text');
  const incomingLang = params.get('lang');

  // 如果没有 API Key，直接显示配置区让用户输入，不再往下执行
  if (!apiKey) {
    showConfigSection();  // 无 Key → 显示配置页
    return;
  }

  // 有 Key → 显示翻译主界面
  showTranslateSection();

  // 区分两种进入方式：
  if (incomingText) {
    // 方式一：来自右键菜单（用户选中网页文字 → 右键 → DeepSeek 翻译）
    // 自动把选中的文本填入输入框，设置目标语言，然后立刻触发翻译
    sourceText.value = incomingText;
    if (incomingLang) {
      targetLang.value = incomingLang;
    }
    translateBtn.click();  // 自动点击翻译按钮，用户无需二次操作
  } else {
    // 方式二：来自工具栏点击（标准弹窗）
    // 恢复上次关闭弹窗时的输入内容和语言选择
    const { [SAVE_TEXT_KEY]: savedText, [SAVE_LANG_KEY]: savedLang } =
      await chrome.storage.local.get([SAVE_TEXT_KEY, SAVE_LANG_KEY]);
    if (savedText) sourceText.value = savedText;
    if (savedLang) targetLang.value = savedLang;
    // 如果恢复出了文本，把光标移到文本末尾，方便继续编辑
    if (savedText) sourceText.focus();
  }
});

// ---------- 视图切换 ----------
// 两个视图互斥：要么显示配置区，要么显示翻译区。
// 通过给元素添加/移除 'hidden' 类来控制显示隐藏。

// 显示配置区（API Key 设置页面）
// prefilled 参数：如果传入了已保存的 Key，自动填入输入框让用户确认
function showConfigSection(prefilled) {
  configSection.classList.remove('hidden');
  translateSection.classList.add('hidden');
  clearStatus();
  // 每次进入配置区都重置保存按钮状态。防止上一次保存操作遗留"验证中..."的禁用状态。
  saveKeyBtn.disabled = false;
  saveKeyBtn.textContent = '保存 Key';
  if (prefilled) {
    apiKeyInput.value = prefilled;  // 自动填入已保存的 Key
  }
}

// 显示翻译区
function showTranslateSection() {
  configSection.classList.add('hidden');
  translateSection.classList.remove('hidden');
  clearStatus();
  sourceText.focus();  // 自动聚焦到原文输入框，用户可以直接打字
}

// 清空所有状态消息
// 包括 Key 状态提示和错误消息，两者使用不同的 DOM 元素
function clearStatus() {
  keyStatus.textContent = '';
  keyStatus.className = 'status-msg';
  errorMsg.textContent = '';
  errorMsg.className = 'status-msg';
}

// ---------- 保存 API Key ----------
// 用户点击"保存 Key"按钮时触发。执行流程：
//   1. 检查输入是否为空
//   2. 检查格式是否正确（以 sk- 开头）
//   3. 发一条测试请求到 DeepSeek 验证 Key 是否有效
//   4. 验证通过 → 存入 chrome.storage → 跳转到翻译界面
//   5. 验证失败 → 提示错误，按钮恢复可点击
saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  // 空值检查：如果没有输入内容，提示用户
  if (!key) {
    setKeyStatus('请输入 API Key', 'error');
    return;
  }
  // 格式检查：DeepSeek 的 API Key 以 sk- 开头
  if (!key.startsWith('sk-')) {
    setKeyStatus('API Key 格式不正确，应以 sk- 开头', 'error');
    return;
  }

  // 进入验证状态：禁用按钮防止重复点击，改变按钮文字提示用户等待
  saveKeyBtn.disabled = true;
  saveKeyBtn.textContent = '验证中...';

  // 调用验证函数，向 DeepSeek 发一条极短的请求测试 Key 是否有效
  const valid = await verifyApiKey(key);
  if (!valid) {
    // 验证失败：恢复按钮可点击，恢复文字，提示错误信息
    saveKeyBtn.disabled = false;
    saveKeyBtn.textContent = '保存 Key';
    setKeyStatus('Key 无效或网络错误，请检查后重试', 'error');
    return;
  }

  // 验证通过：将 Key 永久保存到 chrome.storage.local（浏览器关闭后仍存在）
  await chrome.storage.local.set({ [STORAGE_KEY]: key });
  setKeyStatus('✓ Key 保存成功', 'success');
  // 延迟 800ms 后自动跳转到翻译界面，让用户看到成功提示
  setTimeout(() => showTranslateSection(), 800);
});

// ---------- 验证 API Key ----------
// 向 DeepSeek API 发一条最简单的请求（只发"Hi"，要求最多返回 2 个 token），
// 然后检查 HTTP 状态码。200 说明 Key 有效，其他状态码说明无效。
// 这样做的目的：
//   - 极少量消耗 token，不浪费额度
//   - 验证速度快（请求极小）
//   - 在保存前就把无效 Key 拦截下来
async function verifyApiKey(key) {
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`  // Bearer Token 认证方式
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: 'Hi' }],  // 只发一个单词
        max_tokens: 2  // 限制返回 token 数，加速响应
      })
    });
    return res.ok;  // HTTP 状态码 200-299 算有效
  } catch {
    // 网络请求本身失败（无网络、DNS 解析失败等）也返回 false
    return false;
  }
}

// 设置 Key 状态提示文字
// type 参数支持 'error' 和 'success' 两种样式，对应红色和绿色
function setKeyStatus(text, type) {
  keyStatus.textContent = text;
  keyStatus.className = `status-msg ${type}`;
}

// ---------- 设置按钮 ----------
// 点击翻译区右上角的 ⚙️ 齿轮按钮，进入配置区。
// 如果已保存 API Key，自动填入输入框让用户确认或修改。
settingsBtn.addEventListener('click', async () => {
  // 从存储中读取已保存的 Key
  const { [STORAGE_KEY]: apiKey } = await chrome.storage.local.get(STORAGE_KEY);
  showConfigSection(apiKey || '');  // 有 Key 就填入，没有就留空
});

// ---------- 返回按钮 ----------
// 在配置区底部，不保存任何改动，直接回到翻译界面
backToTranslateBtn.addEventListener('click', () => {
  showTranslateSection();
});

// ---------- 清除 Key ----------
// 从 chrome.storage 中删除已保存的 API Key，并清空输入框
clearKeyBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(STORAGE_KEY);  // 从持久存储中删除
  apiKeyInput.value = '';
  keyStatus.textContent = '';
  keyStatus.className = 'status-msg';
  apiKeyInput.focus();  // 聚焦到输入框，方便重新输入
});

// ---------- 粘贴自动翻译 ----------
// 用户往输入框粘贴文本后，延迟 100ms 自动点击翻译按钮。
// 用 setTimeout 而不是立即执行，是因为粘贴操作完成后文本才真正写入输入框。
// 只会在翻译按钮可用时触发（防止翻译进行中重复触发）。
sourceText.addEventListener('paste', () => {
  // 使用 setTimeout 延迟执行，确保粘贴的内容已写入输入框
  setTimeout(() => {
    const text = sourceText.value.trim();
    // 检查文本非空且翻译按钮可用（不在加载状态）
    if (text && !translateBtn.disabled) {
      translateBtn.click();  // 自动触发翻译
    }
  }, 100);
});

// ---------- 翻译 ----------
// 用户点击"翻译"按钮时触发。完整流程：
//   1. 检查输入是否为空
//   2. 检查 API Key 是否存在
//   3. 进入加载状态（禁用按钮、显示"翻译中..."、隐藏复制按钮）
//   4. 调用 translate() 函数向 DeepSeek API 发请求
//   5. 成功 → 显示结果、显示复制按钮、保存输入内容到存储
//   6. 失败 → 清空结果、显示错误信息
//   7. 无论成功失败 → 恢复按钮可用状态
translateBtn.addEventListener('click', async () => {
  const text = sourceText.value.trim();
  // 空文本检查，不浪费 API 调用
  if (!text) {
    setError('请输入要翻译的文本');
    return;
  }

  const lang = targetLang.value;
  // 每次翻译前都重新读取 Key（防止用户在翻译过程中通过其他页面改了 Key）
  const { [STORAGE_KEY]: apiKey } = await chrome.storage.local.get(STORAGE_KEY);
  if (!apiKey) {
    showConfigSection();  // Key 不存在 → 跳转到配置页
    return;
  }

  // 进入加载状态
  setLoading(true);
  setError('');  // 清除之前的错误信息
  resultText.textContent = '翻译中...';
  resultText.className = '';
  copyBtn.classList.add('hidden');  // 翻译进行时隐藏复制按钮

  try {
    const translated = await translate(text, lang, apiKey);
    resultText.textContent = translated;  // 显示翻译结果
    resultText.className = '';
    copyBtn.classList.remove('hidden');  // 翻译完成，显示复制按钮
    // 翻译成功后保存本次的输入内容和目标语言，下次打开弹窗可以恢复
    chrome.storage.local.set({ [SAVE_TEXT_KEY]: text, [SAVE_LANG_KEY]: lang });
  } catch (err) {
    // 翻译过程中任何异常（网络错误、API 返回错误等）都会走到这里
    resultText.textContent = '';
    resultText.className = '';
    copyBtn.classList.add('hidden');
    setError(err.message || '翻译失败，请重试');
  } finally {
    // finally 块无论 try 成功还是 catch 捕获错误都会执行
    setLoading(false);  // 恢复按钮可用状态
  }
});

// ---------- 调用 DeepSeek API ----------
// 核心翻译函数。接收原文、目标语言、API Key 三个参数。
// 使用 OpenAI 兼容的 API 格式，构造 system prompt 和 user message。
// system prompt 用英文写，因为 DeepSeek 对英文指令的理解最稳定。
// 核心指令：只返回翻译结果，不加解释、不加引号、保留原文格式。
async function translate(text, targetLang, apiKey) {
  // system prompt 告知 AI 扮演专业翻译角色
  const systemPrompt = `You are a professional translator. Translate the following text to ${targetLang}. Return ONLY the translated text, no explanations, no notes, no quotation marks. Preserve the original formatting (line breaks, paragraphs).`;

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',  // 使用推荐的 v4 flash 模型，速度快、成本低
      messages: [
        // system 消息：设定 AI 的行为和角色
        { role: 'system', content: systemPrompt },
        // user 消息：用户输入的待翻译文本
        { role: 'user', content: text }
      ],
      temperature: 0.3,  // 低温度 (0-2)，值越低输出越确定、越少创造性，适合翻译
      max_tokens: 4096   // 允许最大返回 token 数，足够覆盖大部分翻译结果
    })
  });

  // 如果 API 返回了错误状态码（4xx 或 5xx），尝试从响应体中提取错误信息
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));  // 解析失败时使用空对象
    const errMsg = body.error?.message || `HTTP ${res.status}`;  // 优先使用 API 返回的错误信息
    throw new Error(errMsg);  // 抛出错误，由上层 catch 处理
  }

  // 解析成功响应，提取 AI 返回的翻译文本
  // API 返回格式：{ choices: [{ message: { content: "..." } }] }
  const data = await res.json();
  return data.choices[0].message.content.trim();  // 去掉首尾多余空白
}

// ---------- 复制到剪贴板 ----------
// 用户点击"复制"按钮时，将翻译结果写入系统剪贴板。
// 使用 navigator.clipboard.writeText() API，这是现代浏览器的标准剪贴板接口。
// 复制成功后按钮文字临时变为"✓ 已复制"，1.5 秒后恢复。
copyBtn.addEventListener('click', async () => {
  const text = resultText.textContent;
  // 保护性判断：没有有效结果时不执行复制
  if (!text || text === '翻译中...' || resultText.classList.contains('result-placeholder')) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);  // 写入剪贴板
    // 临时改变按钮文字作为视觉反馈
    const originalHTML = copyBtn.innerHTML;
    copyBtn.innerHTML = '✓ 已复制';
    setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 1500);  // 1.5 秒后恢复
  } catch {
    // 某些浏览器或受限环境下剪贴板写入可能失败，静默处理即可
  }
});

// ---------- 辅助函数 ----------

// 控制翻译按钮的加载状态
// loading = true  → 按钮禁用、显示"翻译中..."、body 半透明遮罩
// loading = false → 按钮恢复、显示"翻译"、移除遮罩
function setLoading(loading) {
  translateBtn.disabled = loading;
  translateBtn.textContent = loading ? '翻译中...' : '翻译';
  document.body.classList.toggle('loading', loading);  // 控制半透明遮罩 CSS class
}

// 显示错误消息
// 传入空字符串时清空错误（同时移除 error class）
function setError(msg) {
  errorMsg.textContent = msg;
  errorMsg.className = `status-msg ${msg ? 'error' : ''}`;
}

// ---------- 快捷键 ----------
// 在原文输入框中按下 Ctrl+Enter（Windows）或 Command+Enter（Mac）时触发翻译
sourceText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();  // 阻止默认的换行行为
    translateBtn.click();  // 等效于点击翻译按钮
  }
});
