/**
 * Open Song - Downloader Module
 * Versão: v.1.0.0
 * Gerencia o download de faixas individuais e geração/obtenção de pacotes ZIP.
 */

const Downloader = {
    downloadFile(url, suggestedFilename) {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        if (suggestedFilename) {
            link.download = suggestedFilename;
        }
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    downloadSingleStem(jobId, stem, songTitle = "Musica") {
        const cleanTitle = (songTitle || "Track").replace(/[^a-zA-Z0-9_-]/g, "_");
        const filename = `${cleanTitle}_${stem.id}.wav`;
        const url = ApiClient.getStemAudioUrl(jobId, stem.id, true);
        UiManager.showToast(`Iniciando download de ${stem.name}...`, "info");
        this.downloadFile(url, filename);
    },

    downloadSelectedStemsZip(jobId, selectedStemIds, songTitle = "Musica") {
        if (!selectedStemIds || selectedStemIds.length === 0) {
            UiManager.showToast("Nenhuma faixa selecionada para download.", "warning");
            return;
        }
        const cleanTitle = (songTitle || "Track").replace(/[^a-zA-Z0-9_-]/g, "_");
        const filename = `OpenSong_${cleanTitle}_Selected.zip`;
        const url = ApiClient.getZipDownloadUrl(jobId, selectedStemIds);
        UiManager.showToast(`Preparando ZIP com ${selectedStemIds.length} faixas selecionadas...`, "info");
        this.downloadFile(url, filename);
    },

    downloadAllStemsZip(jobId, songTitle = "Musica") {
        const cleanTitle = (songTitle || "Track").replace(/[^a-zA-Z0-9_-]/g, "_");
        const filename = `OpenSong_${cleanTitle}_Stems.zip`;
        const url = ApiClient.getZipDownloadUrl(jobId, []);
        UiManager.showToast("Preparando ZIP com todas as faixas...", "info");
        this.downloadFile(url, filename);
    }
};
