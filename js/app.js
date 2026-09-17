/**
 * Open Song - Application Bootstrap
 * Versão: v.1.0.2
 * Ponto de entrada, coordenação de eventos globais e monitoramento de conexão.
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Instanciação dos Módulos Principais
    UiManager.init();

    const audioMixer = new AudioMixer();
    const audioPlayer = new AudioPlayer();

    // StemManager
    const stemManager = new StemManager(audioMixer, (stem) => {
        const songName = processorCtrl.selectedFile ? processorCtrl.selectedFile.name : "Faixa";
        Downloader.downloadSingleStem(processorCtrl.currentJobId, stem, songName);
    });

    // ProcessorController
    const processorCtrl = new ProcessorController(audioMixer, audioPlayer, stemManager);

    // History Module
    HistoryModule.init((jobId, filename) => {
        processorCtrl.loadJobFromHistory(jobId, filename);
    });

    // 2. Monitoramento de Saúde da Conexão com o Processador Local
    let isConnected = false;
    async function checkProcessorConnection() {
        const result = await ApiClient.checkHealth();
        if (result.ok) {
            if (!isConnected) {
                isConnected = true;
                UiManager.setConnectionStatus("connected", result.data);
            }
        } else {
            if (isConnected || UiManager.currentState === UiState.EMPTY) {
                isConnected = false;
                UiManager.setConnectionStatus("disconnected");
            }
        }
    }

    checkProcessorConnection();
    setInterval(checkProcessorConnection, 4500);

    // 3. Upload & Seleção de Arquivo
    const fileInput = document.getElementById("fileInput");
    const uploadArea = document.getElementById("uploadArea");

    if (uploadArea && fileInput) {
        uploadArea.addEventListener("click", () => fileInput.click());

        fileInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files[0]) {
                processorCtrl.selectFile(e.target.files[0]);
            }
        });

        // Drag & Drop
        uploadArea.addEventListener("dragover", (e) => {
            e.preventDefault();
            uploadArea.classList.add("dragover");
        });

        uploadArea.addEventListener("dragleave", () => {
            uploadArea.classList.remove("dragover");
        });

        uploadArea.addEventListener("drop", (e) => {
            e.preventDefault();
            uploadArea.classList.remove("dragover");
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                processorCtrl.selectFile(e.dataTransfer.files[0]);
            }
        });
    }

    // Botão de Trocar Arquivo
    const btnChangeFile = document.getElementById("btnChangeFile");
    if (btnChangeFile && fileInput) {
        btnChangeFile.addEventListener("click", () => fileInput.click());
    }

    // Botão de Iniciar Separação
    const btnSeparate = document.getElementById("btnSeparate");
    if (btnSeparate) {
        btnSeparate.addEventListener("click", () => {
            processorCtrl.startSeparation();
        });
    }

    // Botão de Cancelar
    const btnCancel = document.getElementById("btnCancelProcess");
    if (btnCancel) {
        btnCancel.addEventListener("click", () => {
            processorCtrl.cancelSeparation();
        });
    }

    // 4. Controles Globais do Player (Sincronizado)
    const btnPlayMaster = document.getElementById("btnPlayMaster");
    const scrubberTrack = document.getElementById("scrubberTrack");
    const scrubberFill = document.getElementById("scrubberFill");
    const timeDisplay = document.getElementById("timeDisplay");
    const masterVolumeSlider = document.getElementById("masterVolumeSlider");

    function updatePlayPauseIcon(isPlaying) {
        if (!btnPlayMaster) return;
        const iconUse = btnPlayMaster.querySelector("svg use");
        if (iconUse) {
            iconUse.setAttribute("href", `assets/icons/icons.svg#icon-${isPlaying ? "pause" : "play"}`);
        }
    }

    if (btnPlayMaster) {
        btnPlayMaster.addEventListener("click", () => {
            if (audioPlayer.mode === "original") {
                if (audioPlayer.isPlaying) {
                    audioPlayer.pause();
                } else {
                    audioPlayer.play();
                }
            } else {
                if (audioMixer.isPlaying) {
                    audioMixer.pause();
                } else {
                    audioMixer.play();
                }
            }
        });
    }

    // Callbacks de Tempo e Estado do Mixer
    audioMixer.onTimeUpdate = (cur, dur) => {
        if (audioPlayer.mode === "stems") {
            const pct = dur > 0 ? (cur / dur) * 100 : 0;
            if (scrubberFill) scrubberFill.style.width = `${pct}%`;
            if (timeDisplay) {
                timeDisplay.textContent = `${AudioPlayer.formatTime(cur)} / ${AudioPlayer.formatTime(dur)}`;
            }
        }
    };

    audioMixer.onPlayStateChange = (playing) => {
        if (audioPlayer.mode === "stems") {
            updatePlayPauseIcon(playing);
            document.querySelectorAll(".stem-card").forEach(c => c.classList.toggle("playing", playing));
        }
    };

    // Callbacks do Player Original
    audioPlayer.onTimeUpdate = (cur, dur) => {
        if (audioPlayer.mode === "original") {
            const pct = dur > 0 ? (cur / dur) * 100 : 0;
            if (scrubberFill) scrubberFill.style.width = `${pct}%`;
            if (timeDisplay) {
                timeDisplay.textContent = `${AudioPlayer.formatTime(cur)} / ${AudioPlayer.formatTime(dur)}`;
            }
        }
    };

    audioPlayer.onPlayStateChange = (playing) => {
        if (audioPlayer.mode === "original") {
            updatePlayPauseIcon(playing);
        }
    };

    // Scrubber / Seek
    if (scrubberTrack) {
        scrubberTrack.addEventListener("click", (e) => {
            const rect = scrubberTrack.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            const targetDuration = audioPlayer.mode === "original" ? audioPlayer.duration : audioMixer.duration;
            if (targetDuration > 0) {
                const targetTime = clickPos * targetDuration;
                if (audioPlayer.mode === "original") {
                    audioPlayer.seek(targetTime);
                } else {
                    audioMixer.seek(targetTime);
                }
            }
        });
    }

    // Master Volume
    if (masterVolumeSlider) {
        masterVolumeSlider.addEventListener("input", (e) => {
            const val = parseInt(e.target.value, 10) / 100;
            audioMixer.masterVolume = val;
            audioMixer._updateAudioGains();
            audioPlayer.setVolume(val);
        });
    }

    // Alternador de Modo: Stems vs Original
    const btnModeStems = document.getElementById("btnModeStems");
    const btnModeOriginal = document.getElementById("btnModeOriginal");

    if (btnModeStems && btnModeOriginal) {
        btnModeStems.addEventListener("click", () => {
            if (audioPlayer.mode === "original") {
                const cur = audioPlayer.currentTime;
                audioPlayer.pause();
                audioPlayer.mode = "stems";
                btnModeStems.classList.add("active");
                btnModeOriginal.classList.remove("active");
                audioMixer.seek(cur);
                updatePlayPauseIcon(audioMixer.isPlaying);
            }
        });

        btnModeOriginal.addEventListener("click", () => {
            if (audioPlayer.mode === "stems") {
                const cur = audioMixer.currentTime;
                audioMixer.pause();
                audioPlayer.mode = "original";
                btnModeOriginal.classList.add("active");
                btnModeStems.classList.remove("active");
                audioPlayer.seek(cur);
                updatePlayPauseIcon(audioPlayer.isPlaying);
            }
        });
    }

    // 5. Botões de Seleção e Ações em Lote
    const btnSelectAll = document.getElementById("btnSelectAll");
    const btnClearSelection = document.getElementById("btnClearSelection");
    const btnPlaySelected = document.getElementById("btnPlaySelected");
    const btnDownloadSelected = document.getElementById("btnDownloadSelected");
    const btnDownloadAll = document.getElementById("btnDownloadAll");
    const btnExportMix = document.getElementById("btnExportMix");

    if (btnSelectAll) {
        btnSelectAll.addEventListener("click", () => stemManager.selectAllStems());
    }

    if (btnClearSelection) {
        btnClearSelection.addEventListener("click", () => stemManager.clearSelection());
    }

    if (btnPlaySelected) {
        btnPlaySelected.addEventListener("click", () => {
            if (!audioMixer.isPlaying) {
                audioMixer.play();
            }
        });
    }

    if (btnDownloadSelected) {
        btnDownloadSelected.addEventListener("click", () => {
            const selected = stemManager.getSelectedStemIds();
            const songName = processorCtrl.selectedFile ? processorCtrl.selectedFile.name : "Faixa";
            Downloader.downloadSelectedStemsZip(processorCtrl.currentJobId, selected, songName);
        });
    }

    if (btnDownloadAll) {
        btnDownloadAll.addEventListener("click", () => {
            const songName = processorCtrl.selectedFile ? processorCtrl.selectedFile.name : "Faixa";
            Downloader.downloadAllStemsZip(processorCtrl.currentJobId, songName);
        });
    }

    if (btnExportMix) {
        btnExportMix.addEventListener("click", () => {
            const songName = processorCtrl.selectedFile ? processorCtrl.selectedFile.name : "Faixa";
            MixExporter.exportMix(processorCtrl.currentJobId, audioMixer, songName);
        });
    }

    // 6. Configurações e Modais
    const btnSettings = document.getElementById("btnSettings");
    const btnHistory = document.getElementById("btnHistory");
    const formSettings = document.getElementById("formSettings");

    if (btnSettings) {
        btnSettings.addEventListener("click", () => {
            const current = StorageManager.getSettings();
            const inputUrl = document.getElementById("inputProcessorUrl");
            const selectModel = document.getElementById("selectModel");
            const inputShifts = document.getElementById("inputShifts");
            const inputOverlap = document.getElementById("inputOverlap");

            if (inputUrl) inputUrl.value = current.localProcessorUrl || OPEN_SONG_CONFIG.localProcessorUrl;
            if (selectModel) selectModel.value = current.model || OPEN_SONG_CONFIG.defaultModel;
            if (inputShifts) inputShifts.value = current.shifts || OPEN_SONG_CONFIG.defaultShifts;
            if (inputOverlap) inputOverlap.value = current.overlap || OPEN_SONG_CONFIG.defaultOverlap;

            UiManager.openModal("modalSettings");
        });
    }

    if (formSettings) {
        formSettings.addEventListener("submit", (e) => {
            e.preventDefault();
            const newUrl = document.getElementById("inputProcessorUrl").value.trim();
            const newModel = document.getElementById("selectModel").value;
            const newShifts = parseInt(document.getElementById("inputShifts").value, 10);
            const newOverlap = parseFloat(document.getElementById("inputOverlap").value);

            StorageManager.saveSettings({
                localProcessorUrl: newUrl,
                model: newModel,
                shifts: newShifts,
                overlap: newOverlap
            });

            UiManager.closeModal("modalSettings");
            UiManager.showToast("Configurações salvas com sucesso!", "success");
            checkProcessorConnection();
        });
    }

    if (btnHistory) {
        btnHistory.addEventListener("click", () => {
            HistoryModule.renderHistory();
            UiManager.openModal("modalHistory");
        });
    }

    // Atalhos de Teclado (Ex: Barra de Espaço para Play/Pause)
    window.addEventListener("keydown", (e) => {
        if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "SELECT") {
            e.preventDefault();
            if (btnPlayMaster) btnPlayMaster.click();
        }
    });

    console.log(`Open Song ${OPEN_SONG_CONFIG.version} inicializado com sucesso.`);
});
