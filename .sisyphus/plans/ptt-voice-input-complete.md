# PTT 语音输入完善

## TL;DR
> **Quick Summary**: 给 noshRadio 的 PTT（Push-to-Talk）语音输入补全 UI：加麦克风按钮、语音状态指示器、CSS 动画。已有 Web Speech API 和 `` ` `` 键逻辑已实现，只缺界面层。
> 
> **Deliverables**:
> - 麦克风按钮（`wired-fab`，在输入框和发送按钮之间）
> - 语音状态指示条（`pttIndicator`，在输入框上方）
> - CSS 样式：指示器动画、按钮 hover/active、录音脉冲
> - JS 事件：麦克风按钮 mousedown→startPTT() / mouseup→stopPTT()
> 
> **Estimated Effort**: Quick（50 行代码）
> **Parallel Execution**: NO - 单任务
> **Critical Path**: HTML → CSS → JS

---

## Context

### Original Request
"考虑能否做语音输入？我想做AI电台，可以语音输入"

### Interview Summary
用户选择了「完善已有 PTT」方案。页面已有完整的 Web Speech API 语音识别逻辑（`initPTT`/`startPTT`/`stopPTT`），通过 `` ` `` 键触发。但缺少：
1. `pttIndicator` DOM 元素
2. 麦克风按钮
3. CSS 样式

### Research Findings
- Web Speech API (`webkitSpeechRecognition`) 已对接，支持中文实时识别
- 识别结果自动填入 `chatInput`，`stopPTT()` 后自动调用 `sendMessage()`
- 设计风格：暗色主题，`wired-elements` 手绘风组件，`--accent: #ff3366` 粉色强调色

---

## Work Objectives

### Core Objective
补全 PTT 语音输入的界面层，让用户能通过点击麦克风按钮或按 `` ` `` 键语音输入。

### Concrete Deliverables
- 麦克风按钮（`#pttMicBtn`），显示在输入框右侧
- 语音状态指示器（`#pttIndicator`），显示在输入框上方
- 录音状态 CSS 动画（脉冲红点 + 文字提示）
- 鼠标事件绑定（mousedown/mouseup）

### Definition of Done
- [ ] 打开页面能看到麦克风按钮
- [ ] 点击并按住麦克风按钮说话，松开后文字出现在输入框并自动发送
- [ ] 按住 `` ` `` 键说话，松开后同样效果
- [ ] 录音时有红色脉冲指示器 + 「正在听...」文字
- [ ] 空闲时指示器显示「按住 · 键或麦克风按钮说话」

### Must Have
- 麦克风按钮视觉风格与现有 `wired-fab` 一致
- 按钮使用 SVG 麦克风图标（非 emoji）
- 指示器在录音时 pulsing 动画

### Must NOT Have
- 不修改现有 PTT JS 逻辑（`startPTT`/`stopPTT`/`initPTT`）
- 不改变 `` ` `` 键行为
- 不引入新依赖

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO（无测试框架）
- **Automated tests**: NO
- **Agent-Executed QA**: Playwright 打开页面，验证 UI 元素存在、交互生效

### QA Policy
手动浏览页面 + Playwright 验证 UI 元素

---

## Execution Strategy

单一任务，无需分波。

---

## TODOs

- [ ] 1. 添加 HTML 元素（pttIndicator + 麦克风按钮）

  **What to do**:
  - 在 `.sprite-input-row` 上方插入 `ptt-status` 指示器
  - 在 `chatInput` 和 `chatSend` 之间插入麦克风 `wired-fab`
  
  **HTML 代码**:
  ```html
  <!-- pttIndicator -->
  <div class="ptt-status" id="pttIndicator">
    <span class="ptt-dot"></span>
    <span class="ptt-text">按住 · 键或麦克风按钮说话</span>
  </div>
  
  <!-- 麦克风按钮（在 sprite-input-row 内 chatInput 之后、chatSend 之前） -->
  <wired-fab class="sprite-mic" id="pttMicBtn" aria-label="voice input">
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" fill="currentColor"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V22h2v-1.06A9 9 0 0 0 21 12v-2z" fill="currentColor"/>
    </svg>
  </wired-fab>
  ```

  **Must NOT do**:
  - 不要移动或删除现有的 `chatInput` 和 `chatSend`

  **Acceptance Criteria**:
  - [ ] 页面中出现 id="pttIndicator" 的元素
  - [ ] 页面中出现 id="pttMicBtn" 的 wired-fab

- [ ] 2. 添加 CSS 样式

  **What to do**:
  在文件 CSS 区域（`.sprite-input-row` 样式附近）添加以下样式：

  ```css
  /* PTT 状态指示器 */
  .ptt-status {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px clamp(10px, 1.4 * var(--scale), 18px);
    font-size: clamp(10px, 1.1 * var(--scale), 13px);
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    min-height: 24px;
    transition: color 0.2s;
  }
  .ptt-status.active {
    color: var(--accent);
  }
  .ptt-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted);
    transition: background 0.2s;
  }
  .ptt-status.active .ptt-dot {
    background: var(--accent);
    animation: ptt-pulse 0.8s ease-in-out infinite;
  }
  @keyframes ptt-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.7); }
  }
  
  /* 麦克风按钮 */
  .sprite-mic {
    width: var(--send-btn-size);
    height: var(--send-btn-size);
    --wired-fab-size: var(--send-btn-size);
  }
  .sprite-mic wired-fab {
    width: var(--send-btn-size);
    height: var(--send-btn-size);
    padding: 0;
    color: var(--muted);
    background: transparent;
    border-radius: 4px;
    --wired-fab-bg-color: transparent;
    transition: color 0.15s, transform 0.1s;
  }
  .sprite-mic wired-fab:hover {
    color: var(--fg);
    transform: translate(-1px, -1px);
  }
  .sprite-mic wired-fab:active {
    transform: translate(1px, 1px);
  }
  .sprite-mic.active wired-fab {
    color: var(--accent);
  }
  .sprite-mic.active wired-fab svg {
    animation: ptt-pulse 0.6s ease-in-out infinite;
  }
  ```

  **Must NOT do**:
  - 不要修改现有样式的选择器或变量

  **Acceptance Criteria**:
  - [ ] 指示器在空闲时灰色文字 + 灰色圆点
  - [ ] 录音时指示器红色文字 + 红色脉冲圆点
  - [ ] 麦克风按钮默认灰色，hover 变白，active 下沉
  - [ ] 录音时麦克风按钮红色 + 脉冲动画

- [ ] 3. 添加 JS 事件绑定

  **What to do**:
  在 `initPTT()` 函数之后（约 line 6132），添加麦克风按钮的事件绑定：

  ```javascript
  // ===== 麦克风按钮 PTT =====
  const micBtn = document.getElementById('pttMicBtn');
  if (micBtn) {
    micBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      chatInput.value = '';
      chatInput.focus();
      startPTT();
    });
    micBtn.addEventListener('mouseup', () => {
      stopPTT();
    });
    micBtn.addEventListener('mouseleave', () => {
      // 防止按住后滑出按钮不触发 mouseup
      if (pttIsListening) stopPTT();
    });
  }
  ```

  **Must NOT do**:
  - 不要修改现有的 `startPTT()` / `stopPTT()` / `initPTT()` 函数
  - 不要修改 backquote 键的 keydown/keyup 事件

  **Acceptance Criteria**:
  - [ ] 按住麦克风按钮 → `startPTT()` 被调用
  - [ ] 松开麦克风按钮 → `stopPTT()` 被调用
  - [ ] 按住后滑出按钮 → 自动 `stopPTT()`
  - [ ] 按下按钮时焦点移到输入框

- [ ] 4. 最终检查

  **What to do**:
  - 确认 `pttIndicator` 不会为 null（已存在 DOM 元素）
  - 确认 `pttMicBtn` 不会为 null
  - 验证 backquote 键仍然正常工作（line 6110-6129 未修改）
  - 浏览器打开页面，点击麦克风按钮测试语音输入

  **Acceptance Criteria**:
  - [ ] 页面无 JS 报错
  - [ ] 点击麦克风按钮 → 指示器变红「正在听...」→ 说话 → 松开 → 文字发送
  - [ ] 按 `` ` `` 键 → 同样效果

---

## Commit Strategy

- **1+2+3+4**: `feat(ui): 完善 PTT 语音输入 - 添加麦克风按钮和状态指示器`

---

## Success Criteria

### Verification Commands
```bash
# 无测试命令，手动在浏览器中验证
# 1. 打开页面
# 2. 找到麦克风按钮（输入框右侧）
# 3. 按住说话，松开发送
# 4. 按 ` 键测试键盘快捷键
```

### Final Checklist
- [ ] 麦克风按钮可见且可点击
- [ ] PTT 状态指示器显示正确状态
- [ ] 录音时脉冲动画正常
- [ ] 松开后语音文字发送给 AI
