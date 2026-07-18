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
  <symbol id="iconTlCalendar" viewBox="0 0 24 24"><path d="M7 2h2v3h6V2h2v3h3v16H4V5h3V2Zm11 8H6v9h12v-9ZM6 7v1h12V7H6Zm2 5h3v3H8v-3Z"/></symbol>
  <symbol id="iconTlChevronLeft" viewBox="0 0 24 24"><path d="m14.7 6.3 1.4 1.4L11.8 12l4.3 4.3-1.4 1.4L9 12l5.7-5.7Z"/></symbol>
  <symbol id="iconTlChevronRight" viewBox="0 0 24 24"><path d="m9.3 17.7-1.4-1.4 4.3-4.3-4.3-4.3 1.4-1.4L15 12l-5.7 5.7Z"/></symbol>
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
    this.calendarMode = "day";
    this.calendarDate = todayKey();
    this.timerHandle = null;
    this.autoSyncTimer = null;
    this.boundWsMainHandler = null;
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
    this.boundWsMainHandler = (event) => this.handleWsMain(event);
    this.eventBus.on("ws-main", this.boundWsMainHandler);
  }

  async onLayoutReady() {
    try {
      await this.loadAllData();
      this.registerDock();
      await this.setupSettings();
      await this.syncTodayFromDailyNote({ silent: true });
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
    this.stopAutoSync();
    if (this.boundWsMainHandler) {
      this.eventBus.off("ws-main", this.boundWsMainHandler);
      this.boundWsMainHandler = null;
    }
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
        await this.syncTodayFromDailyNote({ silent: true });
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
          配置任务写入哪个笔记本的今日日记。
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
        plugin.syncTodayFromDailyNote({ silent: true })
          .then(() => plugin.importHabitsForToday({ silent: true }))
          .then(() => plugin.render());
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

  stopAutoSync() {
    if (this.autoSyncTimer) {
      window.clearTimeout(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  handleWsMain(event) {
    if (!this.dockElement || !this.settings.notebookId || !shouldSyncFromWsEvent(event, this.state.tasks)) {
      return;
    }
    this.scheduleAutoSync();
  }

  scheduleAutoSync() {
    this.stopAutoSync();
    this.autoSyncTimer = window.setTimeout(async () => {
      this.autoSyncTimer = null;
      await this.syncTodayFromDailyNote({ silent: true });
      if (this.dockElement) {
        this.render();
      }
    }, 450);
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
      return null;
    }
    const notebook = await this.ensureNotebookId();
    try {
      return await this.request("/api/block/appendDailyNoteBlock", {
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
      return await this.request("/api/block/appendBlock", {
        parentID,
        dataType: "markdown",
        data: markdown,
      });
    }
  }

  async writeTaskToDailyNote(task, status = normalizeTaskStatus(task), options = {}) {
    if (!this.canWriteDailyNote()) {
      return false;
    }
    const markdown = formatDailyTaskRecord(task, status, options);
    let changed = false;
    if (!task.blockId) {
      task.blockId = await this.findDailyTaskBlockId(task);
      changed = Boolean(task.blockId);
    }
    if (task.blockId) {
      try {
        await this.request("/api/block/updateBlock", {
          id: task.blockId,
          dataType: "markdown",
          data: markdown,
        });
        return changed;
      } catch (error) {
        console.warn("[siyuan-time-list] failed to update task block, append instead", error);
        task.blockId = "";
        changed = true;
      }
    }
    const result = await this.appendDailyNote(markdown);
    const blockId = extractBlockId(result);
    if (blockId) {
      task.blockId = blockId;
      return true;
    }
    task.blockId = await this.findDailyTaskBlockId(task);
    return Boolean(task.blockId) || changed;
  }

  async findDailyTaskBlockId(task) {
    const rows = await this.queryDailyTaskBlocks(task.date || todayKey());
    const records = parseDailyTaskRecordsFromRows(rows)
      .filter((record) => record.date === (task.date || todayKey()))
      .filter((record) => normalizeTitleKey(record.title) === normalizeTitleKey(task.title))
      .filter((record) => record.blockId);
    return records.at(-1)?.blockId || "";
  }

  async writeTasksToDailyNote(tasks) {
    let changed = false;
    for (const task of tasks) {
      changed = await this.writeTaskToDailyNote(task) || changed;
    }
    if (changed) {
      await this.saveState();
    }
  }

  async deleteDailyTaskBlock(task) {
    if (!task.blockId) {
      return;
    }
    try {
      await this.request("/api/block/deleteBlock", { id: task.blockId });
    } catch (error) {
      console.warn("[siyuan-time-list] failed to delete task block", error);
    }
  }

  async queryDailyTaskBlocks(date) {
    if (!this.settings.notebookId) {
      return [];
    }
    const notebook = await this.ensureNotebookId();
    const stmt = [
      "select id, markdown, content, created, updated from blocks",
      `where box = '${escapeSql(notebook)}'`,
      "and type <> 'd'",
      `and (markdown like '%📅${escapeSql(date)}%' or content like '%📅${escapeSql(date)}%')`,
      "order by created asc",
    ].join(" ");
    const rows = await this.request("/api/query/sql", { stmt });
    return Array.isArray(rows) ? rows : [];
  }

  async syncTodayFromDailyNote({ silent = true } = {}) {
    if (!this.settings.notebookId) {
      return 0;
    }
    const date = todayKey();
    let rows = [];
    try {
      rows = await this.queryDailyTaskBlocks(date);
    } catch (error) {
      console.warn("[siyuan-time-list] failed to sync daily note", error);
      if (!silent) {
        showMessage(`同步今日日记失败：${error.message}`, 5000, "error");
      }
      return 0;
    }
    const records = parseDailyTaskRecordsFromRows(rows).filter((record) => record.date === date);
    const changed = this.mergeDailyTaskRecords(records, date);
    if (changed) {
      await this.saveState();
    }
    if (!silent) {
      showMessage(changed ? "已同步今日日记" : "今日日记已是最新");
    }
    return records.length;
  }

  mergeDailyTaskRecords(records, date) {
    let changed = false;
    const byBlockId = new Map(this.state.tasks.filter((task) => task.blockId).map((task) => [task.blockId, task]));
    const byKey = new Map(this.state.tasks.map((task) => [`${task.date || date}|${normalizeTitleKey(task.title)}`, task]));
    const seenBlockIds = new Set(records.map((record) => record.blockId).filter(Boolean));

    records.forEach((record) => {
      const key = `${record.date}|${normalizeTitleKey(record.title)}`;
      let task = record.blockId ? byBlockId.get(record.blockId) : null;
      task = task || byKey.get(key);
      if (!task) {
        task = {
          id: createId(),
          title: record.title,
          date: record.date,
          status: record.status,
          source: "daily-note",
          blockId: record.blockId,
          createdAt: record.createdAt || new Date().toISOString(),
          completedAt: record.status === "completed" ? new Date().toISOString() : "",
          abandonedAt: record.status === "abandoned" ? new Date().toISOString() : "",
          actualMinutes: record.actualMinutes,
          completionMode: record.status === "completed" ? "document" : "",
          pomodoros: [],
          note: record.status === "completed" ? "文档同步" : "",
          summary: record.summary,
        };
        this.state.tasks.unshift(task);
        changed = true;
        return;
      }

      const nextValues = {
        title: record.title,
        date: record.date,
        status: record.status,
        blockId: record.blockId || task.blockId || "",
        actualMinutes: record.actualMinutes,
        completedAt: record.status === "completed" ? (task.completedAt || new Date().toISOString()) : "",
        abandonedAt: record.status === "abandoned" ? (task.abandonedAt || new Date().toISOString()) : "",
        completionMode: record.status === "completed" ? (task.completionMode || "document") : "",
        note: record.status === "completed" ? (task.note || "文档同步") : record.status === "abandoned" ? "已放弃" : "",
        summary: record.summary,
      };
      Object.entries(nextValues).forEach(([field, value]) => {
        if (task[field] !== value) {
          task[field] = value;
          changed = true;
        }
      });
    });

    const before = this.state.tasks.length;
    this.state.tasks = this.state.tasks.filter((task) => {
      return !(task.date === date && task.blockId && !seenBlockIds.has(task.blockId));
    });
    if (this.state.tasks.length !== before) {
      if (this.state.activePomodoro && !this.findTask(this.state.activePomodoro.taskId)) {
        this.state.activePomodoro = null;
      }
      changed = true;
    }
    return changed;
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
      summary: "",
    }));

    this.state.tasks.unshift(...tasks);
    await this.saveState();

    try {
      await this.writeTasksToDailyNote(tasks);
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
      summary: "",
    }));

    this.state.tasks.unshift(...tasks);
    await this.saveState();
    this.render();

    try {
      await this.writeTasksToDailyNote(tasks);
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
          <textarea id="time-list-create-titles" class="b3-text-field time-list-textarea" placeholder="支持多任务创建&#10;使用换行分隔"></textarea>
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
    task.summary = String(payload?.summary || "").trim();

    await this.saveState();
    this.render();

    try {
      const changed = await this.writeTaskToDailyNote(task, "completed", { minutes, summary: task.summary });
      if (changed) {
        await this.saveState();
      }
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

        <label class="time-list-field">
          <span>任务总结（可选）</span>
          <textarea id="time-list-complete-summary" class="b3-text-field time-list-summary-textarea" placeholder="简单写一下完成情况"></textarea>
        </label>

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
    const submitButton = root.querySelector("#time-list-complete-submit");
    const cancelButton = root.querySelector("#time-list-complete-cancel");
    const minutesInput = root.querySelector("#time-list-complete-minutes");
    const summaryInput = root.querySelector("#time-list-complete-summary");

    const getMode = () => container.dataset.selectedMode || "manual";
    const getPayload = () => ({
      minutes: minutesInput?.value || "",
      summary: summaryInput?.value || "",
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
    task.summary = "";
    await this.saveState();
    try {
      const changed = await this.writeTaskToDailyNote(task, "pending");
      if (changed) {
        await this.saveState();
      }
    } catch (error) {
      showMessage(`任务已恢复，但写入日记失败：${error.message}`, 5000, "error");
    }
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
      const changed = await this.writeTaskToDailyNote(task, "abandoned");
      if (changed) {
        await this.saveState();
      }
      showMessage("已放弃任务");
    } catch (error) {
      showMessage(`任务已放弃，但写入日记失败：${error.message}`, 5000, "error");
    }
  }

  async deleteTask(taskId) {
    if (this.state.activePomodoro?.taskId === taskId) {
      await this.stopPomodoro(false);
    }
    const task = this.findTask(taskId);
    if (task) {
      await this.deleteDailyTaskBlock(task);
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

  getCalendarTasks() {
    return this.state.tasks.filter((task) => isTaskInCalendarRange(task, this.calendarDate, this.calendarMode));
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
            : this.currentDockView === "calendar"
              ? this.renderCalendarView()
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
        <button class="${this.currentDockView === "calendar" ? "is-active" : ""}" data-action="switch-view" data-view="calendar">${icon("iconTlCalendar")}<span>日历</span></button>
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

  renderCalendarView() {
    const tasks = this.getCalendarTasks();
    const completedTasks = tasks.filter((task) => normalizeTaskStatus(task) === "completed");
    const total = completedTasks.reduce((sum, task) => sum + (task.actualMinutes || 0), 0);

    return `
      <div class="time-list-calendar">
        <div class="time-list-calendar-nav">
          ${iconButton("iconTlChevronLeft", "calendar-prev", "上一个")}
          <strong>${escapeHtml(formatCalendarTitle(this.calendarDate, this.calendarMode))}</strong>
          ${iconButton("iconTlChevronRight", "calendar-next", "下一个")}
        </div>
        <div class="time-list-calendar-modes">
          ${["day", "week", "month", "year"].map((mode) => `
            <button class="${this.calendarMode === mode ? "is-active" : ""}" data-action="calendar-mode" data-mode="${mode}">${calendarModeLabel(mode)}</button>
          `).join("")}
        </div>
        <div class="time-list-metrics time-list-metrics--two">
          <div><span>任务数</span><strong>${tasks.length}</strong></div>
          <div><span>完成用时</span><strong>${formatMinutes(total)}</strong></div>
        </div>
      </div>
      <div class="time-list-scroll">
        ${this.renderCalendarTaskGroups(tasks)}
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
    const sortedTasks = sortTasksForDisplay(tasks);
    const items = sortedTasks
      .map((task) => this.renderTaskItem(task))
      .join("");
    return `
      <div>
        <div class="time-list-section-title">${title} · ${sortedTasks.length}</div>
        <div class="time-list-items">
          ${items || `<div class="time-list-empty">今天还没有任务。点“新建今日任务”开始。</div>`}
        </div>
      </div>
    `;
  }

  renderCalendarTaskGroups(tasks) {
    if (tasks.length === 0) {
      return `<div class="time-list-empty">这个范围里还没有任务。</div>`;
    }
    const groups = groupTasksByDate(tasks);
    return groups.map(([date, dateTasks]) => `
      <div>
        <div class="time-list-section-title">${date} · ${dateTasks.length}</div>
        <div class="time-list-items">
          ${sortTasksForDisplay(dateTasks).map((task) => this.renderTaskItem(task)).join("")}
        </div>
      </div>
    `).join("");
  }

  renderTaskItem(task) {
    const pomodoroMinutes = totalPomodoroMinutes(task);
    const status = normalizeTaskStatus(task);
    const minutes = status === "completed" ? task.actualMinutes : pomodoroMinutes;
    const timeText = minutes ? formatCompactMinutes(minutes) : "0m";

    return `
      <div class="time-list-item time-list-item--${status}" data-task-id="${task.id}">
        <div class="time-list-item-head">
          <strong>${escapeHtml(taskScopeLabel(task, status))}</strong>
          <span>${icon("iconTlClock")}${timeText}</span>
          <em>${taskStatusLabel(status)}</em>
        </div>
        <div class="time-list-item-name">${escapeHtml(task.title)}</div>
        ${task.summary ? `<div class="time-list-item-summary">${escapeHtml(task.summary)}</div>` : ""}
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
      await this.syncTodayFromDailyNote({ silent: true });
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
        } else if (action === "calendar-mode") {
          this.calendarMode = button.dataset.mode || "day";
          this.render();
        } else if (action === "calendar-prev") {
          this.calendarDate = shiftCalendarDate(this.calendarDate, this.calendarMode, -1);
          this.render();
        } else if (action === "calendar-next") {
          this.calendarDate = shiftCalendarDate(this.calendarDate, this.calendarMode, 1);
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
    .replace(/\s*📅\s*\d{4}-\d{2}-\d{2}\s*/g, " ")
    .replace(/\s*(✅|✔️|☑️|🚫|❌)\s*/g, " ")
    .replace(/\s*⏱\s*\S+\s*/g, " ")
    .replace(/\s*用时\s*\S+\s*/g, " ")
    .replace(/\s*📝.*$/g, "")
    .replace(/\s*#\S+#?\s*$/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDailyTaskRecords(tasks) {
  return tasks.map((task) => formatDailyTaskLine(task)).join("\n\n") + "\n";
}

function formatDailyTaskRecord(task, status = normalizeTaskStatus(task), options = {}) {
  const summary = String(options.summary ?? task.summary ?? "").trim();
  const summaryText = summary ? ` 📝${escapeMarkdown(summary).replace(/\s+/g, " ")}` : "";
  return `${formatDailyTaskLine(task, status, options)}${summaryText}\n`;
}

function formatDailyTaskLine(task, status = normalizeTaskStatus(task), options = {}) {
  const date = task.date || todayKey();
  const parts = [escapeMarkdown(task.title), `📅${date}`];
  if (status === "completed") {
    const minutes = Number(options.minutes ?? task.actualMinutes) || 0;
    parts.push("✅");
    if (minutes > 0) {
      parts.push(`⏱${formatCompactMinutes(minutes)}`);
    }
  } else if (status === "abandoned") {
    parts.push("🚫");
  }
  return parts.join(" ");
}

function normalizeTitleKey(title) {
  return cleanTaskLine(title).replace(/\s+/g, "").toLowerCase();
}

function parseDailyTaskRecordsFromRows(rows) {
  const records = [];
  rows.forEach((row) => {
    const markdown = String(row.markdown || row.content || "");
    const parsedLines = markdown
      .split(/\n+/)
      .map((line) => parseDailyTaskRecord(line, row))
      .filter(Boolean);
    parsedLines.forEach((record) => {
      records.push({
        ...record,
        blockId: parsedLines.length === 1 ? row.id : "",
        createdAt: row.created ? siyuanTimeToIso(row.created) : "",
      });
    });
  });
  return records;
}

function parseDailyTaskRecord(line, row = {}) {
  const text = String(line || "").trim();
  const dateMatch = /📅\s*(\d{4}-\d{2}-\d{2})/.exec(text);
  if (!dateMatch) {
    return null;
  }
  const title = cleanTaskLine(text.slice(0, dateMatch.index));
  if (!title || isMetadataLine(title)) {
    return null;
  }
  const status = /✅|✔️|☑️/.test(text) ? "completed" : /🚫|❌/.test(text) ? "abandoned" : "pending";
  const summaryMatch = /📝\s*(.+)$/.exec(text);
  const actualMinutes = status === "completed" ? parseTaskMinutes(text) : 0;
  return {
    title,
    date: dateMatch[1],
    status,
    blockId: row.id || "",
    actualMinutes,
    summary: summaryMatch ? unescapeMarkdown(summaryMatch[1].trim()) : "",
  };
}

function parseTaskMinutes(text) {
  const compactMatch = /⏱\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i.exec(text);
  if (compactMatch && (compactMatch[1] || compactMatch[2])) {
    return (Number(compactMatch[1]) || 0) * 60 + (Number(compactMatch[2]) || 0);
  }
  const minuteMatch = /用时\s*(\d+)\s*(?:分钟|m)?/i.exec(text);
  if (minuteMatch) {
    return Number(minuteMatch[1]) || 0;
  }
  return 0;
}

function shouldSyncFromWsEvent(event, tasks) {
  const detail = event?.detail;
  if (!detail) {
    return false;
  }
  const haystack = safeStringify(detail);
  if (!haystack) {
    return false;
  }
  if (haystack.includes(`📅${todayKey()}`)) {
    return true;
  }
  return tasks
    .filter((task) => task.date === todayKey() && task.blockId)
    .some((task) => haystack.includes(task.blockId));
}

function safeStringify(value) {
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (key, item) => {
      if (typeof item === "function") {
        return undefined;
      }
      if (typeof Element !== "undefined" && item instanceof Element) {
        return {
          id: item.getAttribute("data-node-id") || item.id || "",
          text: item.textContent || "",
        };
      }
      if (item && typeof item === "object") {
        if (seen.has(item)) {
          return undefined;
        }
        seen.add(item);
      }
      return item;
    });
  } catch (error) {
    console.warn("[siyuan-time-list] failed to stringify ws event", error);
    return "";
  }
}

function siyuanTimeToIso(value) {
  const text = String(value || "");
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(text);
  if (!match) {
    return "";
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])).toISOString();
}

function sortTasksForDisplay(tasks) {
  const statusOrder = {
    pending: 0,
    abandoned: 1,
    completed: 2,
  };
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((left, right) => {
      const leftStatus = normalizeTaskStatus(left.task);
      const rightStatus = normalizeTaskStatus(right.task);
      const statusDiff = statusOrder[leftStatus] - statusOrder[rightStatus];
      if (statusDiff !== 0) {
        return statusDiff;
      }
      const leftTime = Date.parse(left.task.createdAt || left.task.completedAt || "") || 0;
      const rightTime = Date.parse(right.task.createdAt || right.task.completedAt || "") || 0;
      return rightTime - leftTime || left.index - right.index;
    })
    .map((item) => item.task);
}

function groupTasksByDate(tasks) {
  const map = new Map();
  tasks.forEach((task) => {
    const date = task.date || todayKey();
    if (!map.has(date)) {
      map.set(date, []);
    }
    map.get(date).push(task);
  });
  return [...map.entries()].sort(([leftDate], [rightDate]) => rightDate.localeCompare(leftDate));
}

function isTaskInCalendarRange(task, selectedDate, mode) {
  const date = task.date || "";
  if (mode === "year") {
    return date.slice(0, 4) === selectedDate.slice(0, 4);
  }
  if (mode === "month") {
    return date.slice(0, 7) === selectedDate.slice(0, 7);
  }
  if (mode === "week") {
    const taskTime = parseDateKey(date).getTime();
    const [start, end] = getWeekRange(selectedDate);
    return taskTime >= start.getTime() && taskTime <= end.getTime();
  }
  return date === selectedDate;
}

function shiftCalendarDate(dateKey, mode, direction) {
  const date = parseDateKey(dateKey);
  if (mode === "year") {
    date.setFullYear(date.getFullYear() + direction);
  } else if (mode === "month") {
    date.setMonth(date.getMonth() + direction);
  } else if (mode === "week") {
    date.setDate(date.getDate() + direction * 7);
  } else {
    date.setDate(date.getDate() + direction);
  }
  return formatDateKey(date);
}

function parseDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) {
    return new Date();
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCalendarTitle(dateKey, mode) {
  if (mode === "year") {
    return dateKey.slice(0, 4);
  }
  if (mode === "month") {
    return dateKey.slice(0, 7);
  }
  if (mode === "week") {
    const [start, end] = getWeekRange(dateKey);
    return `${formatDateKey(start)} ~ ${formatDateKey(end)}`;
  }
  return dateKey;
}

function calendarModeLabel(mode) {
  if (mode === "year") {
    return "年";
  }
  if (mode === "month") {
    return "月";
  }
  if (mode === "week") {
    return "周";
  }
  return "日";
}

function getWeekRange(dateKey) {
  const date = parseDateKey(dateKey);
  const day = date.getDay() || 7;
  const start = new Date(date);
  start.setDate(date.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return [start, end];
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

function taskScopeLabel(task, status) {
  if (task.source === "habit") {
    return "习惯";
  }
  if (task.date && task.date !== todayKey()) {
    return task.date.slice(5);
  }
  if (status === "completed") {
    return "今天";
  }
  return "全天";
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

function unescapeMarkdown(value) {
  return String(value).replace(/\\([\\`*_{}\[\]()#+\-.!|>])/g, "$1");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

function extractBlockId(result) {
  if (!result) {
    return "";
  }
  if (typeof result === "string") {
    return result;
  }
  if (result.id) {
    return result.id;
  }
  if (result.blockId) {
    return result.blockId;
  }
  if (Array.isArray(result)) {
    return extractBlockId(result[0]);
  }
  const operations = [
    ...(Array.isArray(result.doOperations) ? result.doOperations : []),
    ...(Array.isArray(result.transactions) ? result.transactions.flatMap((item) => item.doOperations || []) : []),
  ];
  const operation = operations.find((item) => item?.id || item?.blockID);
  return operation?.id || operation?.blockID || "";
}

module.exports = TimeListPlugin;
