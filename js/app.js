/**
 * app.js - 主应用入口和全局逻辑
 */

const App = {
  async init() {
    await dbReady;
    await UI.init();
    await this.loadSettings();
    this.registerServiceWorker();
    Notifications.startChecking();

    // Set default date to today in modal
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('taskDueDate').min = today;

    console.log('Todo PWA initialized');
  },

  // ===== Theme =====
  async loadSettings() {
    const theme = await getMeta('theme') || 'auto';
    this.setTheme(theme);

    const accent = await getMeta('accentColor') || '#6750A4';
    this.setAccentColor(accent);

    const notifications = await getMeta('notifications');
    document.getElementById('notifToggle').checked = notifications === true;
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    setMeta('theme', theme);

    // Update segmented control
    document.querySelectorAll('#settingTheme .segmented-control button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    // Update meta theme-color
    this.updateThemeColor();
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'auto';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let isDark = current === 'dark' || (current === 'auto' && prefersDark);
    this.setTheme(isDark ? 'light' : 'dark');
  },

  setAccentColor(color) {
    // Convert hex to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Set as CSS variable
    document.documentElement.style.setProperty('--md-primary', color);

    // Generate lighter/darker variants
    const lightContainer = this.lightenColor(color, 0.7);
    document.documentElement.style.setProperty('--md-primary-container', lightContainer);

    const onContainer = this.darkenColor(color, 0.8);
    document.documentElement.style.setProperty('--md-on-primary-container', onContainer);

    // on-primary: white or dark depending on luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    document.documentElement.style.setProperty('--md-on-primary', luminance > 0.5 ? '#000000' : '#FFFFFF');

    setMeta('accentColor', color);

    // Update active dot
    document.querySelectorAll('#settingAccent .color-dot').forEach(dot => {
      dot.classList.toggle('active', dot.dataset.accent === color);
    });

    this.updateThemeColor();

    // Re-render charts
    if (UI.currentView === 'stats') Stats.render();
  },

  lightenColor(hex, amount) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + Math.round(255 * amount));
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + Math.round(255 * amount));
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + Math.round(255 * amount));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  },

  darkenColor(hex, amount) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - Math.round(255 * amount));
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - Math.round(255 * amount));
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - Math.round(255 * amount));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  },

  updateThemeColor() {
    const theme = document.documentElement.getAttribute('data-theme') || 'auto';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--md-primary').trim();
    const bgColor = isDark ? '#1C1B1F' : accent;

    const metaLight = document.querySelector('meta[name="theme-color"][media*="light"]');
    const metaDark = document.querySelector('meta[name="theme-color"][media*="dark"]');

    if (metaLight) metaLight.setAttribute('content', accent);
    if (metaDark) metaDark.setAttribute('content', isDark ? '#1C1B1F' : accent);
  },

  // ===== Service Worker =====
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('sw.js');
        console.log('SW registered');
      } catch (e) {
        console.warn('SW registration failed:', e);
      }
    }
  },
};

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const theme = document.documentElement.getAttribute('data-theme') || 'auto';
  if (theme === 'auto') {
    App.updateThemeColor();
  }
});

// Start app
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Prevent pull-to-refresh on mobile
document.body.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) return;
  const main = document.getElementById('mainContent');
  if (main.scrollTop === 0 && e.touches[0].clientY > 0) {
    // allow normal scroll
  }
}, { passive: true });
