import initialFactors from './initialFactors.json';

/**
 * DataManager V2.0
 * 支持数据存储位置切换：Data Folder (Persist) vs Browser (Session)
 */

const FILES = {
  ALGO: 'data/algo_factors.json',
  USER: 'data/user_profile.json'
};

const STORAGE_KEYS = {
  PREF: 'fund_quant_storage_pref', // 存储用户的偏好
  BROWSER_USER: 'browser_session_user_data'
};

class DataManager {
  constructor() {
    this.storageMode = localStorage.getItem(STORAGE_KEYS.PREF) || 'data'; // 'data' | 'browser'
    this.initFileSystem();
  }

  setStorageMode(mode) {
    this.storageMode = mode;
    localStorage.setItem(STORAGE_KEYS.PREF, mode);
    console.log(`[Storage] Switched to ${mode} mode`);
  }

  getStorageMode() {
    return this.storageMode;
  }

  initFileSystem() {
    // 1. 算法数据 (始终在 data/ 中，因为它是核心资产)
    if (!localStorage.getItem(FILES.ALGO)) {
      localStorage.setItem(FILES.ALGO, JSON.stringify(initialFactors));
    }
    // 2. 用户数据 (Data 模式初始)
    if (!localStorage.getItem(FILES.USER)) {
      localStorage.setItem(FILES.USER, JSON.stringify({ portfolio: [], watchlist: [] }));
    }
  }

  // --- 算法数据 (始终持久化) ---
  getAlgoData() {
    try {
      return JSON.parse(localStorage.getItem(FILES.ALGO)) || {};
    } catch { return {}; }
  }

  saveAlgoData(factors) {
    localStorage.setItem(FILES.ALGO, JSON.stringify(factors));
  }

  // --- 用户数据 (受 Storage Mode 影响) ---
  getUserData() {
    try {
      let raw;
      if (this.storageMode === 'browser') {
        raw = sessionStorage.getItem(STORAGE_KEYS.BROWSER_USER);
        // 如果 Session 空，尝试从 Local 读取一次作为初始
        if (!raw) raw = localStorage.getItem(FILES.USER);
      } else {
        raw = localStorage.getItem(FILES.USER);
      }
      return raw ? JSON.parse(raw) : { portfolio: [], watchlist: [], transactions: [], aiConfig: {} };
    } catch { 
      return { portfolio: [], watchlist: [], transactions: [], aiConfig: {} }; 
    }
  }

  saveUserData(data) {
    const str = JSON.stringify(data);
    if (this.storageMode === 'browser') {
      sessionStorage.setItem(STORAGE_KEYS.BROWSER_USER, str);
    } else {
      localStorage.setItem(FILES.USER, str);
    }
  }

  exportFile(type) {
    const key = type === 'algo' ? FILES.ALGO : (this.storageMode === 'browser' ? STORAGE_KEYS.BROWSER_USER : FILES.USER);
    const dataStr = (type === 'algo' ? localStorage : (this.storageMode === 'browser' ? sessionStorage : localStorage)).getItem(key);
    
    if (!dataStr) return alert("没有数据可导出");

    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'algo' ? 'algo_factors.json' : 'user_data_backup.json';
    a.click();
  }
}

export const dataManager = new DataManager();