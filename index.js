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
  <symbol id="iconTlPlus" viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></symbol>
  <symbol id="iconTlList" viewBox="0 0 24 24"><path d="M5 6.5h2v2H5v-2Zm4 .25h10v1.5H9v-1.5ZM5 11h2v2H5v-2Zm4 .25h10v1.5H9v-1.5ZM5 15.5h2v2H5v-2Zm4 .25h10v1.5H9v-1.5Z"/></symbol>
  <symbol id="iconTlPie" viewBox="0 0 24 24"><path d="M11 3a9 9 0 1 0 9 9h-9V3Zm2 0v7h7a9 9 0 0 0-7-7Z"/></symbol>
  <symbol id="iconTlCheck" viewBox="0 0 24 24"><path d="M19.7 6.3 9 17l-4.7-4.7 1.4-1.4L9 14.2l9.3-9.3 1.4 1.4Z"/></symbol>
  <symbol id="iconTlClock" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8V2Zm1 5h-2v6l5 3 .95-1.65L13 12V7Z"/></symbol>
  <symbol id="iconTlPause" viewBox="0 0 24 24"><path d="M7 5h3v14H7V5Zm7 0h3v14h-3V5Z"/></symbol>
  <symbol id="iconTlPlay" viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5Z"/></symbol>
  <symbol id="iconTlStop" viewBox="0 0 24 24"><path d="M6 6h12v12H6V6Z"/></symbol>
  <symbol id="iconTlClose" viewBox="0 0 24 24"><path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm11.2 0L19 6.4 6.4 19 5 17.6 17.6 5Z"/></symbol>
  <symbol id="iconTlUndo" viewBox="0 0 24 24"><path d="M8 7V4L3 9l5 5v-3h6a4 4 0 1 1 0 8H9v-2h5a2 2 0 1 0 0-4H8Z"/></symbol>
  <symbol id="iconTlTrash" viewBox="0 0 24 24"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.8 11H7.8L7 9Z"/></symbol>
  <symbol id="iconTlSettings" viewBox="0 0 24 24"><path d="M19.4 13.5a7.8 7.8 0 0 0 0-3l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2.6-1.5L14 2h-4l-.4 3a8 8 0 0 0-2.6 1.5l-2.4-1-2 3.5 2 1.5a7.8 7.8 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2.6 1.5l.4 3h4l.4-3a8 8 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"/></symbol>
  <symbol id="iconTlRefresh" viewBox="0 0 24 24"><path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.3L13 11h8V3l-3.3 3.3Z"/></symbol>
`;

const defaultSettings = {
  notebookId: "",
  autoAppendToDailyNote: true,
  habitDocId: "",
  autoImportHabits: true,
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
      await this.importHabitsForToday({ silent: true });
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

    const habitDocInput = document.createElement("input");
    habitDocInput.className = "b3-text-field fn__flex-center fn__size200";
    habitDocInput.placeholder = "习惯文档 ID";
    habitDocInput.value = this.settings.habitDocId || "";

    const habitToggle = document.createElement("input");
    habitToggle.type = "checkbox";
    habitToggle.checked = this.settings.autoImportHabits;

    this.setting = new Setting({
      confirmCallback: async () => {
        this.settings.notebookId = notebookSelect.value;
        this.settings.autoAppendToDailyNote = appendToggle.checked;
        this.settings.habitDocId = habitDocInput.value.trim();
        this.settings.autoImportHabits = habitToggle.checked;
        await this.saveSettings();
        await this.importHabitsForToday({ silent: false });
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

    this.setting.addItem({
      title: "习惯文档 ID",
      description: "每天自动读取这个文档里的每一行，创建为今日习惯任务。",
      createActionElement: () => habitDocInput,
    });

    this.setting.addItem({
      title: "自动导入习惯",
      description: "插件加载或刷新时，为今天补齐习惯任务。",
      createActionElement: () => habitToggle,
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

        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label style="font-size: 13px; font-weight: 500; color: var(--b3-theme-on-surface);">习惯文档 ID</label>
          <input id="time-list-habit-doc-id" class="b3-text-field" placeholder="粘贴习惯文档 ID" value="${escapeAttr(this.settings.habitDocId || "")}" style="width: 100%;" />
        </div>

        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--b3-theme-on-surface);">
          <input id="time-list-auto-habits" type="checkbox" ${this.settings.autoImportHabits ? "checked" : ""} />
          每天自动导入习惯任务
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
    const habitDocInput = root.querySelector("#time-list-habit-doc-id");
    const habitToggle = root.querySelector("#time-list-auto-habits");
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
        habitDocId: habitDocInput.value.trim(),
        autoImportHabits: habitToggle.checked,
      };
      await this.saveSettings();
      await this.importHabitsForToday({ silent: false });
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
        plugin.importHabitsForToday({ silent: true }).then(() => plugin.render());
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

  async getDocumentMarkdown(documentId) {
    const data = await this.request("/api/export/exportMdContent", { id: documentId });
    return String(data?.content || data || "");
  }

  async importHabitsForToday({ silent = true } = {}) {
    if (!this.settings.autoImportHabits || !this.settings.habitDocId) {
      return 0;
    }

    let markdown = "";
    try {
      markdown = await this.getDocumentMarkdown(this.settings.habitDocId);
    } catch (error) {
      console.warn("[siyuan-time-list] failed to read habit document", error);
      if (!silent) {
        showMessage(`读取习惯文档失败：${error.message}`, 5000, "error");
      }
      return 0;
    }

    const titles = parseHabitTitles(markdown);
    await this.cleanupInvalidHabitTasksForToday();
    if (titles.length === 0) {
      if (!silent) {
        showMessage("习惯文档里没有可导入的行。", 3000, "error");
      }
      return 0;
    }

    const date = todayKey();
    const existingKeys = new Set(this.state.tasks
      .filter((task) => task.date === date)
      .map((task) => normalizeTitleKey(task.title)));
    const nextTitles = titles.filter((title) => !existingKeys.has(normalizeTitleKey(title)));
    if (nextTitles.length === 0) {
      if (!silent) {
        showMessage("今天的习惯任务已经创建过了");
      }
      return 0;
    }

    const now = new Date().toISOString();
    const tasks = nextTitles.map((title) => ({
      id: createId(),
      title,
      date,
      status: "pending",
      source: "habit",
      sourceDocId: this.settings.habitDocId,
      sourceKey: normalizeTitleKey(title),
      createdAt: now,
      completedAt: "",
      actualMinutes: 0,
      completionMode: "",
      pomodoros: [],
      note: "",
    }));

    this.state.tasks.unshift(...tasks);
    await this.saveState();

    try {
      const markdown = tasks.map((task) => `* [ ] ${escapeMarkdown(task.title)} #习惯任务#`).join("\n") + "\n";
      await this.appendDailyNote(markdown);
    } catch (error) {
      console.warn("[siyuan-time-list] failed to append habit tasks", error);
    }

    if (!silent) {
      showMessage(`已导入 ${tasks.length} 个习惯任务`);
    }
    return tasks.length;
  }

  async cleanupInvalidHabitTasksForToday() {
    const date = todayKey();
    const before = this.state.tasks.length;
    this.state.tasks = this.state.tasks.filter((task) => {
      return !(task.date === date && isMetadataLine(task.title));
    });
    if (this.state.tasks.length !== before) {
      await this.saveState();
    }
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
      <div class="time-list-dialog time-list-complete-dialog" data-selected-mode="manual">
        <div class="time-list-dialog-title">${escapeHtml(task.title)}</div>
        <div class="time-list-dialog-hint">
          番茄累计 ${formatMinutes(pomodoroMinutes)} · ${(task.pomodoros || []).length} 次专注
        </div>

        <div class="time-list-choice-grid time-list-choice-grid--two">
          <button class="time-list-choice-card is-active" data-action="dialog-mode" data-mode="manual">
            <strong>直接填</strong>
            <span>输入总分钟数</span>
          </button>
          <button class="time-list-choice-card" data-action="dialog-mode" data-mode="pomodoro">
            <strong>番茄总和</strong>
            <span>使用累计专注</span>
          </button>
        </div>

        <div class="time-list-dialog-mode" data-role="dialog-mode-body" data-mode="manual">
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
    const minutesInput = root.querySelector("#time-list-complete-minutes");

    const getMode = () => container.dataset.selectedMode || "manual";
    const getPayload = () => ({
      minutes: minutesInput?.value || "",
    });
    const updatePreview = () => {
      const mode = getMode();
      const minutes = this.resolveCompletionMinutes(task, mode, getPayload());
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
    [minutesInput].forEach((input) => {
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
    setTimeout(() => minutesInput?.focus(), 0);
  }

  resolveCompletionMinutes(task, mode, payload) {
    if (mode === "manual") {
      return clampNumber(payload.minutes, 0, 24 * 60, 0);
    }
    if (mode === "pomodoro") {
      return totalPomodoroMinutes(task);
    }
    return 0;
  }

  buildCompletionNote(mode, payload, minutes) {
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

    const beforeCleanup = this.state.tasks.length;
    this.state.tasks = this.state.tasks.filter((task) => !(task.date === todayKey() && isMetadataLine(task.title)));
    if (this.state.tasks.length !== beforeCleanup) {
      this.saveState();
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
    return `
      <div class="time-list-header">
        <div class="time-list-title">
          <strong>${todayKey()}</strong>
        </div>
        <div class="time-list-icon-group">
          ${iconButton("iconTlSettings", "open-setting", "设置")}
          ${iconButton("iconTlRefresh", "refresh", "刷新")}
        </div>
      </div>
    `;
  }

  renderViewTabs() {
    return `
      <div class="time-list-tabs">
        <button class="${this.currentDockView === "tasks" ? "is-active" : ""}" data-action="switch-view" data-view="tasks">${icon("iconTlList")}<span>任务</span></button>
        <button class="${this.currentDockView === "summary" ? "is-active" : ""}" data-action="switch-view" data-view="summary">${icon("iconTlPie")}<span>总结</span></button>
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
          ${icon("iconTlPlus")}
          <strong>新建</strong>
        </button>
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
          <div class="time-list-timer-head">
            ${icon("iconTlClock")}
            <span>${escapeHtml(task?.title || "任务已不存在")}</span>
            <strong>${formatClock(elapsedMs)}</strong>
          </div>
          <div class="time-list-icon-group time-list-icon-group--center">
            ${
              active.isPaused
                ? iconButton("iconTlPlay", "resume-pomodoro", "继续")
                : iconButton("iconTlPause", "pause-pomodoro", "暂停")
            }
            ${iconButton("iconTlStop", "finish-pomodoro", "停止并记录")}
            ${iconButton("iconTlClose", "cancel-pomodoro", "取消", "danger")}
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
        </div>
        <div class="time-list-bars">${bars || `<div class="time-list-note">暂无数据</div>`}</div>
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
    const status = normalizeTaskStatus(task);
    const minutes = status === "completed" ? task.actualMinutes : pomodoroMinutes;
    const timeText = minutes ? formatCompactMinutes(minutes) : "0m";

    return `
      <div class="time-list-item time-list-item--${status}" data-task-id="${task.id}">
        <div class="time-list-item-head">
          <strong>${task.source === "habit" ? "习惯" : status === "completed" ? "今天" : "全天"}</strong>
          <span>${icon("iconTlClock")}${timeText}</span>
          <em>${taskStatusLabel(status)}</em>
        </div>
        <div class="time-list-item-name">${escapeHtml(task.title)}</div>
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
        ${iconButton("iconTlCheck", "show-complete", "完成", "", task.id)}
        ${iconButton("iconTlClock", "start-pomodoro", "开始番茄", "", task.id, this.state.activePomodoro)}
        ${iconButton("iconTlClose", "abandon-task", "放弃", "danger", task.id)}
      </div>
    `;
  }

  renderCompletedActions(task) {
    return `
      <div class="time-list-actions">
        ${iconButton("iconTlUndo", "reopen-task", "恢复", "", task.id)}
        ${iconButton("iconTlTrash", "delete-task", "删除", "danger", task.id)}
      </div>
    `;
  }

  renderAbandonedActions(task) {
    return `
      <div class="time-list-actions">
        ${iconButton("iconTlUndo", "reopen-task", "恢复", "", task.id)}
        ${iconButton("iconTlTrash", "delete-task", "删除", "danger", task.id)}
      </div>
    `;
  }

  bindEvents() {
    const root = this.dockElement.querySelector(".time-list-dock");
    if (!root) {
      return;
    }

    root.querySelector("[data-action='open-setting']")?.addEventListener("click", () => this.openSetting());
    root.querySelector("[data-action='open-create-task']")?.addEventListener("click", () => this.openCreateTaskDialog());
    root.querySelector("[data-action='refresh']")?.addEventListener("click", async () => {
      await this.importHabitsForToday({ silent: false });
      this.render();
    });

    root.querySelectorAll("[data-action]").forEach((button) => {
      const action = button.dataset.action;
      if (["open-setting", "open-create-task", "refresh"].includes(action)) {
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

function parseTaskTitles(rawText) {
  return [...new Set(String(rawText)
    .split(/\n+/)
    .map(cleanTaskLine)
    .filter(Boolean))];
}

function parseHabitTitles(markdown) {
  const titles = [];
  let inCodeBlock = false;
  let inFrontmatter = false;
  let hasSeenContent = false;
  for (const rawLine of String(markdown || "").split(/\n+/)) {
    const line = rawLine.trim();
    if (!hasSeenContent && line === "---") {
      inFrontmatter = true;
      hasSeenContent = true;
      continue;
    }
    if (inFrontmatter) {
      if (line === "---") {
        inFrontmatter = false;
      }
      continue;
    }
    if (line.startsWith("```") || line.startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock || !line || line.startsWith("#") || line.startsWith("|") || line === "---" || isMetadataLine(line)) {
      continue;
    }
    hasSeenContent = true;
    const title = cleanTaskLine(line);
    if (title && !isMetadataLine(title)) {
      titles.push(title);
    }
  }
  return [...new Set(titles)];
}

function isMetadataLine(line) {
  const text = String(line || "").trim();
  if (!text) {
    return true;
  }
  if (/^(title|date|lastmod|updated|created|modified|tags|categories|aliases|id|type|status|author|description|slug)\s*[:：]/i.test(text)) {
    return true;
  }
  if (/^[a-zA-Z_][\w-]{0,32}\s*[:：]\s*\S+/.test(text)) {
    return true;
  }
  return false;
}

function cleanTaskLine(line) {
  return String(line)
    .trim()
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)、]\s+/, "")
    .replace(/^\[[ xX]\]\s+/, "")
    .replace(/^【.*?】\s*/, "")
    .replace(/\s*#\S+#?\s*$/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

function normalizeTitleKey(title) {
  return cleanTaskLine(title).replace(/\s+/g, "").toLowerCase();
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

function formatCompactMinutes(minutes) {
  const normalized = Number(minutes) || 0;
  if (normalized < 60) {
    return `${normalized}m`;
  }
  const hours = Math.floor(normalized / 60);
  const rest = normalized % 60;
  return rest ? `${hours}h${rest}m` : `${hours}h`;
}

function formatPercent(minutes, total) {
  if (!total) {
    return "0%";
  }
  return `${Math.round((minutes / total) * 100)}%`;
}

function icon(name) {
  return `<svg class="time-list-icon" aria-hidden="true"><use xlink:href="#${name}"></use></svg>`;
}

function iconButton(iconName, action, label, variant = "", taskId = "", disabled = false) {
  const classes = ["time-list-icon-button"];
  if (variant) {
    classes.push(`time-list-icon-button--${variant}`);
  }
  return `
    <button
      class="${classes.join(" ")}"
      data-action="${action}"
      ${taskId ? `data-task-id="${escapeAttr(taskId)}"` : ""}
      title="${escapeAttr(label)}"
      aria-label="${escapeAttr(label)}"
      ${disabled ? "disabled" : ""}
    >
      ${icon(iconName)}
    </button>
  `;
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
