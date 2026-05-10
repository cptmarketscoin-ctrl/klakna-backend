/**
 * KLAKNA 客服系统 - 前端界面组件
 * 替代第三方客服组件，使用自己的后端API
 * UI设计与原有第三方组件完全一致
 */

(function() {
  'use strict';

  // ========== 配置 ==========
  const CONFIG = {
    apiBase: '',  // 空字符串表示同源，如果API在不同域需要设置
    pollInterval: 5000,  // 轮询间隔（毫秒）
    maxRetries: 3,  // 最大重试次数
  };

  // ========== 全局变量 ==========
  let csConfig = null;  // 客服配置
  let isOpen = false;  // 聊天窗口是否打开
  let pollTimer = null;  // 轮询定时器
  let isDragging = false;  // 是否正在拖拽
  let dragoffsetX = 0;  // 拖拽偏移X
  let drag0ffsetY = 0;  // 拖拽偏移Y
  let lastPollTime = null;  // 上次轮询时间

  // ========== 初始化 ==========
  function init() {
    console.log('[KLAKNA CS] 初始化客服系统...');

    // 获取客服配置
    fetchConfig().then(() => {
      createButton();
      createChatWindow();
      startPolling();
    }).catch(err => {
      console.error('[KLAKNA CS] 初始化失败:', err);
    });
  }

  // ========== 获取客服配置 ==========
  async function fetchConfig() {
    try {
      const res = await fetch('/api/cs/config');
      const data = await res.json();
      if (data.code === 200) {
        csConfig = data.data;
        console.log('[KLAKNA CS] 配置加载成功:', csConfig);
      }
    } catch (e) {
      console.error('[KLAKNA CS] 获取配置失败:', e);
      // 使用默认配置
      csConfig = {
        name: 'Customer Service',
        welcome_message: 'Hello, how can I help you?',
        enabled: 1
      };
    }
  }

  // ========== 创建客服按钮 ==========
  function createButton() {
    // 检查是否已存在
    if (document.getElementById('klakna-cs-button')) {
      return;
    }

    const button = document.createElement('button');
    button.id = 'klakna-cs-button';
    button.type = 'button';
    button.setAttribute('aria-label', '客服');
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 6h10a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2zm0 4h7a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2z"></path>
      </svg>
      <div class="klakna-cs-tooltip">客服</div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      #klakna-cs-button {
        position: fixed;
        right: 20px;
        bottom: 20px;
        width: 60px;
        height: 60px;
        border: none;
        border-radius: 34px 8px 34px 34px;
        background: linear-gradient(135deg, #1f8cff, #1466ff);
        color: #fff;
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 22px rgba(20, 102, 255, 0.28);
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      #klakna-cs-button:active {
        transform: scale(0.96);
      }

      #klakna-cs-button svg {
        width: 30px;
        height: 30px;
        pointer-events: none;
        fill: currentColor;
      }

      .klakna-cs-tooltip {
        position: absolute;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
        z-index: 10002;
        pointer-events: none;
        right: 100%;
        top: 50%;
        transform: translateY(-50%);
        margin-right: 10px;
      }

      .klakna-cs-tooltip::before {
        content: "";
        position: absolute;
        width: 0;
        height: 0;
        border: 6px solid transparent;
        left: 100%;
        top: 50%;
        transform: translateY(-50%);
        border-left-color: rgba(0, 0, 0, 0.8);
      }

      #klakna-cs-button:hover .klakna-cs-tooltip {
        opacity: 1;
        visibility: visible;
      }

      #klakna-cs-unread-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #ff4444;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(button);

    // 添加拖拽功能
    makeDraggable(button);

    // 点击事件
    button.addEventListener('click', function(e) {
      if (!isDragging || !button.dataset.dragged) {
        toggleChat();
      }
      button.dataset.dragged = 'false';
    });

    console.log('[KLAKNA CS] 按钮创建成功');
  }

  // ========== 创建聊天窗口 ==========
  function createChatWindow() {
    // 检查是否已存在
    if (document.getElementById('klakna-cs-chat')) {
      return;
    }

    const chat = document.createElement('div');
    chat.id = 'klakna-cs-chat';
    chat.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 90px;
      width: 380px;
      height: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      display: none;
      flex-direction: column;
      overflow: hidden;
      animation: klaknaSlideUp 0.3s ease;
    `;

    chat.innerHTML = `
      <style>
        @keyframes klaknaSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .klakna-cs-header {
          background: linear-gradient(135deg, #1f8cff, #1466ff);
          color: white;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .klakna-cs-header-title {
          font-size: 16px;
          font-weight: bold;
        }

        .klakna-cs-close {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .klakna-cs-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          background: #f5f5f5;
        }

        .klakna-cs-msg {
          margin-bottom: 12px;
          display: flex;
          flex-direction: column;
        }

        .klakna-cs-msg.user {
          align-items: flex-end;
        }

        .klakna-cs-msg.cs {
          align-items: flex-start;
        }

        .klakna-cs-msg-bubble {
          max-width: 70%;
          padding: 10px 14px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.4;
        }

        .klakna-cs-msg.user .klakna-cs-msg-bubble {
          background: linear-gradient(135deg, #1f8cff, #1466ff);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .klakna-cs-msg.cs .klakna-cs-msg-bubble {
          background: white;
          color: #333;
          border-bottom-left-radius: 4px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }

        .klakna-cs-msg-time {
          font-size: 11px;
          color: #999;
          margin-top: 4px;
        }

        .klakna-cs-input-area {
          padding: 12px;
          background: white;
          border-top: 1px solid #eee;
          display: flex;
          gap: 8px;
        }

        .klakna-cs-input {
          flex: 1;
          border: 1px solid #ddd;
          border-radius: 20px;
          padding: 8px 16px;
          font-size: 14px;
          outline: none;
        }

        .klakna-cs-input:focus {
          border-color: #1f8cff;
        }

        .klakna-cs-send {
          background: linear-gradient(135deg, #1f8cff, #1466ff);
          color: white;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .klakna-cs-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .klakna-cs-welcome {
          text-align: center;
          color: #666;
          padding: 20px;
          font-size: 14px;
        }
      </style>

      <div class="klakna-cs-header">
        <div class="klakna-cs-header-title">${csConfig?.name || 'Customer Service'}</div>
        <button class="klakna-cs-close" onclick="window.KlaknaCS.toggle()">×</button>
      </div>

      <div class="klakna-cs-messages" id="klakna-cs-messages">
        <div class="klakna-cs-welcome">
          ${csConfig?.welcome_message || 'Hello, how can I help you?'}
        </div>
      </div>

      <div class="klakna-cs-input-area">
        <input type="text" class="klakna-cs-input" id="klakna-cs-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter')window.KlaknaCS.sendMessage()">
        <button class="klakna-cs-send" onclick="window.KlaknaCS.sendMessage()">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="white" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
        </button>
      </div>
    `;

    document.body.appendChild(chat);
    console.log('[KLAKNA CS] 聊天窗口创建成功');
  }

  // ========== 切换聊天窗口 ==========
  function toggleChat() {
    const chat = document.getElementById('klakna-cs-chat');
    if (!chat) return;

    isOpen = !isOpen;
    chat.style.display = isOpen ? 'flex' : 'none';

    if (isOpen) {
      loadMessages();
    }

    console.log('[KLAKNA CS] 聊天窗口', isOpen ? '打开' : '关闭');
  }

  // ========== 发送消息 ==========
  window.KlaknaCS = window.KlaknaCS || {};
  window.KlaknaCS.toggle = toggleChat;

  window.KlaknaCS.sendMessage = async function() {
    const input = document.getElementById('klakna-cs-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    // 显示用户消息
    appendMessage('user', message);
    input.value = '';

    // 发送到服务器
    try {
      const res = await fetch('/api/cs/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
        },
        body: JSON.stringify({ message: message })
      });

      const data = await res.json();
      if (data.code !== 200) {
        console.error('[KLAKNA CS] 发送失败:', data.msg);
        appendMessage('system', '发送失败: ' + data.msg);
      }
    } catch (e) {
      console.error('[KLAKNA CS] 发送失败:', e);
      appendMessage('system', '发送失败，请检查网络');
    }
  };

  // ========== 加载消息历史 ==========
  async function loadMessages() {
    try {
      const res = await fetch('/api/cs/messages', {
        headers: {
          'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
        }
      });

      const data = await res.json();
      if (data.code === 200) {
        const messagesDiv = document.getElementById('klakna-cs-messages');
        if (!messagesDiv) return;

        // 清空现有消息（保留欢迎语）
        messagesDiv.innerHTML = `
          <div class="klakna-cs-welcome">
            ${csConfig?.welcome_message || 'Hello, how can I help you?'}
          </div>
        `;

        // 显示消息
        data.data.list.forEach(msg => {
          appendMessage('user', msg.message, msg.created_at);
          if (msg.reply) {
            appendMessage('cs', msg.reply, msg.replied_at);
          }
        });

        // 滚动到底部
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }
    } catch (e) {
      console.error('[KLAKNA CS] 加载消息失败:', e);
    }
  }

  // ========== 追加消息到界面 ==========
  function appendMessage(type, text, time) {
    const messagesDiv = document.getElementById('klakna-cs-messages');
    if (!messagesDiv) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'klakna-cs-msg ' + type;

    const timeStr = time ? new Date(time).toLocaleTimeString() : new Date().toLocaleTimeString();

    msgDiv.innerHTML = `
      <div class="klakna-cs-msg-bubble">${escapeHtml(text)}</div>
      <div class="klakna-cs-msg-time">${timeStr}</div>
    `;

    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // ========== HTML转义 ==========
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========== 开始轮询 ==========
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);

    pollTimer = setInterval(async () => {
      if (!isOpen) return;  // 只有窗口打开时才轮询

      try {
        const res = await fetch('/api/cs/messages', {
          headers: {
            'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
          }
        });

        const data = await res.json();
        if (data.code === 200 && data.data.list) {
          // 检查是否有新回复
          const hasNewReply = data.data.list.some(msg =>
            msg.reply && msg.status === 'replied'
          );

          if (hasNewReply) {
            loadMessages();  // 重新加载所有消息
          }
        }
      } catch (e) {
        console.error('[KLAKNA CS] 轮询失败:', e);
      }
    }, CONFIG.pollInterval);

    console.log('[KLAKNA CS] 开始轮询，间隔:', CONFIG.pollInterval, 'ms');
  }

  // ========== 拖拽功能 ==========
  function makeDraggable(el) {
    let startX, startY, initialRight, initialBottom;

    el.addEventListener('mousedown', startDrag);
    el.addEventListener('touchstart', startDrag, { passive: false });

    function startDrag(e) {
      if (e.target.closest('.klakna-cs-tooltip')) return;

      isDragging = true;
      el.dataset.dragged = 'false';

      if (e.type === 'touchstart') {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      } else {
        startX = e.clientX;
        startY = e.clientY;
      }

      // 记录初始位置
      const rect = el.getBoundingClientRect();
      initialRight = window.innerWidth - rect.right;
      initialBottom = window.innerHeight - rect.bottom;

      document.addEventListener('mousemove', onDrag);
      document.addEventListener('touchmove', onDrag, { passive: false });
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchend', stopDrag);

      e.preventDefault();
    }

    function onDrag(e) {
      if (!isDragging) return;

      let clientX, clientY;
      if (e.type === 'touchmove') {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const deltaX = clientX - startX;
      const deltaY = clientY - startY;

      // 计算新位置
      let newRight = initialRight - deltaX;
      let newBottom = initialBottom - deltaY;

      // 边界检查
      const maxRight = window.innerWidth - el.offsetWidth;
      const maxBottom = window.innerHeight - el.offsetHeight;
      newRight = Math.max(0, Math.min(newRight, maxRight));
      newBottom = Math.max(0, Math.min(newBottom, maxBottom));

      el.style.right = newRight + 'px';
      el.style.bottom = newBottom + 'px';
      el.style.left = 'auto';
      el.style.top = 'auto';

      el.dataset.dragged = 'true';

      e.preventDefault();
    }

    function stopDrag() {
      isDragging = false;
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('touchmove', onDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('touchend', stopDrag);
    }
  }

  // ========== 公开API ==========
  window.KlaknaCS = window.KlaknaCS || {};
  window.KlaknaCS.toggle = toggleChat;
  window.KlaknaCS.open = function() {
    if (!isOpen) toggleChat();
  };
  window.KlaknaCS.close = function() {
    if (isOpen) toggleChat();
  };

  // ========== 启动 ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[KLAKNA CS] 客服系统加载完成');

})();
