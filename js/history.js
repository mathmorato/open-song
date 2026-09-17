/**
 * Open Song - History Module
 * Versão: v.1.0.0
 * Armazena e exibe o histórico de músicas separadas localmente no navegador.
 */

const HistoryModule = {
    init(onLoadJobCallback) {
        this.onLoadJob = onLoadJobCallback;
        this.historyListEl = document.getElementById("historyList");
        this.btnClearEl = document.getElementById("btnClearHistory");

        if (this.btnClearEl) {
            this.btnClearEl.addEventListener("click", () => {
                StorageManager.clearHistory();
                this.renderHistory();
                UiManager.showToast("Histórico limpo.", "info");
            });
        }
    },

    saveJob(jobId, filename, stemsCount, durationStr = "") {
        const item = {
            job_id: jobId,
            filename: filename,
            date: new Date().toLocaleDateString("pt-BR"),
            time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            timestamp: Date.now(),
            stemsCount: stemsCount,
            duration: durationStr
        };
        StorageManager.addHistoryItem(item);
    },

    renderHistory() {
        if (!this.historyListEl) return;

        const items = StorageManager.getHistory();
        if (items.length === 0) {
            this.historyListEl.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">
                    <svg class="icon" style="width: 32px; height: 32px; margin-bottom: 0.5rem;"><use href="assets/icons/icons.svg#icon-clock"></use></svg>
                    <p>Nenhuma música separada no histórico recente.</p>
                </div>
            `;
            return;
        }

        this.historyListEl.innerHTML = items.map(item => `
            <div class="file-card" style="margin: 0 0 0.75rem 0; max-width: 100%;">
                <div class="file-info">
                    <div class="file-icon-box">
                        <svg class="icon"><use href="assets/icons/icons.svg#icon-music"></use></svg>
                    </div>
                    <div>
                        <div class="file-meta-name" title="${item.filename}">${item.filename}</div>
                        <div class="file-meta-sub">${item.date} às ${item.time} • ${item.stemsCount} stems</div>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button type="button" class="btn btn-outline btn-load-history" data-job="${item.job_id}" data-filename="${item.filename}" title="Carregar faixas">
                        Abrir
                    </button>
                    <button type="button" class="btn btn-icon btn-remove-history" data-job="${item.job_id}" title="Remover do histórico">
                        <svg class="icon"><use href="assets/icons/icons.svg#icon-trash"></use></svg>
                    </button>
                </div>
            </div>
        `).join("");

        // Binds dos botões
        this.historyListEl.querySelectorAll(".btn-load-history").forEach(btn => {
            btn.addEventListener("click", () => {
                const jobId = btn.dataset.job;
                const filename = btn.dataset.filename;
                if (this.onLoadJob) this.onLoadJob(jobId, filename);
            });
        });

        this.historyListEl.querySelectorAll(".btn-remove-history").forEach(btn => {
            btn.addEventListener("click", () => {
                const jobId = btn.dataset.job;
                StorageManager.removeHistoryItem(jobId);
                this.renderHistory();
            });
        });
    }
};
