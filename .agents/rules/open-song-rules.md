# Diretrizes e Regras Gerais do Open Song para Agentes de IA

Este documento reúne todas as diretrizes funcionais, arquiteturais, técnicas e visuais da plataforma **Open Song**.
Qualquer agente que realize alterações neste repositório **DEVE** seguir rigorosamente estas regras.

---

## 1. Princípio Arquitetural e Cenários de Execução

O Open Song é dividido estritamente em dois componentes:

```text
INTERFACE WEB (Estática)
        ↓
GitHub Pages (https://mathmorato.github.io/open-song/) ou servidor local
        ↓ (HTTP / CORS para http://127.0.0.1:8765)
PROCESSADOR LOCAL (Python)
        ↓
Demucs (htdemucs)
        ↓
Stems de Áudio (Vocals, Drums, Bass, Other)
```

### Cenário 1: Execução Local Completa
- Frontend e backend executados no computador do usuário.

### Cenário 2: GitHub Pages (Modo Oficial)
- O GitHub Pages serve **apenas** os arquivos estáticos da interface (`index.html`, `css/`, `js/`, `assets/`).
- O GitHub Pages **NUNCA** executa Python nem Demucs diretamente.
- O processamento de IA é executado localmente na máquina do usuário via `http://127.0.0.1:8765`.
- A comunicação com o processador ocorre via `fetch` local com tratamento de CORS.
- **Modo Demonstração / Fallback gracioso**: Se o processador local estiver desconectado, a interface **nunca deve quebrar**. Deve exibir status visual claro ("Processador desconectado") e abrir modal com instruções de instalação.

---

## 2. Regras do Frontend

1. **Totalmente Estático**:
   - Compatível com GitHub Pages.
   - Proibido backend obrigatório no servidor web (sem Node.js server-side, sem PHP, sem banco remoto).
   - Sem upload para nuvens externas. Privacidade total.
2. **Caminhos Relativos**:
   - Todos os caminhos de assets, CSS e JS devem ser relativos (`./css/app.css`, `./js/app.js`, `./assets/...`).
   - Proibido caminhos absolutos de sistema (como `C:\...`).
3. **URL do Processador Centralizada**:
   - **NUNCA** espalhar `localhost` ou `127.0.0.1` soltos pelos arquivos JavaScript.
   - A URL base deve ficar centralizada em `js/config.js` (`OPEN_SONG_CONFIG.localProcessorUrl`).
4. **Design e Temas**:
   - **Dark Mode** é o padrão visual.
   - **Light Mode** deve estar sempre disponível e funcional.
   - Toda alteração de UI deve ser obrigatoriamente validada em ambos os temas.
5. **Ícones**:
   - Utilizar **exclusivamente Line Icons** (contornos).
   - Proibido ícones preenchidos ou sólidos.
   - Padrão: `fill="none"`, `stroke="currentColor"`, traços consistentes.
   - Reutilizar o sprite oficial em `assets/icons/icons.svg`.
6. **Logo**:
   - Utilizar a logo oficial vetorial em `assets/logo/logo.svg`.
   - Proibido criar variações desnecessárias.

---

## 3. Regras de Áudio, Player e Mixer

1. **Formatos Suportados**:
   - `MP3`, `WAV`, `FLAC`, `OGG`.
2. **Player Global e Sincronização Rigorosa**:
   - Utilizar **Web Audio API** para reprodução multi-faixa.
   - Todas as faixas devem iniciar (`play`), pausar (`pause`) e buscar posições (`seek`) **rigorosamente juntas**.
   - Proibido permitir drift temporal entre as faixas (manter watchdog anti-drift).
3. **Comparador Original**:
   - Manter alternador para comparar a música original com os stems gerados.
4. **Mesa de Mixagem Integrada**:
   - Slider de volume independente para cada stem.
   - **Mute**: Ao ativar, a faixa fica inaudível; o rótulo passa para `MUTE ATIVO`.
   - **Solo**: Ao ativar, somente a(s) faixa(s) em solo são audíveis; o rótulo passa para `SOLO ATIVO`. Suporte a solo aditivo (múltiplas faixas em solo).
5. **Stems Dinâmicos**:
   - A aplicação deve suportar dinamicamente qualquer quantidade de faixas (não fixar em 4 faixas no código).
6. **Downloads e Exportação**:
   - Download individual de qualquer stem em WAV.
   - Download de faixas selecionadas compactadas em ZIP.
   - Download de todas as faixas compactadas em ZIP (`OpenSong_<Musica>_Stems.zip`).
   - **Exportar mix**: Combina os stems respeitando volumes e mute ajustados na mesa de áudio e gera novo arquivo WAV.

---

## 4. Regras do Processador Local (Python)

1. **Porta e Endereço**:
   - Padrão: `http://127.0.0.1:8765`.
   - Escutar preferencialmente em `127.0.0.1` (segurança).
2. **CORS Obrigatório**:
   - Tratar pre-flight `OPTIONS`.
   - Permitir origens de `localhost`, `127.0.0.1` e do GitHub Pages (`https://mathmorato.github.io`).
   - Headers: `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, `Access-Control-Expose-Headers`.
3. **Execução Segura do Demucs**:
   - Executar sempre via lista de argumentos estruturados com subprocess:
     `[sys.executable, "-m", "demucs.separate", "-n", model, "--shifts", str(shifts), "--overlap", str(overlap), "-o", output_dir, input_path]`.
   - **NUNCA** executar strings com `shell=True`.
   - Sanitizar nomes de arquivos e validar contra path traversal.
4. **Streaming de Áudio (Range Requests)**:
   - Os endpoints de download de áudio devem suportar cabeçalho `Range` (HTTP 206 Partial Content) para possibilitar seek imediato no navegador sem download integral.
5. **Cancelamento e Limpeza**:
   - O endpoint `/cancel/{job_id}` deve terminar o processo Demucs e seus subprocessos filhos imediatamente, limpando arquivos residuais.
   - Rotina de retenção configurável para limpeza de jobs temporários antigos.
6. **Scripts Multiplataforma**:
   - Manter `local-processor/start.bat` para Windows (com verificação de venv, pip requirements e FFmpeg).
   - Manter `local-processor/start.sh` para Linux e macOS.

---

## 5. Regras de Versionamento e Git

1. **Incremento Contínuo de Versão**:
   - Toda alteração deve gerar nova versão incremental no formato `v.X.Y.Z` (ex: `v.1.0.0`, `v.1.0.1`, etc.).
   - A versão deve ser atualizada em:
     - Rodapé do `index.html`.
     - `js/config.js` (`version: "v.X.Y.Z"`).
     - Cabeçalhos dos arquivos JavaScript.
     - `local-processor/server.py` (`VERSION = "v.X.Y.Z"`).
     - `local-processor/processor.py`.
2. **Formato de Mensagens de Commit**:
   - O commit deve seguir obrigatoriamente o padrão:
     `v.X.Y.Z: descrição clara e concisa das alterações`
   - Exemplo: `v.1.0.1: adiciona regras gerais do projeto para agentes`
3. **Envio para o Repositório**:
   - Sempre executar `git push origin HEAD` após os commits.

---

## 6. Autonomia do Agente

- O agente possui autonomia total para criar arquivos, editar componentes, ajustar estilos, rodar servidores de teste, executar testes automatizados e realizar commit/push sem solicitar confirmações desnecessárias para cada etapa.
- Manter integridade funcional de todo o código existente.
