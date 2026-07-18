"use strict";

const {
  Dialog,
  Plugin,
  Setting,
  fetchSyncPost,
  showMessage,
  getFrontend,
} = require("siyuan");

const DATA_KEY = "time-list-data.json";
const SETTINGS_KEY = "time-list-settings.json";
const DOCK_TYPE = "time-list";
const PIE_COLORS = ["#5b8def", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];
const ICONS = `
  <symbol id="iconTimeList" viewBox="0 0 32 32">
    <path d="M16 3a13 13 0 1 0 0 26 13 13 0 0 0 0-26Zm0 23.5A10.5 10.5 0 1 1 16 5.5a10.5 10.5 0 0 1 0 21Z"/>
    <path d="M17.25 9.5h-2.5v7.4l5.65 3.4 1.3-2.1-4.45-2.65V9.5Z"/>
    <path d="M8.2 15.2h3.2v2.2H8.2v-2.2Zm12.4-5.3h3.2v2.2h-3.2V9.9Zm0 10h3.2v2.2h-3.2v-2.2Z"/>
  </symbol>
`;

const defaultSettings = {
  notebookId: "",
  autoAppendToDailyNote: true,
};

const defaultState = {
  version: 1,
  tasks: [],
  activePomodoro: null,
};

class TimeListPlugin extends Plugin {
  constructor(options) {
    super(options);
    this.settings = { ...defaultSettings };
    this.state = clone(defaultState);
    this.dockElement = null;
    this.settingDialog = null;
    this.createTaskDialog = null;
    this.completeTaskDialog = null;
    this.currentDockView = "tasks";
    this.timerHandle = null;
    this.isMobile = false;
  }

  async onload() {
    this.addIcons(ICONS);
    this.isMobile = ["mobile", "browser-mobile"].includes(getFrontend());
    this.addCommand({
      langKey: "openTimeList",
      hotkey: "",
      callback: () => this.openDock(),
    });
  }

  async onLayoutReady() {
    try {
      await this.loadAllData();
      this.registerDock();
      await this.setupSettings();
      this.startTicker();
      showMessage("日记任务计时插件已加载");
    } catch (error) {
      console.error("[siyuan-time-list] 插件初始化失败", error);
      showMessage(`日记任务计时初始化失败：${error.message}`, 7000, "error");
    }
  }

  onunload() {
    this.stopTicker();
    if (this.settingDialog) {
      this.settingDialog.destroy();
      this.settingDialog = null;
    }
    if (this.createTaskDialog) {
      this.createTaskDialog.destroy();
      this.createTaskDialog = null;
    }
    if (this.completeTaskDialog) {
      this.completeTaskDialog.destroy();
      this.completeTaskDialog = null;
    }
  }

  async uninstall() {
    await this.removeData(DATA_KEY);
    await this.removeData(SETTINGS_KEY);
  }

  async loadAllData() {
    let loadedSettings = null;
    try {
      loadedSettings = await this.loadData(SETTINGS_KEY);
    } catch (error) {
      console.warn("[siyuan-time-list] settings not found, use defaults", error);
    }
    this.settings = { ...defaultSettings, ...(loadedSettings || {}) };

    let loadedState = null;
    try {
      loadedState = await this.loadData(DATA_KEY);
    } catch (error) {
      console.warn("[siyuan-time-list] data not found, use empty state", error);
    }
    this.state = {
      ...clone(defaultState),
      ...(loadedState || {}),
      tasks: Array.isArray(loadedState?.tasks) ? loadedState.tasks : [],
    };
  }

  async saveState() {
    await this.saveData(DATA_KEY, this.state);
  }

  async saveSettings() {
    await this.saveData(SETTINGS_KEY, this.settings);
  }

  async setupSettings() {
    const notebooks = await this.listNotebooks();

    const notebookSelect = document.createElement("select");
    notebookSelect.className = "b3-select fn__flex-center fn__size200";
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "请选择日记笔记本";
    notebookSelect.appendChild(emptyOption);
    notebooks.forEach((notebook) => {
      const option = document.createElement("option");
      option.value = notebook.id;
      option.textContent = notebook.name;
      notebookSelect.appendChild(option);
    });
    notebookSelect.value = this.settings.notebookId;

    const appendToggle = document.createElement("input");
    appendToggle.type = "checkbox";
    appendToggle.checked = this.settings.autoAppendToDailyNote;

    this.setting = new Setting({
      confirmCallback: async () => {
        this.settings.notebookId = notebookSelect.value;
        this.settings.autoAppendToDailyNote = appendToggle.checked;
        await this.saveSettings();
        this.render();
        showMessage("日记任务计时设置已保存");
      },
    });

    this.setting.addItem({
      title: "日记笔记本",
      description: "新任务会追加到这个笔记本的今日日记里。",
      createActionElement: () => notebookSelect,
    });

    this.setting.addItem({
      title: "写入今日日记",
      description: "创建任务和完成任务时向日记追加一条记录。",
      createActionElement: () => appendToggle,
    });
  }

  async openSetting() {
    const notebooks = await this.listNotebooks();

    if (this.settingDialog) {
      this.settingDialog.destroy();
      this.settingDialog = null;
    }

    const notebookOptions = notebooks.length > 0
      ? `<option value="">请选择日记笔记本</option>` + notebooks
          .map((notebook) => {
            const selected = notebook.id === this.settings.notebookId ? " selected" : "";
            return `<option value="${escapeAttr(notebook.id)}"${selected}>${escapeHtml(notebook.name)}</option>`;
          })
          .join("")
      : `<option value="">未获取到可用笔记本</option>`;

    const content = `
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
        <div style="font-size: 14px; color: var(--b3-theme-on-surface); line-height: 1.6;">
          配置任务写入哪个笔记本的今日日记。番茄钟为正向计时，不需要预设时长。
        </div>

        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label style="font-size: 13px; font-weight: 500; color: var(--b3-theme-on-surface);">日记笔记本</label>
          <select id="time-list-notebook" class="b3-select" style="width: 100%;">
            ${notebookOptions}
          </select>
          <div style="font-size: 12px; color: var(--b3-theme-on-surface-light);">
            新任务和完成记录会追加到这个笔记本的今日日记。
          </div>
        </div>

        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--b3-theme-on-surface);">
          <input id="time-list-auto-append" type="checkbox" ${this.settings.autoAppendToDailyNote ? "checked" : ""} />
          创建和完成任务时写入今日日记
        </label>

        <div id="time-list-setting-status" style="font-size: 13px; color: var(--b3-theme-on-surface-light);"></div>

        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; border-top: 1px solid var(--b3-theme-surface-light); padding-top: 14px;">
          <button id="time-list-cancel-settings" class="b3-button b3-button--outline">取消</button>
          <button id="time-list-save-settings" class="b3-button b3-button--text" style="background: var(--b3-theme-primary); color: #fff;">保存</button>
        </div>
      </div>
    `;

    this.settingDialog = new Dialog({
      title: "日记任务计时设置",
      content,
      width: this.isMobile ? "92vw" : "440px",
      height: "auto",
      destroyCallback: () => {
        this.settingDialog = null;
      },
    });

    const root = this.settingDialog.element;
    const notebookSelect = root.querySelector("#time-list-notebook");
    const appendToggle = root.querySelector("#time-list-auto-append");
    const statusElement = root.querySelector("#time-list-setting-status");
    const cancelButton = root.querySelector("#time-list-cancel-settings");
    const saveButton = root.querySelector("#time-list-save-settings");

    const renderStatus = () => {
      const notebookName = notebooks.find((notebook) => notebook.id === notebookSelect.value)?.name || "未选择笔记本";
      statusElement.innerHTML = `📓 ${escapeHtml(notebookName)} &nbsp;|&nbsp; 🍅 正向计时`;
    };

    notebookSelect.addEventListener("change", renderStatus);
    cancelButton.addEventListener("click", () => this.settingDialog?.destroy());
    saveButton.addEventListener("click", async () => {
      this.settings = {
        ...this.settings,
        notebookId: notebookSelect.value,
        autoAppendToDailyNote: appendToggle.checked,
      };
      await this.saveSettings();
      this.render();
      showMessage("日记任务计时设置已保存 ✅");
      this.settingDialog?.destroy();
    });

    renderStatus();
  }

  registerDock() {
    const plugin = this;
    this.addDock({
      config: {
        position: "RightBottom",
        size: { width: 360, height: 520 },
        icon: "iconTimeList",
        title: "日记任务计时",
      },
      data: {},
      type: DOCK_TYPE,
      init() {
        this.element.style.height = "100%";
        plugin.dockElement = this.element;
        plugin.render();
      },
      destroy() {
        if (plugin.dockElement === this.element) {
          plugin.dockElement = null;
        }
        this.element.innerHTML = "";
      },
    });
  }

  openDock() {
    try {
      window.siyuan?.layout?.rightDock?.toggleModel(`${this.name}${DOCK_TYPE}`, true);
    } catch (error) {
      console.warn("[siyuan-time-list] failed to open dock", error);
    }
  }

  startTicker() {
    this.stopTicker();
    this.timerHandle = window.setInterval(async () => {
      if (this.state.activePomodoro) {
        this.render();
      }
    }, 1000);
  }

  stopTicker() {
    if (this.timerHandle) {
      window.clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  async request(path, payload = {}) {
    const response = await fetchSyncPost(path, payload);
    if (!response || response.code !== 0) {
      throw new Error(response?.msg || `请求失败：${path}`);
    }
    return response.data;
  }

  async listNotebooks() {
    try {
      const data = await this.request("/api/notebook/lsNotebooks");
      return (data?.notebooks || []).filter((notebook) => !notebook.closed);
    } catch (error) {
      console.warn("[siyuan-time-list] failed to list notebooks", error);
      return [];
    }
  }

  async ensureNotebookId() {
    if (this.settings.notebookId) {
      return this.settings.notebookId;
    }
    throw new Error("请先在设置里选择你的固定日记笔记本。");
  }

  async appendDailyNote(markdown) {
    if (!this.canWriteDailyNote()) {
      return;
    }
    const notebook = await this.ensureNotebookId();
    try {
      await this.request("/api/block/appendDailyNoteBlock", {
        notebook,
        dataType: "markdown",
        data: markdown,
      });
    } catch (error) {
      const dailyNote = await this.request("/api/filetree/createDailyNote", {
        notebook,
        app: this.app?.appId,
      });
      const parentID = dailyNote?.id || dailyNote;
      if (!parentID) {
        throw error;
      }
      await this.request("/api/block/appendBlock", {
        parentID,
        dataType: "markdown",
        data: markdown,
      });
    }
  }

  canWriteDailyNote() {
    return Boolean(this.settings.autoAppendToDailyNote && this.settings.notebookId);
  }

  async addTasks(rawText) {
    const titles = parseTaskTitles(rawText);
    if (titles.length === 0) {
      showMessage("先写任务名称，一行一个。", 3000, "error");
      return;
    }

    const now = new Date().toISOString();
    const tasks = titles.map((title) => ({
      id: createId(),
      title,
      date: todayKey(),
      status: "pending",
      createdAt: now,
      completedAt: "",
      actualMinutes: 0,
      completionMode: "",
      pomodoros: [],
      note: "",
    }));

    this.state.tasks.unshift(...tasks);
    await this.saveState();
    this.render();

    try {
      const markdown = tasks.map((task) => `* [ ] ${escapeMarkdown(task.title)} #日记任务计时#`).join("\n") + "\n";
      await this.appendDailyNote(markdown);
      showMessage(this.canWriteDailyNote() ? `已创建 ${tasks.length} 个任务，并写入今日日记` : `已创建 ${tasks.length} 个任务`);
    } catch (error) {
      showMessage(`任务已保存，但写入日记失败：${error.message}`, 5000, "error");
    }
  }

  openCreateTaskDialog() {
    if (this.createTaskDialog) {
      this.createTaskDialog.destroy();
      this.createTaskDialog = null;
    }

    const content = `
      <div class="time-list-dialog">
        <label class="time-list-field">
          <span>今日任务</span>
          <textarea id="time-list-create-titles" class="b3-text-field time-list-textarea" placeholder="一行一个任务，例如：&#10;整理插件 UI&#10;写完日记任务逻辑&#10;复盘今天的时间"></textarea>
        </label>

        <div class="time-list-dialog-hint">
          ${this.settings.notebookId ? "会同步追加到你选择的今日日记。" : "未选择日记笔记本，只保存到插件数据。"}
        </div>

        <div class="time-list-dialog-footer">
          <button id="time-list-create-cancel" class="b3-button b3-button--outline">取消</button>
          <button id="time-list-create-submit" class="b3-button b3-button--text">创建</button>
        </div>
      </div>
    `;

    this.createTaskDialog = new Dialog({
      title: "新建任务",
      content,
      width: this.isMobile ? "92vw" : "460px",
      height: "auto",
      destroyCallback: () => {
        this.createTaskDialog = null;
      },
    });

    const root = this.createTaskDialog.element;
    const titlesInput = root.querySelector("#time-list-create-titles");
    const cancelButton = root.querySelector("#time-list-create-cancel");
    const submitButton = root.querySelector("#time-list-create-submit");

    const submit = async () => {
      submitButton.disabled = true;
      const hasTitle = parseTaskTitles(titlesInput.value).length > 0;
      await this.addTasks(titlesInput.value);
      submitButton.disabled = false;
      if (hasTitle) {
        this.createTaskDialog?.destroy();
      }
    };

    cancelButton.addEventListener("click", () => this.createTaskDialog?.destroy());
    submitButton.addEventListener("click", submit);
    titlesInput.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        submit();
      }
    });

    setTimeout(() => titlesInput.focus(), 0);
  }

  async completeTask(taskId, mode, payload) {
    const task = this.findTask(taskId);
    if (!task) {
      return;
    }

    const minutes = this.resolveCompletionMinutes(task, mode, payload);
    if (minutes <= 0) {
      showMessage("完成时长需要大于 0 分钟。", 3000, "error");
      return;
    }

    if (this.state.activePomodoro?.taskId === task.id) {
      await this.stopPomodoro(false);
    }

    task.status = "completed";
    task.actualMinutes = minutes;
    task.completionMode = mode;
    task.completedAt = new Date().toISOString();
    task.abandonedAt = "";
    task.note = this.buildCompletionNote(mode, payload, minutes);

    await this.saveState();
    this.render();

    try {
      await this.appendDailyNote(`* [x] ${escapeMarkdown(task.title)} ✅ 用时 ${formatMinutes(minutes)}${task.note ? `，${escapeMarkdown(task.note)}` : ""}\n`);
      showMessage("任务完成，时间也被好好收进篮子里了。");
    } catch (error) {
      showMessage(`任务已完成，但写入日记失败：${error.message}`, 5000, "error");
    }
  }

  openCompleteTaskDialog(taskId) {
    const task = this.findTask(taskId);
    if (!task) {
      return;
    }

    if (this.completeTaskDialog) {
      this.completeTaskDialog.destroy();
      this.completeTaskDialog = null;
    }

    const pomodoroMinutes = totalPomodoroMinutes(task);
    const content = `
      <div class="time-list-dialog time-list-complete-dialog" data-selected-mode="range">
        <div class="time-list-dialog-title">${escapeHtml(task.title)}</div>
        <div class="time-list-dialog-hint">
          番茄累计 ${formatMinutes(pomodoroMinutes)} · ${(task.pomodoros || []).length} 次专注
        </div>

        <div class="time-list-choice-grid">
          <button class="time-list-choice-card is-active" data-action="dialog-mode" data-mode="range">
            <strong>时间段</strong>
            <span>填写开始和结束</span>
          </button>
          <button class="time-list-choice-card" data-action="dialog-mode" data-mode="manual">
            <strong>直接填</strong>
            <span>输入总分钟数</span>
          </button>
          <button class="time-list-choice-card" data-action="dialog-mode" data-mode="pomodoro">
            <strong>番茄总和</strong>
            <span>使用累计专注</span>
          </button>
        </div>

        <div class="time-list-dialog-mode" data-role="dialog-mode-body" data-mode="range">
          <label class="time-list-field">
            <span>开始时间</span>
            <input id="time-list-complete-start" class="b3-text-field" type="time" />
          </label>
          <label class="time-list-field">
            <span>结束时间</span>
            <input id="time-list-complete-end" class="b3-text-field" type="time" value="${currentTimeValue()}" />
          </label>
        </div>

        <div class="time-list-dialog-mode time-list-hidden" data-role="dialog-mode-body" data-mode="manual">
          <label class="time-list-field">
            <span>实际用时（分钟）</span>
            <input id="time-list-complete-minutes" class="b3-text-field" type="number" min="1" placeholder="例如：35" />
          </label>
        </div>

        <div class="time-list-dialog-mode time-list-hidden" data-role="dialog-mode-body" data-mode="pomodoro">
          <div class="time-list-pomodoro-total">
            <span>将使用番茄累计</span>
            <strong>${formatMinutes(pomodoroMinutes)}</strong>
          </div>
          <div class="time-list-dialog-hint">${pomodoroMinutes ? "将把番茄总和作为任务用时。" : "这个任务还没有番茄记录。"}</div>
        </div>

        <div id="time-list-complete-preview" class="time-list-dialog-hint">将记录：请填写有效时长</div>

        <div class="time-list-dialog-footer">
          <button id="time-list-complete-cancel" class="b3-button b3-button--outline">取消</button>
          <button id="time-list-complete-submit" class="b3-button b3-button--text">确认完成</button>
        </div>
      </div>
    `;

    this.completeTaskDialog = new Dialog({
      title: "完成任务",
      content,
      width: this.isMobile ? "92vw" : "560px",
      height: "auto",
      destroyCallback: () => {
        this.completeTaskDialog = null;
      },
    });

    const root = this.completeTaskDialog.element;
    const container = root.querySelector(".time-list-complete-dialog");
    const preview = root.querySelector("#time-list-complete-preview");
    const submitButton = root.querySelector("#time-list-complete-submit");
    const cancelButton = root.querySelector("#time-list-complete-cancel");
    const startInput = root.querySelector("#time-list-complete-start");
    const endInput = root.querySelector("#time-list-complete-end");
    const minutesInput = root.querySelector("#time-list-complete-minutes");

    const getMode = () => container.dataset.selectedMode || "range";
    const getPayload = () => ({
      startTime: startInput?.value || "",
      endTime: endInput?.value || "",
      minutes: minutesInput?.value || "",
    });
    const updatePreview = () => {
      const mode = getMode();
      const minutes = this.resolveCompletionMinutes(task, mode, getPayload());
      preview.textContent = minutes > 0 ? `将记录：${formatMinutes(minutes)}` : "将记录：请填写有效时长";
      submitButton.disabled = minutes <= 0;
    };
    const setMode = (mode) => {
      container.dataset.selectedMode = mode;
      root.querySelectorAll("[data-action='dialog-mode']").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.mode === mode);
      });
      root.querySelectorAll("[data-role='dialog-mode-body']").forEach((body) => {
        body.classList.toggle("time-list-hidden", body.dataset.mode !== mode);
      });
      updatePreview();
    };

    root.querySelectorAll("[data-action='dialog-mode']").forEach((button) => {
      button.addEventListener("click", () => setMode(button.dataset.mode));
    });
    [startInput, endInput, minutesInput].forEach((input) => {
      input?.addEventListener("input", updatePreview);
      input?.addEventListener("change", updatePreview);
    });
    cancelButton.addEventListener("click", () => this.completeTaskDialog?.destroy());
    submitButton.addEventListener("click", async () => {
      const mode = getMode();
      submitButton.disabled = true;
      await this.completeTask(taskId, mode, getPayload());
      this.completeTaskDialog?.destroy();
    });

    updatePreview();
    setTimeout(() => startInput?.focus(), 0);
  }

  resolveCompletionMinutes(task, mode, payload) {
    if (mode === "range") {
      return diffTimeInputs(payload.startTime, payload.endTime);
    }
    if (mode === "manual") {
      return clampNumber(payload.minutes, 0, 24 * 60, 0);
    }
    if (mode === "pomodoro") {
      return totalPomodoroMinutes(task);
    }
    return 0;
  }

  buildCompletionNote(mode, payload, minutes) {
    if (mode === "range") {
      return `${payload.startTime}–${payload.endTime}`;
    }
    if (mode === "manual") {
      return "手动填写";
    }
    if (mode === "pomodoro") {
      return `番茄累计 ${formatMinutes(minutes)}`;
    }
    return "";
  }

  async reopenTask(taskId) {
    const task = this.findTask(taskId);
    if (!task) {
      return;
    }
    task.status = "pending";
    task.completedAt = "";
    task.abandonedAt = "";
    task.actualMinutes = 0;
    task.completionMode = "";
    task.note = "";
    await this.saveState();
    this.render();
  }

  async abandonTask(taskId) {
    const task = this.findTask(taskId);
    if (!task) {
      return;
    }
    if (this.state.activePomodoro?.taskId === taskId) {
      await this.stopPomodoro(false);
    }
    task.status = "abandoned";
    task.completedAt = "";
    task.abandonedAt = new Date().toISOString();
    task.actualMinutes = 0;
    task.completionMode = "abandoned";
    task.note = "已放弃";
    await this.saveState();
    this.render();

    try {
      await this.appendDailyNote(`* ${escapeMarkdown(task.title)} 🚫 已放弃\n`);
      showMessage("已放弃任务");
    } catch (error) {
      showMessage(`任务已放弃，但写入日记失败：${error.message}`, 5000, "error");
    }
  }

  async deleteTask(taskId) {
    if (this.state.activePomodoro?.taskId === taskId) {
      await this.stopPomodoro(false);
    }
    this.state.tasks = this.state.tasks.filter((task) => task.id !== taskId);
    await this.saveState();
    this.render();
  }

  async startPomodoro(taskId) {
    const task = this.findTask(taskId);
    if (!task || normalizeTaskStatus(task) !== "pending") {
      return;
    }
    if (this.state.activePomodoro) {
      showMessage("已经有一个番茄在锅里咕嘟咕嘟了。", 3000, "error");
      return;
    }
    this.state.activePomodoro = {
      id: createId(),
      taskId,
      startedAt: Date.now(),
      pausedAt: null,
      pausedMs: 0,
      isPaused: false,
    };
    await this.saveState();
    this.render();
  }

  async pausePomodoro() {
    const active = this.state.activePomodoro;
    if (!active || active.isPaused) {
      return;
    }
    active.isPaused = true;
    active.pausedAt = Date.now();
    await this.saveState();
    this.render();
  }

  async resumePomodoro() {
    const active = this.state.activePomodoro;
    if (!active || !active.isPaused) {
      return;
    }
    active.pausedMs += Date.now() - active.pausedAt;
    active.isPaused = false;
    active.pausedAt = null;
    await this.saveState();
    this.render();
  }

  async finishPomodoro() {
    await this.stopPomodoro(true);
  }

  async cancelPomodoro() {
    await this.stopPomodoro(false);
  }

  async stopPomodoro(shouldSave) {
    const active = this.state.activePomodoro;
    if (!active) {
      return;
    }
    const task = this.findTask(active.taskId);
    if (shouldSave && task) {
      const elapsedMs = getActiveElapsedMs(active);
      const minutes = Math.max(1, Math.round(elapsedMs / 60000));
      task.pomodoros.push({
        id: active.id,
        startedAt: new Date(active.startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        minutes,
      });
      showMessage(`已记录一个番茄：${formatMinutes(minutes)}`);
    }
    this.state.activePomodoro = null;
    await this.saveState();
    this.render();
  }

  findTask(taskId) {
    return this.state.tasks.find((task) => task.id === taskId);
  }

  getTodayTasks() {
    const date = todayKey();
    return this.state.tasks.filter((task) => task.date === date);
  }

  render() {
    if (!this.dockElement) {
      return;
    }

    const todayTasks = this.getTodayTasks();
    const pendingTasks = todayTasks.filter((task) => task.status === "pending" || !task.status);
    const completedTasks = todayTasks.filter((task) => task.status === "completed");
    const abandonedTasks = todayTasks.filter((task) => task.status === "abandoned");
    this.dockElement.innerHTML = `
      <div class="time-list-dock">
        ${this.renderHeader()}
        ${this.renderViewTabs()}
        ${this.renderPomodoroPanel(pendingTasks)}
        ${
          this.currentDockView === "summary"
            ? this.renderSummaryView(todayTasks, completedTasks, abandonedTasks)
            : this.renderTasksView(todayTasks, pendingTasks, completedTasks, abandonedTasks)
        }
      </div>
    `;
    this.bindEvents();
  }

  renderHeader() {
    const notebookStatus = this.settings.notebookId ? "已连接日记笔记本" : "请在设置中选择日记笔记本";
    return `
      <div class="time-list-header">
        <div class="time-list-title">
          <strong>今天的任务</strong>
          <span class="time-list-date">${todayKey()} · ${notebookStatus}</span>
        </div>
        <div class="time-list-row">
          <button class="time-list-button time-list-button--muted" data-action="open-setting">设置</button>
          <button class="time-list-button time-list-button--muted" data-action="refresh">刷新</button>
        </div>
      </div>
    `;
  }

  renderViewTabs() {
    return `
      <div class="time-list-tabs">
        <button class="${this.currentDockView === "tasks" ? "is-active" : ""}" data-action="switch-view" data-view="tasks">任务列表</button>
        <button class="${this.currentDockView === "summary" ? "is-active" : ""}" data-action="switch-view" data-view="summary">今日总结</button>
      </div>
    `;
  }

  renderTasksView(todayTasks, pendingTasks, completedTasks, abandonedTasks) {
    return `
      ${this.renderCreateAction()}
      <div class="time-list-scroll">
        ${this.renderTaskList("今日任务", todayTasks)}
      </div>
    `;
  }

  renderSummaryView(todayTasks, completedTasks, abandonedTasks) {
    return `
      <div class="time-list-scroll">
        ${this.renderChart(todayTasks, completedTasks, abandonedTasks)}
      </div>
    `;
  }

  renderCreateAction() {
    return `
      <div class="time-list-dashboard">
        <button class="time-list-create-card" data-action="open-create-task">
          <span class="time-list-create-plus">＋</span>
          <span>
            <strong>新建今日任务</strong>
            <em>${this.settings.notebookId ? "创建后写入今日日记" : "未选笔记本时只保存到插件"}</em>
          </span>
        </button>
        ${this.settings.notebookId ? "" : `<div class="time-list-note">还没有选择固定日记笔记本；任务会先保存在插件数据里，不会写入任何笔记本。</div>`}
      </div>
    `;
  }

  renderPomodoroPanel(pendingTasks) {
    const active = this.state.activePomodoro;
    if (active) {
      const task = this.findTask(active.taskId);
      const elapsedMs = getActiveElapsedMs(active);
      return `
        <div class="time-list-timer">
          <div class="time-list-timer-title">正向专注计时中</div>
          <div class="time-list-clock">${formatClock(elapsedMs)}</div>
          <div class="time-list-timer-task">${escapeHtml(task?.title || "任务已不存在")} · 停止后记录实际用时</div>
          <div class="time-list-actions">
            ${
              active.isPaused
                ? `<button class="time-list-button" data-action="resume-pomodoro">继续</button>`
                : `<button class="time-list-button time-list-button--muted" data-action="pause-pomodoro">暂停</button>`
            }
            <button class="time-list-button" data-action="finish-pomodoro">停止并记录</button>
            <button class="time-list-button time-list-button--danger" data-action="cancel-pomodoro">取消</button>
          </div>
        </div>
      `;
    }

    return "";
  }

  renderChart(todayTasks, completedTasks, abandonedTasks) {
    const total = completedTasks.reduce((sum, task) => sum + (task.actualMinutes || 0), 0);
    const totalPomodoro = todayTasks.reduce((sum, task) => sum + totalPomodoroMinutes(task), 0);
    const distributionTasks = completedTasks
      .slice()
      .sort((a, b) => (b.actualMinutes || 0) - (a.actualMinutes || 0))
      .filter((task) => (task.actualMinutes || 0) > 0);
    const pie = renderPieSvg(distributionTasks, total);
    const bars = distributionTasks
      .map((task) => {
        const minutes = task.actualMinutes || 0;
        const width = total > 0 ? Math.max(4, Math.round((minutes / total) * 100)) : 0;
        const color = PIE_COLORS[distributionTasks.indexOf(task) % PIE_COLORS.length];
        return `
          <div class="time-list-bar">
            <div class="time-list-bar-label">
              <span><i style="background:${color}"></i>${escapeHtml(task.title)}</span>
              <span>${formatMinutes(minutes)} · ${formatPercent(minutes, total)}</span>
            </div>
            <div class="time-list-bar-track"><div class="time-list-bar-fill" style="width:${width}%; background:${color}"></div></div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="time-list-chart">
        <div class="time-list-chart-title">今日总时长</div>
        <div class="time-list-metrics time-list-metrics--two">
          <div><span>完成用时</span><strong>${formatMinutes(total)}</strong></div>
          <div><span>番茄累计</span><strong>${formatMinutes(totalPomodoro)}</strong></div>
        </div>
        <div class="time-list-chart-body">
          ${pie}
          <div class="time-list-bars">${bars || `<div class="time-list-note">完成任务后，这里会出现今天的时间分布图。</div>`}</div>
        </div>
      </div>
    `;
  }

  renderTaskList(title, tasks) {
    const items = tasks
      .map((task) => this.renderTaskItem(task))
      .join("");
    return `
      <div>
        <div class="time-list-section-title">${title} · ${tasks.length}</div>
        <div class="time-list-items">
          ${items || `<div class="time-list-empty">今天还没有任务。点“新建今日任务”开始。</div>`}
        </div>
      </div>
    `;
  }

  renderTaskItem(task) {
    const pomodoroMinutes = totalPomodoroMinutes(task);
    const actual = task.status === "completed" ? `<span class="time-list-pill">实际 ${formatMinutes(task.actualMinutes)}</span>` : "";
    const pomodoro = `<span class="time-list-pill">番茄 ${formatMinutes(pomodoroMinutes)}</span>`;
    const status = normalizeTaskStatus(task);

    return `
      <div class="time-list-item time-list-item--${status}" data-task-id="${task.id}">
        <div class="time-list-item-main">
          <div>
            <div class="time-list-item-name">
              <span>${escapeHtml(task.title)}</span>
              <em>${taskStatusLabel(status)}</em>
            </div>
            <div class="time-list-item-meta">${pomodoro}${actual}</div>
          </div>
        </div>
        ${
          status === "completed"
            ? this.renderCompletedActions(task)
            : status === "abandoned"
              ? this.renderAbandonedActions(task)
              : this.renderPendingActions(task)
        }
      </div>
    `;
  }

  renderPendingActions(task) {
    return `
      <div class="time-list-actions">
        <button class="time-list-button" data-action="show-complete" data-task-id="${task.id}">完成</button>
        <button class="time-list-button time-list-button--muted" data-action="start-pomodoro" data-task-id="${task.id}" ${this.state.activePomodoro ? "disabled" : ""}>专注</button>
        <button class="time-list-button time-list-button--danger" data-action="abandon-task" data-task-id="${task.id}">放弃</button>
      </div>
    `;
  }

  renderCompletedActions(task) {
    return `
      <div class="time-list-note">${escapeHtml(task.note || "已完成")}</div>
      <div class="time-list-actions">
        <button class="time-list-button time-list-button--muted" data-action="reopen-task" data-task-id="${task.id}">重新打开</button>
        <button class="time-list-button time-list-button--danger" data-action="delete-task" data-task-id="${task.id}">删除</button>
      </div>
    `;
  }

  renderAbandonedActions(task) {
    return `
      <div class="time-list-note">已放弃</div>
      <div class="time-list-actions">
        <button class="time-list-button time-list-button--muted" data-action="reopen-task" data-task-id="${task.id}">恢复</button>
        <button class="time-list-button time-list-button--danger" data-action="delete-task" data-task-id="${task.id}">删除</button>
      </div>
    `;
  }

  bindEvents() {
    const root = this.dockElement.querySelector(".time-list-dock");
    if (!root) {
      return;
    }

    root.querySelector("[data-action='refresh']")?.addEventListener("click", () => this.render());
    root.querySelector("[data-action='open-setting']")?.addEventListener("click", () => this.openSetting());
    root.querySelector("[data-action='open-create-task']")?.addEventListener("click", () => this.openCreateTaskDialog());

    root.querySelectorAll("[data-action]").forEach((button) => {
      const action = button.dataset.action;
      if (["refresh", "open-setting", "open-create-task"].includes(action)) {
        return;
      }
      button.addEventListener("click", async () => {
        const taskId = button.dataset.taskId;
        if (action === "show-complete") {
          this.openCompleteTaskDialog(taskId);
        } else if (action === "switch-view") {
          this.currentDockView = button.dataset.view || "tasks";
          this.render();
        } else if (action === "start-pomodoro") {
          await this.startPomodoro(taskId);
        } else if (action === "pause-pomodoro") {
          await this.pausePomodoro();
        } else if (action === "resume-pomodoro") {
          await this.resumePomodoro();
        } else if (action === "finish-pomodoro") {
          await this.finishPomodoro();
        } else if (action === "cancel-pomodoro") {
          await this.cancelPomodoro();
        } else if (action === "reopen-task") {
          await this.reopenTask(taskId);
        } else if (action === "abandon-task") {
          await this.abandonTask(taskId);
        } else if (action === "delete-task") {
          await this.deleteTask(taskId);
        }
      });
    });
  }
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentTimeValue() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function parseTaskTitles(rawText) {
  return [...new Set(String(rawText)
    .split(/\n+/)
    .map((line) => line
      .trim()
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+[.)、]\s+/, "")
      .replace(/^\[[ xX]\]\s+/, "")
      .trim())
    .filter(Boolean))];
}

function normalizeTaskStatus(task) {
  if (task.status === "completed" || task.status === "abandoned") {
    return task.status;
  }
  return "pending";
}

function taskStatusLabel(status) {
  if (status === "completed") {
    return "已完成";
  }
  if (status === "abandoned") {
    return "已放弃";
  }
  return "待完成";
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

function diffTimeInputs(startTime, endTime) {
  if (!startTime || !endTime) {
    return 0;
  }
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some((part) => !Number.isFinite(part))) {
    return 0;
  }
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end < start) {
    end += 24 * 60;
  }
  return end - start;
}

function totalPomodoroMinutes(task) {
  return (task.pomodoros || []).reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
}

function getActiveElapsedMs(active) {
  const now = active.isPaused ? active.pausedAt : Date.now();
  return Math.max(0, now - active.startedAt - (active.pausedMs || 0));
}

function formatClock(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatMinutes(minutes) {
  const normalized = Number(minutes) || 0;
  if (normalized < 60) {
    return `${normalized} 分钟`;
  }
  const hours = Math.floor(normalized / 60);
  const rest = normalized % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function formatPercent(minutes, total) {
  if (!total) {
    return "0%";
  }
  return `${Math.round((minutes / total) * 100)}%`;
}

function renderPieSvg(tasks, total) {
  if (!tasks.length || total <= 0) {
    return `
      <div class="time-list-pie time-list-pie--empty">
        <div class="time-list-pie-empty">暂无分布</div>
      </div>
    `;
  }

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let used = 0;
  const circles = tasks.map((task, index) => {
    const minutes = task.actualMinutes || 0;
    const length = (minutes / total) * circumference;
    const dashOffset = -used;
    used += length;
    return `
      <circle
        cx="60"
        cy="60"
        r="${radius}"
        fill="transparent"
        stroke="${PIE_COLORS[index % PIE_COLORS.length]}"
        stroke-width="28"
        stroke-dasharray="${length} ${circumference - length}"
        stroke-dashoffset="${dashOffset}"
        transform="rotate(-90 60 60)"
      />
    `;
  }).join("");

  return `
    <div class="time-list-pie">
      <svg viewBox="0 0 120 120" role="img" aria-label="今日任务时间分布饼图">
        <circle cx="60" cy="60" r="${radius}" fill="transparent" stroke="var(--b3-theme-surface-lighter)" stroke-width="28" />
        ${circles}
      </svg>
      <div class="time-list-pie-center">
        <strong>${formatMinutes(total)}</strong>
        <span>完成用时</span>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeMarkdown(value) {
  return String(value).replace(/([\\`*_{}\[\]()#+\-.!|>])/g, "\\$1");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

module.exports = TimeListPlugin;
