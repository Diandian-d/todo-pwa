/**
 * db.js - IndexedDB 数据层
 * 封装任务、子任务、标签的增删改查
 */

const DB_NAME = 'TodoPWA';
const DB_VERSION = 1;
const STORE_TASKS = 'tasks';
const STORE_TAGS = 'tags';
const STORE_META = 'meta';

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Tasks store
      if (!database.objectStoreNames.contains(STORE_TASKS)) {
        const taskStore = database.createObjectStore(STORE_TASKS, { keyPath: 'id' });
        taskStore.createIndex('order', 'order', { unique: false });
        taskStore.createIndex('done', 'done', { unique: false });
        taskStore.createIndex('dueDate', 'dueDate', { unique: false });
        taskStore.createIndex('priority', 'priority', { unique: false });
      }

      // Tags store
      if (!database.objectStoreNames.contains(STORE_TAGS)) {
        const tagStore = database.createObjectStore(STORE_TAGS, { keyPath: 'id' });
        tagStore.createIndex('name', 'name', { unique: false });
      }

      // Meta store (for settings, order, etc.)
      if (!database.objectStoreNames.contains(STORE_META)) {
        database.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
  });
}

function tx(storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ===== Default tags =====
const DEFAULT_TAGS = [
  { id: 'tag-work', name: '工作', color: '#6750A4' },
  { id: 'tag-life', name: '生活', color: '#006495' },
  { id: 'tag-study', name: '学习', color: '#006A6A' },
  { id: 'tag-health', name: '健康', color: '#BC4D00' },
];

async function initDefaultData() {
  const existing = await getAllTags();
  if (existing.length === 0) {
    for (const tag of DEFAULT_TAGS) {
      await saveTag(tag);
    }
  }
}

// ===== Task CRUD =====

async function getAllTasks() {
  const store = tx(STORE_TASKS);
  const index = store.index('order');
  return promisifyRequest(index.getAll());
}

async function getTask(id) {
  return promisifyRequest(tx(STORE_TASKS).get(id));
}

async function saveTask(task) {
  if (!task.id) {
    task.id = 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
  if (!task.createdAt) {
    task.createdAt = new Date().toISOString();
  }
  task.updatedAt = new Date().toISOString();

  const store = tx(STORE_TASKS, 'readwrite');
  await promisifyRequest(store.put(task));
  return task;
}

async function deleteTask(id) {
  const store = tx(STORE_TASKS, 'readwrite');
  return promisifyRequest(store.delete(id));
}

async function deleteTasks(ids) {
  const store = tx(STORE_TASKS, 'readwrite');
  const promises = ids.map(id => promisifyRequest(store.delete(id)));
  await Promise.all(promises);
}

async function getNextOrder() {
  const tasks = await getAllTasks();
  if (tasks.length === 0) return 0;
  return Math.max(...tasks.map(t => t.order || 0)) + 1;
}

// ===== Tag CRUD =====

async function getAllTags() {
  return promisifyRequest(tx(STORE_TAGS).getAll());
}

async function saveTag(tag) {
  if (!tag.id) {
    tag.id = 'tag-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
  const store = tx(STORE_TAGS, 'readwrite');
  await promisifyRequest(store.put(tag));
  return tag;
}

async function deleteTag(id) {
  const store = tx(STORE_TAGS, 'readwrite');
  return promisifyRequest(store.delete(id));
}

// ===== Meta (settings) =====

async function getMeta(key) {
  const result = await promisifyRequest(tx(STORE_META).get(key));
  return result ? result.value : null;
}

async function setMeta(key, value) {
  const store = tx(STORE_META, 'readwrite');
  await promisifyRequest(store.put({ key, value }));
}

// ===== Bulk operations =====

async function clearAllData() {
  const tasks = await getAllTasks();
  const tags = await getAllTags();
  const taskIds = tasks.map(t => t.id);
  await deleteTasks(taskIds);
  const tagIds = tags.map(t => t.id);
  const tagStore = tx(STORE_TAGS, 'readwrite');
  await Promise.all(tagIds.map(id => promisifyRequest(tagStore.delete(id))));
}

async function exportAllData() {
  const tasks = await getAllTasks();
  const tags = await getAllTags();
  return { tasks, tags, exportedAt: new Date().toISOString(), version: DB_VERSION };
}

async function importAllData(data) {
  if (!data || !data.tasks || !data.tags) {
    throw new Error('Invalid data format');
  }
  await clearAllData();
  const taskStore = tx(STORE_TASKS, 'readwrite');
  for (const task of data.tasks) {
    await promisifyRequest(taskStore.put(task));
  }
  const tagStore = tx(STORE_TAGS, 'readwrite');
  for (const tag of data.tags) {
    await promisifyRequest(tagStore.put(tag));
  }
}

// Initialize
const dbReady = openDB().then(() => initDefaultData());
