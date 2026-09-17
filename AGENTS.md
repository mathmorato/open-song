# Regras do Projeto Open Song para Agentes de IA

As regras completas e diretrizes gerais de desenvolvimento para este projeto estão documentadas em:
- [open-song-rules.md](file:///.agents/rules/open-song-rules.md)

---

## Resumo das Regras Críticas

1. **Arquitetura em 2 componentes**:
   - Interface Web Estática (GitHub Pages em `https://mathmorato.github.io/open-song/` ou servidor local).
   - Processador Local Python em `http://127.0.0.1:8765` com Demucs. O GitHub Pages **nunca** executa Python.
2. **Caminhos e Configuração**:
   - Caminhos estritamente relativos no frontend (`./css/`, `./js/`, `./assets/`).
   - Proibido hardcodar `localhost` espalhado; centralizar em `js/config.js`.
3. **Design e Temas**:
   - Dark mode como padrão, Light mode disponível. Validar sempre em ambos os temas.
   - Ícones estritamente line icons (`fill="none"`, `stroke="currentColor"`).
4. **Áudio e Mixer**:
   - Web Audio API com sincronização multi-track rígida sem drift temporal.
   - Mute (`MUTE ATIVO`), Solo (`SOLO ATIVO`), fader de volume, comparador com o áudio original.
   - Downloads individuais, selecionados (ZIP), todos (ZIP) e Exportação de mix.
5. **Versionamento e Git**:
   - Toda alteração deve incrementar a versão no formato `v.X.Y.Z`.
   - Atualizar a versão no rodapé (`index.html`), `js/config.js`, scripts e backend.
   - Formato do commit: `v.X.Y.Z: descrição das alterações`.
   - Enviar com `git push origin HEAD`.
