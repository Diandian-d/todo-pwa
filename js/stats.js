/**
 * stats.js - 统计图表（Canvas 绘制）
 */

const Stats = {
  render() {
    this.renderOverview();
    this.renderWeekChart();
    this.renderPieChart();
    this.renderHeatmap();
  },

  renderOverview() {
    const tasks = UI.tasks;
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const pending = total - done;
    const rate = total > 0 ? Math.round(done / total * 100) : 0;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statDone').textContent = done;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statRate').textContent = rate + '%';
  },

  renderWeekChart() {
    const canvas = document.getElementById('weekChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 180 * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = 180;

    ctx.clearRect(0, 0, w, h);

    // Get last 7 days data
    const days = [];
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const dayTasks = UI.tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === dateStr);
      const doneCount = dayTasks.filter(t => t.done).length;
      days.push({ name: dayNames[d.getDay()], done: doneCount, total: dayTasks.length, date: d });
    }

    const padding = { top: 20, right: 16, bottom: 30, left: 16 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const barWidth = chartW / 7 * 0.6;
    const barGap = chartW / 7 * 0.4;

    const maxVal = Math.max(...days.map(d => d.total), 1);
    const scale = chartH / maxVal;

    // Get theme colors
    const styles = getComputedStyle(document.documentElement);
    const primaryColor = styles.getPropertyValue('--md-primary').trim();
    const primaryContainerColor = styles.getPropertyValue('--md-primary-container').trim();
    const outlineColor = styles.getPropertyValue('--md-outline-variant').trim();
    const onSurfaceVariant = styles.getPropertyValue('--md-on-surface-variant').trim();

    days.forEach((day, i) => {
      const x = padding.left + (chartW / 7) * i + barGap / 2;
      const barH = day.total * scale;
      const doneH = day.done * scale;
      const y = padding.top + chartH - barH;

      // Total bar (background)
      if (day.total > 0) {
        ctx.fillStyle = primaryContainerColor;
        ctx.beginPath();
        const radius = 4;
        const x2 = x + barWidth;
        const y2 = y + barH;
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x2 - radius, y);
        ctx.quadraticCurveTo(x2, y, x2, y + radius);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x, y2);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.fill();
      }

      // Done bar
      if (day.done > 0) {
        ctx.fillStyle = primaryColor;
        const doneY = padding.top + chartH - doneH;
        ctx.beginPath();
        ctx.moveTo(x + radius, doneY);
        ctx.lineTo(x2 - radius, doneY);
        ctx.quadraticCurveTo(x2, doneY, x2, doneY + radius);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x, y2);
        ctx.lineTo(x, doneY + radius);
        ctx.quadraticCurveTo(x, doneY, x + radius, doneY);
        ctx.fill();
      }

      // Day label
      ctx.fillStyle = onSurfaceVariant;
      ctx.font = '12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day.name, x + barWidth / 2, h - 10);

      // Count label
      if (day.total > 0) {
        ctx.fillStyle = onSurfaceVariant;
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText(`${day.done}/${day.total}`, x + barWidth / 2, y - 6);
      }
    });
  },

  renderPieChart() {
    const canvas = document.getElementById('pieChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 220 * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = 220;

    ctx.clearRect(0, 0, w, h);

    // Count tasks by tag
    const tagCounts = {};
    let untagged = 0;
    UI.tasks.forEach(task => {
      if (task.tags && task.tags.length > 0) {
        task.tags.forEach(tagId => {
          tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;
        });
      } else {
        untagged++;
      }
    });

    const segments = [];
    const colors = ['#6750A4', '#006495', '#006A6A', '#BC4D00', '#9C4146', '#7D5260', '#607D8B'];
    let colorIdx = 0;

    Object.entries(tagCounts).forEach(([tagId, count]) => {
      const tag = UI.tags.find(t => t.id === tagId);
      segments.push({
        label: tag ? tag.name : '未知',
        count,
        color: tag && tag.color ? tag.color : colors[colorIdx % colors.length]
      });
      colorIdx++;
    });

    if (untagged > 0) {
      segments.push({ label: '未分类', count: untagged, color: colors[colorIdx % colors.length] });
    }

    const total = segments.reduce((sum, s) => sum + s.count, 0);
    const legendEl = document.getElementById('pieLegend');

    if (total === 0) {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--md-outline').trim();
      ctx.font = '14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无数据', w / 2, h / 2);
      legendEl.innerHTML = '';
      return;
    }

    // Draw pie
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 20;

    let startAngle = -Math.PI / 2;

    segments.forEach(seg => {
      const angle = (seg.count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + angle);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      startAngle += angle;
    });

    // Inner circle (donut)
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--md-surface-container').trim();
    ctx.fill();

    // Center text
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--md-on-surface').trim();
    ctx.font = 'bold 24px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total, cx, cy - 8);
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--md-on-surface-variant').trim();
    ctx.fillText('总任务', cx, cy + 14);

    // Legend
    legendEl.innerHTML = segments.map(seg => `
      <div class="pie-legend-item">
        <div class="pie-legend-color" style="background:${seg.color}"></div>
        <span>${UI.escapeHtml(seg.label)} (${seg.count})</span>
      </div>
    `).join('');
  },

  renderHeatmap() {
    const container = document.getElementById('heatmapContainer');
    const today = new Date();
    const days = 365;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days + 1);

    // Count completions by date
    const completionMap = {};
    UI.tasks.forEach(task => {
      if (task.done && task.completedAt) {
        const dateStr = new Date(task.completedAt).toDateString();
        completionMap[dateStr] = (completionMap[dateStr] || 0) + 1;
      }
    });

    // Also count created tasks
    UI.tasks.forEach(task => {
      if (task.createdAt) {
        const dateStr = new Date(task.createdAt).toDateString();
        if (!completionMap[dateStr]) completionMap[dateStr] = 0;
        completionMap[dateStr] += 0.5; // creation counts half
      }
    });

    const maxCount = Math.max(...Object.values(completionMap), 1);
    let html = '<div class="heatmap-grid">';

    // Adjust start to Sunday
    const startDay = startDate.getDay();
    const adjustedStart = new Date(startDate);
    adjustedStart.setDate(adjustedStart.getDate() - startDay);

    for (let d = new Date(adjustedStart); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toDateString();
      const count = completionMap[dateStr] || 0;
      let level = 0;
      if (count > 0) {
        const ratio = count / maxCount;
        if (ratio > 0.75) level = 4;
        else if (ratio > 0.5) level = 3;
        else if (ratio > 0.25) level = 2;
        else level = 1;
      }
      const dateLabel = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      html += `<div class="heatmap-cell level-${level}" title="${dateLabel}: ${Math.floor(count)} 次活动"></div>`;
    }

    html += '</div>';
    container.innerHTML = html;
  },
};
