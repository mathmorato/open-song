/**
 * Open Song - Mix Exporter
 * Versão: v.1.0.0
 * Solicita a geração da mixagem dos stems ativos ao processador local e efetua o download do arquivo WAV resultante.
 */

const MixExporter = {
    async exportMix(jobId, mixer, songTitle = "Musica") {
        const btnExport = document.getElementById("btnExportMix");
        const originalText = btnExport ? btnExport.innerHTML : "";

        try {
            if (btnExport) {
                btnExport.disabled = true;
                btnExport.innerHTML = `
                    <svg class="icon animate-spin"><use href="assets/icons/icons.svg#icon-refresh"></use></svg>
                    Exportando mix...
                `;
            }

            UiManager.showToast("Renderizando mixagem com os níveis atuais...", "info");

            const mixSpec = mixer.getActiveMixSpecification();
            const res = await ApiClient.exportMix(jobId, mixSpec);

            if (res && res.status === "ok") {
                const downloadUrl = ApiClient.getExportDownloadUrl(jobId);
                const cleanTitle = (songTitle || "Track").replace(/[^a-zA-Z0-9_-]/g, "_");
                Downloader.downloadFile(downloadUrl, `OpenSong_${cleanTitle}_Mix.wav`);
                UiManager.showToast("Mix exportado com sucesso!", "success");
            } else {
                throw new Error("Resposta inválida do processador.");
            }
        } catch (error) {
            console.error("Erro ao exportar mix:", error);
            UiManager.showToast(`Falha ao exportar mix: ${error.message}`, "danger");
        } finally {
            if (btnExport) {
                btnExport.disabled = false;
                btnExport.innerHTML = originalText;
            }
        }
    }
};
