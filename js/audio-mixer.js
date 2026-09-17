/**
 * Open Song - Audio Mixer & Synchronizer Engine
 * Versão: v.1.0.0
 * Gerencia a reprodução simultânea e rigorosamente sincronizada de múltiplos stems via Web Audio API.
 */

class AudioMixer {
    constructor() {
        this.audioContext = null;
        this.tracks = new Map(); // id -> { audio, sourceNode, gainNode, volume, isMuted, isSolo, url, name }
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.masterVolume = 1.0;
        this.syncInterval = null;
        this.onTimeUpdate = null;
        this.onPlayStateChange = null;
        this.onDurationChange = null;
    }

    _ensureAudioContext() {
        if (!this.audioContext) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === "suspended") {
            this.audioContext.resume();
        }
    }

    /**
     * Carrega a lista de stems na mesa de mixagem
     */
    loadStems(stemsList) {
        this.stop();
        this.tracks.forEach(track => {
            track.audio.pause();
            track.audio.src = "";
            track.audio.remove();
        });
        this.tracks.clear();
        this.currentTime = 0;
        this.duration = 0;

        stemsList.forEach(stem => {
            const audio = new Audio();
            audio.crossOrigin = "anonymous";
            audio.preload = "auto";
            audio.src = stem.audioUrl;

            // Ao obter duração do primeiro stem
            audio.addEventListener("loadedmetadata", () => {
                if (audio.duration && !isNaN(audio.duration) && audio.duration > this.duration) {
                    this.duration = audio.duration;
                    if (this.onDurationChange) this.onDurationChange(this.duration);
                }
            });

            this.tracks.set(stem.id, {
                id: stem.id,
                name: stem.name,
                audio: audio,
                sourceNode: null,
                gainNode: null,
                volume: 1.0,
                isMuted: false,
                isSolo: false,
                isSelected: true,
                url: stem.audioUrl
            });
        });
    }

    _setupAudioNodes() {
        this._ensureAudioContext();
        this.tracks.forEach(track => {
            if (!track.gainNode) {
                try {
                    track.sourceNode = this.audioContext.createMediaElementSource(track.audio);
                    track.gainNode = this.audioContext.createGain();
                    track.sourceNode.connect(track.gainNode);
                    track.gainNode.connect(this.audioContext.destination);
                } catch (e) {
                    // Fallback caso createMediaElementSource já tenha sido anexado
                }
            }
        });
    }

    play() {
        if (this.tracks.size === 0) return;
        this._ensureAudioContext();
        this._setupAudioNodes();
        this._updateAudioGains();

        const playPromises = [];
        this.tracks.forEach(track => {
            track.audio.currentTime = this.currentTime;
            playPromises.push(track.audio.play().catch(err => {
                console.warn(`Erro ao iniciar reprodução da faixa ${track.name}:`, err);
            }));
        });

        this.isPlaying = true;
        this._startSyncWatchdog();
        if (this.onPlayStateChange) this.onPlayStateChange(true);
    }

    pause() {
        this.tracks.forEach(track => {
            track.audio.pause();
        });
        this.isPlaying = false;
        this._stopSyncWatchdog();
        if (this.onPlayStateChange) this.onPlayStateChange(false);
    }

    stop() {
        this.pause();
        this.seek(0);
    }

    seek(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration || time));
        this.tracks.forEach(track => {
            track.audio.currentTime = this.currentTime;
        });
        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.currentTime, this.duration);
        }
    }

    setStemVolume(stemId, volume) {
        const track = this.tracks.get(stemId);
        if (!track) return;
        track.volume = Math.max(0, Math.min(1.0, volume));
        this._updateAudioGains();
    }

    toggleStemMute(stemId) {
        const track = this.tracks.get(stemId);
        if (!track) return false;
        track.isMuted = !track.isMuted;
        this._updateAudioGains();
        return track.isMuted;
    }

    toggleStemSolo(stemId) {
        const track = this.tracks.get(stemId);
        if (!track) return false;
        track.isSolo = !track.isSolo;
        this._updateAudioGains();
        return track.isSolo;
    }

    setStemSelection(stemId, isSelected) {
        const track = this.tracks.get(stemId);
        if (track) {
            track.isSelected = isSelected;
            this._updateAudioGains();
        }
    }

    /**
     * Calcula o ganho de cada faixa considerando Mute, Solo, Seleção e Master
     */
    _updateAudioGains() {
        const hasAnySolo = Array.from(this.tracks.values()).some(t => t.isSolo);

        this.tracks.forEach(track => {
            let effectiveGain = 0;

            if (hasAnySolo) {
                // Se houver algum Solo ativo, somente os Solos tocam (a menos que estejam mutados)
                if (track.isSolo && !track.isMuted && track.isSelected) {
                    effectiveGain = track.volume * this.masterVolume;
                }
            } else {
                // Sem Solo ativo: toca se não estiver mutado e estiver selecionado
                if (!track.isMuted && track.isSelected) {
                    effectiveGain = track.volume * this.masterVolume;
                }
            }

            if (track.gainNode && this.audioContext) {
                track.gainNode.gain.setValueAtTime(effectiveGain, this.audioContext.currentTime);
            } else {
                track.audio.volume = effectiveGain;
            }
        });
    }

    /**
     * Watchdog de sincronização temporal contínua para eliminar qualquer drift
     */
    _startSyncWatchdog() {
        this._stopSyncWatchdog();
        this.syncInterval = setInterval(() => {
            if (!this.isPlaying || this.tracks.size === 0) return;

            // Usa a primeira faixa válida como referência
            const trackList = Array.from(this.tracks.values());
            const refTrack = trackList[0];
            const refTime = refTrack.audio.currentTime;

            this.currentTime = refTime;
            if (refTrack.audio.duration && !this.duration) {
                this.duration = refTrack.audio.duration;
            }

            // Verifica se a música chegou ao fim
            if (this.duration > 0 && refTime >= this.duration - 0.1) {
                this.stop();
                return;
            }

            // Corrige qualquer faixa cujo atraso/avanço ultrapasse 40 milissegundos
            for (let i = 1; i < trackList.length; i++) {
                const t = trackList[i].audio;
                if (Math.abs(t.currentTime - refTime) > 0.04) {
                    t.currentTime = refTime;
                }
            }

            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.currentTime, this.duration);
            }
        }, 200);
    }

    _stopSyncWatchdog() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    getActiveMixSpecification() {
        const spec = [];
        this.tracks.forEach(track => {
            spec.push({
                stem: track.id,
                volume: track.volume,
                muted: track.isMuted,
                selected: track.isSelected
            });
        });
        return spec;
    }
}
