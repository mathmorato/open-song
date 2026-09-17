/**
 * Open Song - Storage Manager
 * Versão: v.1.0.0
 * Gerenciamento de preferências, histórico e configurações locais.
 */

const StorageManager = {
    getSettings() {
        try {
            const raw = localStorage.getItem(OPEN_SONG_CONFIG.storageKeys.settings);
            return raw ? JSON.parse(raw) : {
                localProcessorUrl: OPEN_SONG_CONFIG.localProcessorUrl,
                model: OPEN_SONG_CONFIG.defaultModel,
                shifts: OPEN_SONG_CONFIG.defaultShifts,
                overlap: OPEN_SONG_CONFIG.defaultOverlap
            };
        } catch (e) {
            return {};
        }
    },

    saveSettings(settings) {
        try {
            localStorage.setItem(OPEN_SONG_CONFIG.storageKeys.settings, JSON.stringify(settings));
            if (settings.localProcessorUrl) {
                OPEN_SONG_CONFIG.localProcessorUrl = settings.localProcessorUrl.replace(/\/+$/, "");
            }
            return true;
        } catch (e) {
            console.error("Erro ao salvar configurações:", e);
            return false;
        }
    },

    getTheme() {
        return localStorage.getItem(OPEN_SONG_CONFIG.storageKeys.theme) || "dark";
    },

    setTheme(theme) {
        localStorage.setItem(OPEN_SONG_CONFIG.storageKeys.theme, theme);
        document.documentElement.setAttribute("data-theme", theme);
    },

    getHistory() {
        try {
            const raw = localStorage.getItem(OPEN_SONG_CONFIG.storageKeys.history);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    },

    addHistoryItem(item) {
        try {
            const history = this.getHistory();
            // Evita duplicatas pelo job_id
            const filtered = history.filter(h => h.job_id !== item.job_id);
            filtered.unshift(item);
            // Mantém até 30 registros
            const trimmed = filtered.slice(0, 30);
            localStorage.setItem(OPEN_SONG_CONFIG.storageKeys.history, JSON.stringify(trimmed));
        } catch (e) {
            console.warn("Erro ao salvar no histórico:", e);
        }
    },

    removeHistoryItem(jobId) {
        try {
            const history = this.getHistory().filter(h => h.job_id !== jobId);
            localStorage.setItem(OPEN_SONG_CONFIG.storageKeys.history, JSON.stringify(history));
            return history;
        } catch (e) {
            return [];
        }
    },

    clearHistory() {
        localStorage.removeItem(OPEN_SONG_CONFIG.storageKeys.history);
    }
};
