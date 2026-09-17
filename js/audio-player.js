/**
 * Open Song - Audio Player & Track Comparator
 * Versão: v.1.0.0
 * Controla o player do áudio original e coordena a alternância entre áudio original e stems.
 */

class AudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.audio.preload = "metadata";
        this.originalUrl = null;
        this.isPlaying = false;
        this.duration = 0;
        this.currentTime = 0;
        this.mode = "stems"; // "stems" ou "original"
        this.onTimeUpdate = null;
        this.onPlayStateChange = null;
        this.onDurationChange = null;

        this._bindEvents();
    }

    _bindEvents() {
        this.audio.addEventListener("loadedmetadata", () => {
            this.duration = this.audio.duration;
            if (this.onDurationChange) this.onDurationChange(this.duration);
        });

        this.audio.addEventListener("timeupdate", () => {
            if (this.mode === "original") {
                this.currentTime = this.audio.currentTime;
                if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime, this.duration);
            }
        });

        this.audio.addEventListener("ended", () => {
            this.isPlaying = false;
            if (this.onPlayStateChange) this.onPlayStateChange(false);
        });
    }

    setOriginalAudio(fileOrUrl) {
        if (this.originalUrl && this.originalUrl.startsWith("blob:")) {
            URL.revokeObjectURL(this.originalUrl);
        }

        if (fileOrUrl instanceof File || fileOrUrl instanceof Blob) {
            this.originalUrl = URL.createObjectURL(fileOrUrl);
        } else {
            this.originalUrl = fileOrUrl;
        }

        this.audio.src = this.originalUrl;
    }

    play() {
        this.audio.currentTime = this.currentTime;
        this.audio.play();
        this.isPlaying = true;
        if (this.onPlayStateChange) this.onPlayStateChange(true);
    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
        if (this.onPlayStateChange) this.onPlayStateChange(false);
    }

    seek(time) {
        this.currentTime = time;
        this.audio.currentTime = time;
        if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime, this.duration);
    }

    setVolume(volume) {
        this.audio.volume = Math.max(0, Math.min(1.0, volume));
    }

    destroy() {
        this.pause();
        if (this.originalUrl && this.originalUrl.startsWith("blob:")) {
            URL.revokeObjectURL(this.originalUrl);
        }
        this.originalUrl = null;
    }

    static formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
}
