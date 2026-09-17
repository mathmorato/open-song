/**
 * Open Song - UI Manager
 * Versão: v.1.0.0
 * Gerencia estados da interface, transições de tela, notificações e modais.
 */

const UiState = {
    EMPTY: "EMPTY",
    READY: "READY",
    PROCESSING: "PROCESSING",
    COMPLETED: "COMPLETED",
    ERROR: "ERROR",
    CANCELLED: "CANCELLED"
};

const UiManager = {
    currentState: UiState.EMPTY,

    init() {
        this._setupTheme();
        this._setupModals();
        this.setConnectionStatus("checking");
    },

    setState(newState) {
        this.currentState = newState;
        const uploadHero = document.getElementById("uploadHero");
        const fileSelectedCard = document.getElementById("fileSelectedCard");
        const processingPanel = document.getElementById("processingPanel");
        const resultsSection = document.getElementById("resultsSection");
        const btnSeparate = document.getElementById("btnSeparate");

        // Oculta por padrão
        if (processingPanel) processingPanel.style.display = "none";
        if (resultsSection) resultsSection.style.display = "none";
        if (fileSelectedCard) fileSelectedCard.style.display = "none";

        switch (newState) {
            case UiState.EMPTY:
                if (uploadHero) uploadHero.style.display = "block";
                break;

            case UiState.READY:
                if (uploadHero) uploadHero.style.display = "block";
                if (fileSelectedCard) fileSelectedCard.style.display = "flex";
                if (btnSeparate) {
                    btnSeparate.disabled = false;
                    btnSeparate.innerHTML = `
                        <svg class="icon"><use href="assets/icons/icons.svg#icon-sliders"></use></svg>
                        Separar faixas
                    `;
                }
                break;

            case UiState.PROCESSING:
                if (uploadHero) uploadHero.style.display = "none";
                if (processingPanel) processingPanel.style.display = "block";
                if (btnSeparate) {
                    btnSeparate.disabled = true;
                    btnSeparate.textContent = "Separando sua música...";
                }
                break;

            case UiState.COMPLETED:
                if (uploadHero) uploadHero.style.display = "none";
                if (processingPanel) processingPanel.style.display = "none";
                if (resultsSection) resultsSection.style.display = "flex";
                break;

            case UiState.ERROR:
            case UiState.CANCELLED:
                if (uploadHero) uploadHero.style.display = "block";
                if (fileSelectedCard) fileSelectedCard.style.display = "flex";
                if (btnSeparate) {
                    btnSeparate.disabled = false;
                    btnSeparate.textContent = "Tentar novamente";
                }
                break;
        }
    },

    setConnectionStatus(status, details = null) {
        const badge = document.getElementById("processorBadge");
        const label = document.getElementById("processorStatusText");
        if (!badge || !label) return;

        badge.className = "processor-badge";

        if (status === "connected") {
            badge.classList.add("status-connected");
            label.textContent = "Processador conectado";
            badge.title = `Conectado a ${OPEN_SONG_CONFIG.localProcessorUrl} (${details?.version || "v.1.0.0"})`;
        } else if (status === "disconnected") {
            badge.classList.add("status-disconnected");
            label.textContent = "Processador desconectado";
            badge.title = "Clique para ver como instalar e iniciar o processador local";
        } else {
            badge.classList.add("status-checking");
            label.textContent = "Verificando...";
            badge.title = "Procurando processador local...";
        }
    },

    updateProgress(percent, message) {
        const bar = document.getElementById("progressBar");
        const pctEl = document.getElementById("progressPct");
        const statusEl = document.getElementById("progressStatus");

        if (bar) bar.style.width = `${percent}%`;
        if (pctEl) pctEl.textContent = `${percent}%`;
        if (statusEl && message) statusEl.textContent = message;
    },

    showToast(message, type = "info", duration = 3500) {
        const container = document.getElementById("toastContainer");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        
        let iconId = "icon-info";
        if (type === "success") iconId = "icon-check";
        if (type === "danger" || type === "warning") iconId = "icon-alert-circle";

        toast.innerHTML = `
            <svg class="icon"><use href="assets/icons/icons.svg#${iconId}"></use></svg>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    _setupTheme() {
        const currentTheme = StorageManager.getTheme();
        StorageManager.setTheme(currentTheme);

        const btnTheme = document.getElementById("btnToggleTheme");
        if (btnTheme) {
            btnTheme.addEventListener("click", () => {
                const isDark = document.documentElement.getAttribute("data-theme") !== "light";
                const nextTheme = isDark ? "light" : "dark";
                StorageManager.setTheme(nextTheme);
                this._updateThemeIcon(nextTheme);
            });
            this._updateThemeIcon(currentTheme);
        }
    },

    _updateThemeIcon(theme) {
        const iconUse = document.querySelector("#btnToggleTheme svg use");
        if (iconUse) {
            iconUse.setAttribute("href", `assets/icons/icons.svg#icon-${theme === "light" ? "moon" : "sun"}`);
        }
    },

    _setupModals() {
        // Fechar modais ao clicar no overlay ou no botão de fechar
        document.querySelectorAll(".modal-overlay").forEach(overlay => {
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove("open");
                }
            });

            const closeBtn = overlay.querySelector(".btn-close-modal");
            if (closeBtn) {
                closeBtn.addEventListener("click", () => overlay.classList.remove("open"));
            }
        });

        // Modal de Ajuda ao clicar no badge
        const badge = document.getElementById("processorBadge");
        if (badge) {
            badge.addEventListener("click", () => {
                this.openModal("modalHelp");
            });
        }
    },

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add("open");
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove("open");
    }
};
