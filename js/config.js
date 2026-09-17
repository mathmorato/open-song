/**
 * Open Song - Configuração Centralizada
 * Versão: v.1.0.3
 * Define endpoints, URL do processador local e configurações padrão.
 */

const OPEN_SONG_CONFIG = {
    localProcessorUrl: "http://127.0.0.1:8765",
    healthEndpoint: "/health",
    separateEndpoint: "/separate",
    statusEndpoint: "/status",
    cancelEndpoint: "/cancel",
    stemsEndpoint: "/stems",
    downloadEndpoint: "/download",
    downloadZipEndpoint: "/download-zip",
    exportEndpoint: "/export",
    version: "v.1.0.3",
    apiVersion: "v1",
    supportedFormats: ["mp3", "wav", "flac", "ogg"],
    defaultModel: "htdemucs",
    defaultShifts: 1,
    defaultOverlap: 0.25,
    storageKeys: {
        settings: "open_song_settings",
        theme: "open_song_theme",
        history: "open_song_history"
    }
};

// Permite leitura de URL personalizada configurada pelo usuário no localStorage
(function initConfig() {
    try {
        const saved = localStorage.getItem(OPEN_SONG_CONFIG.storageKeys.settings);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.localProcessorUrl) {
                OPEN_SONG_CONFIG.localProcessorUrl = parsed.localProcessorUrl.replace(/\/+$/, "");
            }
            if (parsed.model) OPEN_SONG_CONFIG.defaultModel = parsed.model;
            if (parsed.shifts) OPEN_SONG_CONFIG.defaultShifts = parsed.shifts;
            if (parsed.overlap) OPEN_SONG_CONFIG.defaultOverlap = parsed.overlap;
        }
    } catch (e) {
        console.warn("Não foi possível carregar configurações personalizadas:", e);
    }
})();
