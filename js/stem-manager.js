/**
 * Open Song - Stem Manager
 * Versão: v.1.0.0
 * Gerencia a renderização e interações visuais dos cards de faixas e faders da mesa.
 */

class StemManager {
    constructor(mixer, onDownloadIndividual) {
        this.mixer = mixer;
        this.onDownloadIndividual = onDownloadIndividual;
        this.stems = [];
        this.stemsGridEl = document.getElementById("stemsGrid");
        this.mixerBoardEl = document.getElementById("mixerBoard");
    }

    renderStems(stems) {
        this.stems = stems;
        if (!this.stemsGridEl || !this.mixerBoardEl) return;

        this.stemsGridEl.innerHTML = "";
        this.mixerBoardEl.innerHTML = "";

        stems.forEach(stem => {
            // 1. Cria o Card da Faixa
            const card = this._createStemCard(stem);
            this.stemsGridEl.appendChild(card);

            // 2. Cria o Canal no Mixer Integrado
            const channel = this._createMixerChannel(stem);
            this.mixerBoardEl.appendChild(channel);
        });

        // Atualiza contadores
        const countTag = document.getElementById("stemsCountTag");
        if (countTag) {
            countTag.textContent = `${stems.length} faixas disponíveis`;
        }
    }

    _createStemCard(stem) {
        const card = document.createElement("div");
        card.className = "stem-card";
        card.id = `stem-card-${stem.id}`;
        card.setAttribute("data-stem", stem.id);

        const iconName = stem.icon || "music";

        card.innerHTML = `
            <div class="stem-header">
                <div class="stem-ident">
                    <label class="stem-checkbox-wrapper" title="Selecionar faixa">
                        <input type="checkbox" class="stem-checkbox" data-stem="${stem.id}" checked />
                    </label>
                    <div class="stem-icon-box">
                        <svg class="icon"><use href="assets/icons/icons.svg#icon-${iconName}"></use></svg>
                    </div>
                    <div>
                        <div class="stem-name">${stem.name}</div>
                        <div class="stem-size">${stem.size_formatted || ""}</div>
                    </div>
                </div>
            </div>

            <!-- Visualizador Waveform Estilizado -->
            <div class="stem-waveform" aria-hidden="true">
                ${this._generateWaveformBars()}
            </div>

            <!-- Slider de Volume da Faixa -->
            <div class="stem-volume-row">
                <span class="stem-vol-label">Volume</span>
                <input type="range" class="stem-volume-slider" data-stem="${stem.id}" min="0" max="100" value="100" />
                <span class="stem-vol-value" id="vol-val-${stem.id}">100%</span>
            </div>

            <!-- Botões de Ação do Card -->
            <div class="stem-buttons-row">
                <button type="button" class="btn-stem-toggle btn-mute" data-stem="${stem.id}" title="Silenciar faixa">
                    Mute
                </button>
                <button type="button" class="btn-stem-toggle btn-solo" data-stem="${stem.id}" title="Ouvir somente esta faixa">
                    Solo
                </button>
                <button type="button" class="btn btn-outline btn-download-stem" data-stem="${stem.id}" title="Baixar ${stem.name}">
                    <svg class="icon"><use href="assets/icons/icons.svg#icon-download"></use></svg>
                    Baixar
                </button>
            </div>
        `;

        this._bindCardEvents(card, stem);
        return card;
    }

    _createMixerChannel(stem) {
        const channel = document.createElement("div");
        channel.className = "mixer-channel";
        channel.id = `mixer-channel-${stem.id}`;
        channel.setAttribute("data-stem", stem.id);

        channel.innerHTML = `
            <div class="channel-label">${stem.name}</div>
            <div class="channel-fader-wrap">
                <input type="range" class="channel-fader" data-stem="${stem.id}" min="0" max="100" value="100" />
                <span class="channel-fader-val" id="fader-val-${stem.id}">0 dB</span>
            </div>
            <div class="channel-switches">
                <button type="button" class="btn-mini-toggle mini-mute" data-stem="${stem.id}">M</button>
                <button type="button" class="btn-mini-toggle mini-solo" data-stem="${stem.id}">S</button>
            </div>
        `;

        this._bindChannelEvents(channel, stem);
        return channel;
    }

    _bindCardEvents(card, stem) {
        // Checkbox de Seleção
        const checkbox = card.querySelector(".stem-checkbox");
        checkbox.addEventListener("change", (e) => {
            this.mixer.setStemSelection(stem.id, e.target.checked);
        });

        // Volume Slider
        const volSlider = card.querySelector(".stem-volume-slider");
        const volValue = card.querySelector(`#vol-val-${stem.id}`);
        volSlider.addEventListener("input", (e) => {
            const val = parseInt(e.target.value, 10);
            volValue.textContent = `${val}%`;
            this.mixer.setStemVolume(stem.id, val / 100);
            this._syncMixerFader(stem.id, val);
        });

        // Botão Mute
        const btnMute = card.querySelector(".btn-mute");
        btnMute.addEventListener("click", () => {
            const isMuted = this.mixer.toggleStemMute(stem.id);
            this._updateMuteUI(stem.id, isMuted);
        });

        // Botão Solo
        const btnSolo = card.querySelector(".btn-solo");
        btnSolo.addEventListener("click", () => {
            const isSolo = this.mixer.toggleStemSolo(stem.id);
            this._updateSoloUI(stem.id, isSolo);
        });

        // Download Individual
        const btnDownload = card.querySelector(".btn-download-stem");
        btnDownload.addEventListener("click", () => {
            if (this.onDownloadIndividual) {
                this.onDownloadIndividual(stem);
            }
        });
    }

    _bindChannelEvents(channel, stem) {
        const fader = channel.querySelector(".channel-fader");
        fader.addEventListener("input", (e) => {
            const val = parseInt(e.target.value, 10);
            this.mixer.setStemVolume(stem.id, val / 100);
            this._syncCardSlider(stem.id, val);
        });

        const miniMute = channel.querySelector(".mini-mute");
        miniMute.addEventListener("click", () => {
            const isMuted = this.mixer.toggleStemMute(stem.id);
            this._updateMuteUI(stem.id, isMuted);
        });

        const miniSolo = channel.querySelector(".mini-solo");
        miniSolo.addEventListener("click", () => {
            const isSolo = this.mixer.toggleStemSolo(stem.id);
            this._updateSoloUI(stem.id, isSolo);
        });
    }

    _updateMuteUI(stemId, isMuted) {
        const cardBtn = document.querySelector(`.stem-card[data-stem="${stemId}"] .btn-mute`);
        const miniBtn = document.querySelector(`.mixer-channel[data-stem="${stemId}"] .mini-mute`);
        
        if (cardBtn) {
            cardBtn.classList.toggle("mute-active", isMuted);
            cardBtn.textContent = isMuted ? "MUTE ATIVO" : "Mute";
        }
        if (miniBtn) {
            miniBtn.classList.toggle("active-m", isMuted);
        }
    }

    _updateSoloUI(stemId, isSolo) {
        const cardBtn = document.querySelector(`.stem-card[data-stem="${stemId}"] .btn-solo`);
        const miniBtn = document.querySelector(`.mixer-channel[data-stem="${stemId}"] .mini-solo`);
        
        if (cardBtn) {
            cardBtn.classList.toggle("solo-active", isSolo);
            cardBtn.textContent = isSolo ? "SOLO ATIVO" : "Solo";
        }
        if (miniBtn) {
            miniBtn.classList.toggle("active-s", isSolo);
        }
    }

    _syncMixerFader(stemId, val) {
        const fader = document.querySelector(`.mixer-channel[data-stem="${stemId}"] .channel-fader`);
        const faderVal = document.getElementById(`fader-val-${stemId}`);
        if (fader) fader.value = val;
        if (faderVal) {
            const db = val === 0 ? "-inf" : `${Math.round(20 * Math.log10(val / 100))} dB`;
            faderVal.textContent = db;
        }
    }

    _syncCardSlider(stemId, val) {
        const slider = document.querySelector(`.stem-card[data-stem="${stemId}"] .stem-volume-slider`);
        const volVal = document.getElementById(`vol-val-${stemId}`);
        if (slider) slider.value = val;
        if (volVal) volVal.textContent = `${val}%`;
    }

    _generateWaveformBars() {
        const heights = [35, 60, 45, 80, 50, 95, 40, 70, 85, 30, 65, 90, 55, 75, 40, 60, 30, 70, 85, 45, 95, 65, 40];
        return heights.map(h => `<div class="wave-bar" style="height: ${h}%;"></div>`).join("");
    }

    selectAllStems() {
        document.querySelectorAll(".stem-checkbox").forEach(cb => {
            cb.checked = true;
            this.mixer.setStemSelection(cb.dataset.stem, true);
        });
    }

    clearSelection() {
        document.querySelectorAll(".stem-checkbox").forEach(cb => {
            cb.checked = false;
            this.mixer.setStemSelection(cb.dataset.stem, false);
        });
    }

    getSelectedStemIds() {
        const selected = [];
        document.querySelectorAll(".stem-checkbox:checked").forEach(cb => {
            selected.push(cb.dataset.stem);
        });
        return selected;
    }
}
