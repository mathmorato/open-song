/**
 * Open Song - API Client
 * Versão: v.1.0.0
 * Comunicação com o Open Song Local Processor via HTTP/REST com tratamento de CORS e erros de rede.
 */

const ApiClient = {
    getBaseUrl() {
        return OPEN_SONG_CONFIG.localProcessorUrl.replace(/\/+$/, "");
    },

    async checkHealth() {
        const url = `${this.getBaseUrl()}${OPEN_SONG_CONFIG.healthEndpoint}`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            const response = await fetch(url, {
                method: "GET",
                signal: controller.signal,
                headers: { "Accept": "application/json" }
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                return { ok: false, status: response.status, data: null };
            }
            const data = await response.json();
            return { ok: true, data };
        } catch (error) {
            return {
                ok: false,
                offline: true,
                error: error.name === "AbortError" ? "Tempo limite de conexão excedido" : error.message
            };
        }
    },

    async uploadAndSeparate(file, options = {}) {
        const url = `${this.getBaseUrl()}${OPEN_SONG_CONFIG.separateEndpoint}`;
        const formData = new FormData();
        formData.append("file", file);
        if (options.model) formData.append("model", options.model);
        if (options.shifts) formData.append("shifts", options.shifts);
        if (options.overlap) formData.append("overlap", options.overlap);

        try {
            const response = await fetch(url, {
                method: "POST",
                body: formData
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || `Erro do servidor (${response.status})`);
            }
            return data;
        } catch (error) {
            console.error("Erro na requisição de separação:", error);
            throw error;
        }
    },

    async getStatus(jobId) {
        const url = `${this.getBaseUrl()}${OPEN_SONG_CONFIG.statusEndpoint}/${jobId}`;
        try {
            const response = await fetch(url, {
                headers: { "Accept": "application/json" }
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || `Status HTTP ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error(`Erro ao consultar status do job ${jobId}:`, error);
            throw error;
        }
    },

    async cancelJob(jobId) {
        const url = `${this.getBaseUrl()}${OPEN_SONG_CONFIG.cancelEndpoint}/${jobId}`;
        try {
            const response = await fetch(url, { method: "POST" });
            return await response.json();
        } catch (error) {
            console.error(`Erro ao cancelar job ${jobId}:`, error);
            throw error;
        }
    },

    async getStems(jobId) {
        const url = `${this.getBaseUrl()}${OPEN_SONG_CONFIG.stemsEndpoint}/${jobId}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data.stems || [];
        } catch (error) {
            console.error(`Erro ao buscar stems do job ${jobId}:`, error);
            throw error;
        }
    },

    getStemAudioUrl(jobId, stemId, asAttachment = false) {
        const base = `${this.getBaseUrl()}${OPEN_SONG_CONFIG.downloadEndpoint}/${jobId}/${stemId}`;
        return asAttachment ? `${base}?attachment=1` : base;
    },

    getZipDownloadUrl(jobId, selectedStems = []) {
        let url = `${this.getBaseUrl()}${OPEN_SONG_CONFIG.downloadZipEndpoint}/${jobId}`;
        if (selectedStems && selectedStems.length > 0) {
            url += `?stems=${encodeURIComponent(selectedStems.join(","))}`;
        }
        return url;
    },

    async exportMix(jobId, mixSpec) {
        const url = `${this.getBaseUrl()}${OPEN_SONG_CONFIG.exportEndpoint}`;
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ job_id: jobId, mix: mixSpec })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Erro ao gerar mix");
            }
            return data;
        } catch (error) {
            console.error("Erro ao exportar mix:", error);
            throw error;
        }
    },

    getExportDownloadUrl(jobId) {
        return `${this.getBaseUrl()}/download-export/${jobId}`;
    }
};
