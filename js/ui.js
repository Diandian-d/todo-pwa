/**
 * ui.js - UI 渲染和交互
 */

const UI = {
  currentView: 'tasks',
  currentFilter: 'all',
  tasks: [],
  tags: [],
  editingTaskId: null,
  selectedTags: new Set(),
  subtasks: [],
  searchQuery: '',
  swipeStartX: 0,
  swipedItem: null,

  // ===== Init =====
  async init() {
    this.bindEvents();
    await this.refresh();
    this.updateProgress();
  },

  async refresh() {
    this.tasks = await getAllTasks();
    this.tags = await getAllTags();
    this.renderTasks();
    if (this.currentView === 'calendar') Calendar.render();
    if (this.currentView === 'stats') Stats.render();
  },

  // ===== Navigation =====
  switchView(view) {
    this.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view' + view.charAt(0).toUpperCase() + view.slice(1)).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-view="${view}"]`).classList.add('active');

    const titles = { tasks: this.filterLabels[this.currentFilter], calendar: '日历', stats: '统计', settings: '设置' };
    document.getElementById('pageTitle').textContent = titles[view];

    const fab = document.getElementById('fabAdd');
    if (view === 'tasks') {
      fab.style.display = 'flex';
    } else {
      fab.style.display = 'none';
    }

    if (view === 'calendar') Calendar.render();
    if (view === 'stats') Stats.render();
  },

  // ===== Task Rendering =====
  getFilteredTasks() {
    let tasks = [...this.tasks];

    // Filter
    if (this.currentFilter === 'today') {
      const today = new Date().toDateString();
      tasks = tasks.filter(t => {
        if (t.done) return false;
        if (t.dueDate) return new Date(t.dueDate).toDateString() === today;
        return false;
      });
    } else if (this.currentFilter === 'week') {
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + 7);
      tasks = tasks.filter(t => {
        if (t.done) return false;
        if (t.dueDate) {
          const d = new Date(t.dueDate);
          return d >= now && d <= weekEnd;
        }
        return false;
      });
    } else if (this.currentFilter === 'important') {
      tasks = tasks.filter(t => !t.done && t.priority === 2);
    } else if (this.currentFilter === 'done') {
      tasks = tasks.filter(t => t.done);
    } else {
      // all - show non-done first, then done
      tasks = tasks.filter(t => !t.done || this.currentFilter === 'all');
    }

    // Search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.tags && t.tags.some(tagId => {
          const tag = this.tags.find(tg => tg.id === tagId);
          return tag && tag.name.toLowerCase().includes(q);
        }))
      );
    }

    // Sort: done at bottom, then by order
    tasks.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.order || 0) - (b.order || 0);
    });

    return tasks;
  },

  renderTasks() {
    const list = document.getElementById('taskList');
    const empty = document.getElementById('emptyState');
    const tasks = this.getFilteredTasks();

    if (tasks.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = tasks.map(t => this.taskItemHTML(t)).join('');
    this.bindSwipeEvents();
  },

  taskItemHTML(task) {
    const isOverdue = !task.done && task.dueDate && new Date(task.dueDate) < new Date();
    const tags = (task.tags || []).map(tagId => {
      const tag = this.tags.find(tg => tg.id === tagId);
      return tag ? `<span class="task-tag">${this.escapeHtml(tag.name)}</span>` : '';
    }).join('');

    let dueText = '';
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      const now = new Date();
      const diffDays = Math.floor((d.setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
      if (diffDays === 0) dueText = '今天';
      else if (diffDays === 1) dueText = '明天';
      else if (diffDays === -1) dueText = '昨天';
      else if (diffDays < 0) dueText = `${Math.abs(diffDays)}天前`;
      else if (diffDays < 7) dueText = `${diffDays}天后`;
      else dueText = `${d.getMonth()+1}月${d.getDate()}日`;

      if (task.dueTime) {
        dueText += ` ${task.dueTime}`;
      }
    }

    let subtaskSummary = '';
    if (task.subtasks && task.subtasks.length > 0) {
      const done = task.subtasks.filter(st => st.done).length;
      subtaskSummary = `<span class="task-subtask-summary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        ${done}/${task.subtasks.length}
      </span>`;
    }

    const taskContent = `
      <div class="task-item ${task.done ? 'done' : ''} ${isOverdue ? 'overdue' : ''}" data-id="${task.id}" data-priority="${task.priority || 0}">
        <div class="task-checkbox ${task.done ? 'checked' : ''}" onclick="UI.toggleTask('${task.id}', event)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="task-content" onclick="UI.openEditModal('${task.id}')">
          <div class="task-title">${this.escapeHtml(task.title)}</div>
          ${task.description ? `<div class="task-desc">${this.escapeHtml(task.description)}</div>` : ''}
          ${tags || dueText || subtaskSummary ? `<div class="task-meta">${tags}${dueText ? `<span class="task-due ${isOverdue ? 'overdue' : ''}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${dueText}
          </span>` : ''}${subtaskSummary}</div>` : ''}
        </div>
      </div>
    `;

    return `
      <div class="task-swipe-wrapper" data-id="${task.id}">
        <button class="task-swipe-delete" onclick="UI.deleteTaskById('${task.id}')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          删除
        </button>
        ${taskContent}
      </div>
    `;
  },

  async toggleTask(id, event) {
    if (event) event.stopPropagation();
    // Close any open swipe first
    this.closeAllSwipes();
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    task.done = !task.done;
    if (task.done) {
      task.completedAt = new Date().toISOString();
    } else {
      delete task.completedAt;
    }
    await saveTask(task);
    this.renderTasks();
    this.updateProgress();
    if (this.currentView === 'calendar') Calendar.render();
    if (this.currentView === 'stats') Stats.render();
    this.showToast(task.done ? '已完成' : '已恢复');
  },

  // ===== Swipe to Delete =====
  bindSwipeEvents() {
    const wrappers = document.querySelectorAll('.task-swipe-wrapper');
    wrappers.forEach(wrapper => {
      const item = wrapper.querySelector('.task-item');
      let startX = 0;
      let currentX = 0;
      let isDragging = false;
      let isOpen = false;

      const start = (x) => {
        // Close other open swipes
        UI.closeAllSwipes(wrapper);
        startX = x;
        currentX = isOpen ? -80 : 0;
        isDragging = true;
        item.style.transition = 'none';
      };

      const move = (x) => {
        if (!isDragging) return;
        let diff = x - startX;
        let newX = currentX + diff;
        // Only allow left swipe (negative)
        if (newX > 0) newX = 0;
        // Max swipe
        if (newX < -80) newX = -80;
        item.style.transform = `translateX(${newX}px)`;
      };

      const end = (x) => {
        if (!isDragging) return;
        isDragging = false;
        item.style.transition = 'transform 0.2s ease';
        let diff = x - startX;
        let finalX = currentX + diff;
        // If swiped more than halfway, keep open
        if (finalX < -40) {
          item.style.transform = 'translateX(-80px)';
          isOpen = true;
          wrapper._swipeOpen = true;
        } else {
          item.style.transform = 'translateX(0)';
          isOpen = false;
          wrapper._swipeOpen = false;
        }
      };

      // Touch events
      item.addEventListener('touchstart', (e) => {
        start(e.touches[0].clientX);
      }, { passive: true });

      item.addEventListener('touchmove', (e) => {
        move(e.touches[0].clientX);
      }, { passive: true });

      item.addEventListener('touchend', (e) => {
        end(e.changedTouches[0].clientX);
      }, { passive: true });
    });
  },

  closeAllSwipes(except) {
    document.querySelectorAll('.task-swipe-wrapper').forEach(w => {
      if (w === except) return;
      const item = w.querySelector('.task-item');
      if (item) {
        item.style.transition = 'transform 0.2s ease';
        item.style.transform = 'translateX(0)';
      }
      w._swipeOpen = false;
    });
  },

  async deleteTaskById(id) {
    if (!confirm('确定删除这个任务吗？')) return;
    await deleteTask(id);
    await this.refresh();
    this.updateProgress();
    this.showToast('已删除');
  },

  // ===== Filter Tabs (Right-swipe to switch categories) =====
  filters: ['all', 'today', 'week', 'important', 'done'],
  filterLabels: { all: '全部', today: '今天', week: '本周', important: '重要', done: '已完成' },

  switchFilter(filter) {
    this.currentFilter = filter;
    // Update tab UI
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    // Update title
    if (this.currentView === 'tasks') {
      document.getElementById('pageTitle').textContent = this.filterLabels[filter];
    }
    this.renderTasks();
  },

  bindFilterSwipe() {
    const taskView = document.getElementById('viewTasks');
    let startX = 0;
    let startY = 0;
    let isHorizontal = false;
    let isTracking = false;

    taskView.addEventListener('touchstart', (e) => {
      // Only track swipes on the view background, not on task items
      const target = e.target.closest('.task-swipe-wrapper, .filter-tab, .task-item, .icon-btn, .fab');
      if (target) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isTracking = true;
      isHorizontal = false;
    }, { passive: true });

    taskView.addEventListener('touchmove', (e) => {
      if (!isTracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!isHorizontal) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20) {
          isHorizontal = true;
        } else if (Math.abs(dy) > 20) {
          isTracking = false;
        }
      }
    }, { passive: true });

    taskView.addEventListener('touchend', (e) => {
      if (!isTracking || !isHorizontal) {
        isTracking = false;
        return;
      }
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 60) {
        const currentIdx = this.filters.indexOf(this.currentFilter);
        let newIdx;
        if (dx > 0) {
          // Right swipe: previous filter
          newIdx = currentIdx - 1;
          if (newIdx < 0) newIdx = this.filters.length - 1;
        } else {
          // Left swipe: next filter
          newIdx = currentIdx + 1;
          if (newIdx >= this.filters.length) newIdx = 0;
        }
        this.switchFilter(this.filters[newIdx]);
        this.showToast(this.filterLabels[this.filters[newIdx]]);
      }
      isTracking = false;
    }, { passive: true });

    // Also bind tab clicks
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.onclick = () => this.switchFilter(tab.dataset.filter);
    });
  },

  // ===== Modal =====
  openNewModal() {
    this.editingTaskId = null;
    this.selectedTags = new Set();
    this.subtasks = [];
    document.getElementById('modalTitle').textContent = '新建任务';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDesc').value = '';
    document.getElementById('taskDueDate').value = '';
    document.getElementById('taskDueTime').value = '';
    document.querySelectorAll('#taskModal .segmented-control button[data-priority]').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
    });
    this.renderTagSelector();
    this.renderSubtasks();
    document.getElementById('taskModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('taskTitle').focus(), 300);
  },

  openEditModal(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    this.editingTaskId = id;
    this.selectedTags = new Set(task.tags || []);
    this.subtasks = [...(task.subtasks || [])];

    document.getElementById('modalTitle').textContent = '编辑任务';
    document.getElementById('taskTitle').value = task.title || '';
    document.getElementById('taskDesc').value = task.description || '';

    if (task.dueDate) {
      const d = new Date(task.dueDate);
      document.getElementById('taskDueDate').value = d.toISOString().split('T')[0];
      document.getElementById('taskDueTime').value = task.dueTime || '';
    } else {
      document.getElementById('taskDueDate').value = '';
      document.getElementById('taskDueTime').value = '';
    }

    document.querySelectorAll('#taskModal .segmented-control button[data-priority]').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.priority) === (task.priority || 0));
    });

    this.renderTagSelector();
    this.renderSubtasks();
    document.getElementById('taskModal').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('taskModal').classList.add('hidden');
  },

  async saveTaskFromModal() {
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) {
      this.showToast('请输入任务标题');
      return;
    }

    const desc = document.getElementById('taskDesc').value.trim();
    const dueDate = document.getElementById('taskDueDate').value;
    const dueTime = document.getElementById('taskDueTime').value;
    const priority = parseInt(document.querySelector('#taskModal .segmented-control button[data-priority].active').dataset.priority);

    let task;
    if (this.editingTaskId) {
      task = this.tasks.find(t => t.id === this.editingTaskId);
    } else {
      task = { done: false, order: await getNextOrder() };
    }

    task.title = title;
    task.description = desc;
    task.dueDate = dueDate ? new Date(dueDate + 'T00:00:00').toISOString() : null;
    task.dueTime = dueTime || null;
    task.priority = priority;
    task.tags = Array.from(this.selectedTags);
    task.subtasks = this.subtasks;

    await saveTask(task);
    this.closeModal();
    await this.refresh();
    this.updateProgress();
    this.showToast(this.editingTaskId ? '已保存' : '已添加');
  },

  // ===== Tags =====
  renderTagSelector() {
    const container = document.getElementById('tagSelector');
    container.innerHTML = this.tags.map(tag => `
      <button class="tag-chip ${this.selectedTags.has(tag.id) ? 'selected' : ''}" data-tag-id="${tag.id}">
        ${this.escapeHtml(tag.name)}
      </button>
    `).join('');
    container.querySelectorAll('.tag-chip').forEach(chip => {
      chip.onclick = () => {
        const id = chip.dataset.tagId;
        if (this.selectedTags.has(id)) {
          this.selectedTags.delete(id);
        } else {
          this.selectedTags.add(id);
        }
        this.renderTagSelector();
      };
    });
  },

  async addTag() {
    const input = document.getElementById('newTagInput');
    const name = input.value.trim();
    if (!name) return;
    const tag = await saveTag({ name, color: '#6750A4' });
    this.tags.push(tag);
    this.selectedTags.add(tag.id);
    input.value = '';
    this.renderTagSelector();
  },

  // ===== Subtasks =====
  renderSubtasks() {
    const container = document.getElementById('subtaskList');
    if (this.subtasks.length === 0) {
      container.innerHTML = '<p style="color:var(--md-outline);font-size:13px;padding:8px 0">暂无子任务</p>';
      return;
    }
    container.innerHTML = this.subtasks.map((st, i) => `
      <div class="subtask-item ${st.done ? 'done' : ''}">
        <div class="subtask-checkbox ${st.done ? 'checked' : ''}" onclick="UI.toggleSubtask(${i})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span class="subtask-title">${this.escapeHtml(st.title)}</span>
        <button class="subtask-delete" onclick="UI.deleteSubtask(${i})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `).join('');
  },

  addSubtask() {
    const input = document.getElementById('newSubtaskInput');
    const title = input.value.trim();
    if (!title) return;
    this.subtasks.push({ title, done: false });
    input.value = '';
    this.renderSubtasks();
  },

  toggleSubtask(index) {
    this.subtasks[index].done = !this.subtasks[index].done;
    this.renderSubtasks();
  },

  deleteSubtask(index) {
    this.subtasks.splice(index, 1);
    this.renderSubtasks();
  },

  // ===== Progress =====
  updateProgress() {
    const today = new Date().toDateString();
    const todayTasks = this.tasks.filter(t => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate).toDateString() === today;
    });
    const done = todayTasks.filter(t => t.done).length;
    const total = todayTasks.length;
    const rate = total > 0 ? (done / total * 100) : 0;
    document.getElementById('progressBarFill').style.width = rate + '%';
    document.getElementById('progressText').textContent = `今日 ${done}/${total}`;
  },

  // ===== Toast =====
  showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 2000);
  },

  // ===== Search =====
  toggleSearch() {
    const box = document.getElementById('searchBox');
    if (box.classList.contains('hidden')) {
      box.classList.remove('hidden');
      document.getElementById('searchInput').focus();
    } else {
      box.classList.add('hidden');
      document.getElementById('searchInput').value = '';
      this.searchQuery = '';
      this.renderTasks();
    }
  },

  // ===== Events =====
  bindEvents() {
    // Nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.onclick = () => this.switchView(btn.dataset.view);
    });

    // FAB
    document.getElementById('fabAdd').onclick = () => this.openNewModal();

    // Filter swipe (right-swipe to switch categories)
    this.bindFilterSwipe();

    // Modal
    document.getElementById('modalCancel').onclick = () => this.closeModal();
    document.getElementById('modalSave').onclick = () => this.saveTaskFromModal();
    document.getElementById('taskModal').onclick = (e) => {
      if (e.target.id === 'taskModal') this.closeModal();
    };

    // Priority
    document.querySelectorAll('#taskModal .segmented-control button[data-priority]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#taskModal .segmented-control button[data-priority]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    // Clear date
    document.getElementById('clearDate').onclick = () => {
      document.getElementById('taskDueDate').value = '';
      document.getElementById('taskDueTime').value = '';
    };

    // Tags
    document.getElementById('addTagBtn').onclick = () => this.addTag();
    document.getElementById('newTagInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addTag();
    });

    // Subtasks
    document.getElementById('addSubtaskBtn').onclick = () => this.addSubtask();
    document.getElementById('newSubtaskInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addSubtask();
    });

    // Search
    document.getElementById('searchBtn').onclick = () => this.toggleSearch();
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderTasks();
    });
    document.getElementById('clearSearchBtn').onclick = () => {
      document.getElementById('searchInput').value = '';
      this.searchQuery = '';
      this.renderTasks();
    };

    // Theme toggle
    document.getElementById('themeToggleBtn').onclick = () => App.toggleTheme();

    // Settings
    this.bindSettings();

    // Calendar events
    document.getElementById('prevMonth').onclick = () => Calendar.prevMonth();
    document.getElementById('nextMonth').onclick = () => Calendar.nextMonth();
  },

  bindSettings() {
    // Theme
    document.querySelectorAll('#settingTheme .segmented-control button').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#settingTheme .segmented-control button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        App.setTheme(btn.dataset.theme);
      };
    });

    // Accent color
    document.querySelectorAll('#settingAccent .color-dot').forEach(dot => {
      dot.onclick = () => {
        document.querySelectorAll('#settingAccent .color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        App.setAccentColor(dot.dataset.accent);
      };
    });

    // Notification toggle
    document.getElementById('notifToggle').onchange = (e) => {
      if (e.target.checked) {
        Notifications.requestPermission().then(granted => {
          if (!granted) {
            e.target.checked = false;
            this.showToast('通知权限被拒绝');
          } else {
            setMeta('notifications', true);
            this.showToast('通知已开启');
          }
        });
      } else {
        setMeta('notifications', false);
        this.showToast('通知已关闭');
      }
    };

    // Export
    document.getElementById('exportData').onclick = async () => {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `todo-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('数据已导出');
    };

    // Import
    document.getElementById('importData').onclick = () => {
      document.getElementById('importFileInput').click();
    };
    document.getElementById('importFileInput').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        await importAllData(data);
        await this.refresh();
        this.updateProgress();
        this.showToast('数据已导入');
      } catch (err) {
        this.showToast('导入失败：文件格式错误');
      }
      e.target.value = '';
    };

    // Clear data
    document.getElementById('clearData').onclick = async () => {
      if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
        await clearAllData();
        await initDefaultData();
        await this.refresh();
        this.updateProgress();
        this.showToast('数据已清空');
      }
    };
  },

  // ===== Helpers =====
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
