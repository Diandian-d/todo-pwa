/**
 * notifications.js - 浏览器通知提醒
 */

const Notifications = {
  checkInterval: null,

  async requestPermission() {
    if (!('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
    return false;
  },

  async send(title, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    try {
      const notification = new Notification(title, {
        ...options,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: options.tag || 'todo-' + Date.now(),
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (e) {
      console.warn('Notification error:', e);
    }
  },

  startChecking() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(() => this.checkDueTasks(), 60000); // every minute
    this.checkDueTasks(); // check immediately
  },

  stopChecking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  },

  async checkDueTasks() {
    const enabled = await getMeta('notifications');
    if (!enabled) return;

    const now = new Date();
    const tasks = await getAllTasks();

    for (const task of tasks) {
      if (task.done || !task.dueDate) continue;

      const dueDate = new Date(task.dueDate);
      if (task.dueTime) {
        const [hours, minutes] = task.dueTime.split(':');
        dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }

      const diff = dueDate - now;
      // Notify if due within 5 minutes and not yet notified
      if (diff > 0 && diff <= 300000) {
        const notifKey = 'notif-' + task.id;
        const alreadyNotified = await getMeta(notifKey);
        if (!alreadyNotified) {
          const mins = Math.ceil(diff / 60000);
          await this.send('待办提醒', {
            body: `"${task.title}" 将在 ${mins} 分钟后到期`,
            tag: notifKey,
          });
          await setMeta(notifKey, true);
        }
      }

      // Overdue notification
      if (diff < 0 && diff > -3600000) { // within 1 hour overdue
        const overdueKey = 'overdue-' + task.id;
        const alreadyNotified = await getMeta(overdueKey);
        if (!alreadyNotified) {
          await this.send('任务已过期', {
            body: `"${task.title}" 已过期`,
            tag: overdueKey,
          });
          await setMeta(overdueKey, true);
        }
      }
    }
  },
};
