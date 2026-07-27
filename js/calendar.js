/**
 * calendar.js - 日历视图
 */

const Calendar = {
  current: new Date(),
  selectedDate: null,

  render() {
    const year = this.current.getFullYear();
    const month = this.current.getMonth();
    const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    document.getElementById('calendarTitle').textContent = `${year}年${monthNames[month]}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const today = new Date();
    const todayStr = today.toDateString();

    let html = '';

    // Previous month days
    for (let i = startWeekday - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      html += `<div class="cal-day other-month">${day}</div>`;
    }

    // Current month days
    const tasksByDate = this.getTasksByDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toDateString();
      const isToday = dateStr === todayStr;
      const isSelected = this.selectedDate && dateStr === this.selectedDate.toDateString();
      const dayTasks = tasksByDate[dateStr] || [];
      const maxDots = Math.min(dayTasks.length, 3);
      let dotsHtml = '';
      for (let i = 0; i < maxDots; i++) {
        dotsHtml += '<span class="cal-day-dot"></span>';
      }

      html += `<div class="cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" onclick="Calendar.selectDate(${year}, ${month}, ${day})">
        ${day}
        ${dotsHtml ? `<div class="cal-day-dots">${dotsHtml}</div>` : ''}
      </div>`;
    }

    // Next month days to fill grid
    const totalCells = startWeekday + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      html += `<div class="cal-day other-month">${day}</div>`;
    }

    document.getElementById('calendarGrid').innerHTML = html;

    // Render selected day tasks
    this.renderSelectedDayTasks();
  },

  getTasksByDate() {
    const map = {};
    UI.tasks.forEach(task => {
      if (task.dueDate) {
        const dateStr = new Date(task.dueDate).toDateString();
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(task);
      }
    });
    return map;
  },

  selectDate(year, month, day) {
    this.selectedDate = new Date(year, month, day);
    this.render();
  },

  renderSelectedDayTasks() {
    const titleEl = document.getElementById('calendarDayTitle');
    const listEl = document.getElementById('calendarTaskList');

    if (!this.selectedDate) {
      titleEl.textContent = '选择日期查看任务';
      listEl.innerHTML = '';
      return;
    }

    const dateStr = this.selectedDate.toDateString();
    const today = new Date().toDateString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let label = '';
    if (dateStr === today) label = '今天';
    else if (dateStr === tomorrow.toDateString()) label = '明天';
    else if (dateStr === yesterday.toDateString()) label = '昨天';
    else label = `${this.selectedDate.getMonth()+1}月${this.selectedDate.getDate()}日`;

    titleEl.textContent = label;

    const tasksByDate = this.getTasksByDate();
    const dayTasks = tasksByDate[dateStr] || [];

    if (dayTasks.length === 0) {
      listEl.innerHTML = '<p style="color:var(--md-outline);font-size:14px;padding:16px 0;text-align:center">当天没有任务</p>';
      return;
    }

    // Sort: undone first, then by priority
    dayTasks.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (b.priority || 0) - (a.priority || 0);
    });

    listEl.innerHTML = dayTasks.map(t => UI.taskItemHTML(t)).join('');
  },

  prevMonth() {
    this.current.setMonth(this.current.getMonth() - 1);
    this.render();
  },

  nextMonth() {
    this.current.setMonth(this.current.getMonth() + 1);
    this.render();
  },
};
