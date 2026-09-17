/**
 * Open Song - Processor Controller
 * Versão: v.1.0.0
 * Orquestra o envio do arquivo, monitoramento de progresso e cancelamento.
 */

class ProcessorController {
    constructor(audioMixer, audioPlayer, stemManager) {
        this.mixer = audioMixer;
        this.player = audioPlayer;
        this.stemManager = stemManager;
        this.currentJobId = null;
        this.selectedFile = null;
        this.pollInterval = null;
    }

    selectFile(file) {
        if (!file) return;

        const ext = file.name.split(".").pop().toLowerCase();
        if (!OPEN_SONG_CONFIG.supportedFormats.includes(ext)) {
            UiManager.showToast(`Formato .${ext} não suportado. Utilize MP3, WAV, FLAC ou OGG.`, "warning");
            return;
        }

        this.selectedFile = file;

        // Atualiza preview do arquivo
        const fileNameEl = document.getElementById("fileMetaName");
        const fileSubEl = document.getElementById("fileMetaSub");
        if (fileNameEl) fileNameEl.textContent = file.name;

        // Formata tamanho em MB
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);

        // Prepara áudio original no player para extrair duração
        this.player.setOriginalAudio(file);
        this.player.onDurationChange = (dur) => {
            const timeFormatted = AudioPlayer.formatTime(dur);
            if (fileSubEl) {
                fileSubEl.textContent = `${timeFormatted} • ${ext.toUpperCase()} • ${sizeMb} MB`;
            }
        };

        if (fileSubEl) {
            fileSubEl.textContent = `${ext.toUpperCase()} • ${sizeMb} MB`;
        }

        UiManager.setState(UiState.READY);
    }

    async startSeparation() {
        if (!this.selectedFile) {
            UiManager.showToast("Por favor, selecione um arquivo de áudio.", "warning");
            return;
        }

        // Verifica saúde do processador e dependências antes de enviar
        const health = await ApiClient.checkHealth();
        if (!health.ok) {
            UiManager.showToast("Processador local não está conectado. Inicie o servidor Python.", "danger");
            UiManager.openModal("modalHelp");
            return;
        }

        if (health.data && !health.data.demucs_installed) {
            UiManager.showToast("O Demucs não está instalado no ambiente Python.", "warning");
            UiManager.openModal("modalHelp");
            return;
        }

        if (health.data && !health.data.ffmpeg_installed) {
            UiManager.showToast("O FFmpeg não foi encontrado no PATH do sistema.", "warning");
            UiManager.openModal("modalHelp");
            return;
        }

        try {
            UiManager.setState(UiState.PROCESSING);
            UiManager.updateProgress(5, "Enviando arquivo para o processador local...");

            const settings = StorageManager.getSettings();
            const res = await ApiClient.uploadAndSeparate(this.selectedFile, {
                model: settings.model || OPEN_SONG_CONFIG.defaultModel,
                shifts: settings.shifts || OPEN_SONG_CONFIG.defaultShifts,
                overlap: settings.overlap || OPEN_SONG_CONFIG.defaultOverlap
            });

            this.currentJobId = res.job_id;
            UiManager.updateProgress(10, "Áudio recebido! Iniciando inteligência artificial...");
            this._startPolling(this.currentJobId);

        } catch (error) {
            console.error("Erro ao iniciar separação:", error);
            UiManager.setState(UiState.ERROR);
            UiManager.showToast(`Erro ao iniciar separação: ${error.message}`, "danger");
        }
    }

    _startPolling(jobId) {
        this._stopPolling();
        this.pollInterval = setInterval(async () => {
            try {
                const statusData = await ApiClient.getStatus(jobId);
                
                if (statusData.status === "processing" || statusData.status === "queued") {
                    UiManager.updateProgress(statusData.progress || 10, statusData.message || "Processando faixas...");
                } else if (statusData.status === "completed") {
                    this._stopPolling();
                    UiManager.updateProgress(100, "Separação concluída com sucesso!");
                    setTimeout(() => {
                        this._handleSeparationCompleted(statusData);
                    }, 500);
                } else if (statusData.status === "failed") {
                    this._stopPolling();
                    UiManager.setState(UiState.ERROR);
                    UiManager.showToast(statusData.error || "Ocorreu uma falha no processamento.", "danger");
                } else if (statusData.status === "cancelled") {
                    this._stopPolling();
                    UiManager.setState(UiState.CANCELLED);
                    UiManager.showToast("Processamento cancelado.", "info");
                }
            } catch (err) {
                console.warn("Falha temporária no polling de status:", err);
            }
        }, 1000);
    }

    _stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    async cancelSeparation() {
        if (!this.currentJobId) return;

        try {
            UiManager.updateProgress(null, "Cancelando processamento...");
            await ApiClient.cancelJob(this.currentJobId);
            this._stopPolling();
            UiManager.setState(UiState.CANCELLED);
            UiManager.showToast("Processamento cancelado com sucesso.", "info");
        } catch (error) {
            console.error("Erro ao cancelar:", error);
            UiManager.showToast("Falha ao comunicar cancelamento ao processador.", "danger");
        }
    }

    _handleSeparationCompleted(jobData) {
        const stems = jobData.stems || [];
        if (stems.length === 0) {
            UiManager.showToast("Nenhuma faixa de áudio retornada.", "warning");
            return;
        }

        // Prepara URLs completas para os stems
        const mappedStems = stems.map(s => ({
            ...s,
            audioUrl: ApiClient.getStemAudioUrl(jobData.job_id, s.id, false)
        }));

        // Renderiza no StemManager e carrega no AudioMixer
        this.stemManager.renderStems(mappedStems);
        this.mixer.loadStems(mappedStems);

        // Atualiza título do resultado
        const resultTitle = document.getElementById("resultsSongTitle");
        if (resultTitle && this.selectedFile) {
            resultTitle.textContent = this.selectedFile.name;
        }

        // Salva no histórico
        HistoryModule.saveJob(
            jobData.job_id,
            this.selectedFile ? this.selectedFile.name : "Faixa",
            stems.length
        );

        UiManager.setState(UiState.COMPLETED);
        UiManager.showToast("Música separada! Suas faixas estão prontas.", "success");
    }

    async loadJobFromHistory(jobId, filename) {
        try {
            UiManager.showToast("Carregando faixas do histórico...", "info");
            const stems = await ApiClient.getStems(jobId);
            if (!stems || stems.length === 0) {
                UiManager.showToast("As faixas deste processamento não foram encontradas no servidor.", "warning");
                return;
            }

            this.currentJobId = jobId;
            const mappedStems = stems.map(s => ({
                ...s,
                audioUrl: ApiClient.getStemAudioUrl(jobId, s.id, false)
            }));

            this.stemManager.renderStems(mappedStems);
            this.mixer.loadStems(mappedStems);

            const resultTitle = document.getElementById("resultsSongTitle");
            if (resultTitle) resultTitle.textContent = filename;

            UiManager.setState(UiState.COMPLETED);
            UiManager.closeModal("modalHistory");
            UiManager.showToast("Faixas carregadas com sucesso!", "success");
        } catch (error) {
            console.error("Erro ao carregar do histórico:", error);
            UiManager.showToast("Não foi possível carregar as faixas deste job.", "danger");
        }
    }
}
