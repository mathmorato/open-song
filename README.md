# Open Song

Separação inteligente de músicas em faixas de áudio.

O **Open Song** utiliza inteligência artificial para separar músicas em diferentes stems, como **Vocals**, **Drums**, **Bass** e **Other**.

A interface pode ser hospedada no **GitHub Pages**, enquanto o processamento é realizado localmente através do **Python** e **Demucs**.

---

## Início rápido

Para começar a usar o Open Song em seu computador:

```bash
git clone https://github.com/mathmorato/open-song.git
cd open-song
python -m venv .venv
```

**Ativação no Windows:**
```cmd
.venv\Scripts\activate
```

**Linux / macOS:**
```bash
source .venv/bin/activate
```

**Instalação das dependências:**
```bash
pip install -r local-processor/requirements.txt
```

**Iniciar o processador local:**
```bash
cd local-processor
python server.py
```
*(No Windows, você também pode simplesmente dar duplo clique em `start.bat`)*

**Abrir a interface:**
Acesse [https://mathmorato.github.io/open-song/](https://mathmorato.github.io/open-song/) ou execute localmente:
```bash
python -m http.server 8080
```
e acesse `http://127.0.0.1:8080`.

---

## Arquitetura: GitHub Pages + Processador Local

```text
Browser (Você)
   │
   │ HTTPS
   ▼
GitHub Pages (https://mathmorato.github.io/open-song/)
   │
   │ JavaScript (Fetch / CORS)
   ▼
localhost (http://127.0.0.1:8765)
   │
   ▼
Open Song Local Processor (Python)
   │
   ▼
Demucs AI (htdemucs)
   │
   ▼
Stems de Áudio (Vocals, Drums, Bass, Other)
```

> [!IMPORTANT]
> **O GitHub Pages hospeda apenas a interface estática.**
> O GitHub Pages **não executa** Python nem Demucs em servidores remotos. Todo o processamento de áudio é executado com total privacidade no próprio computador do usuário através do **Open Song Local Processor**.

### A melhor experiência (Modo Oficial)
1. Instale o Open Song Local Processor uma única vez no seu computador.
2. Mantenha o processador executando (`start.bat` ou `server.py`).
3. Abra o Open Song pelo **GitHub Pages**.
4. A página detectará automaticamente o processador em `http://127.0.0.1:8765`.
5. Selecione suas músicas e separe as faixas sem precisar atualizar o código da interface.

---

## Requisitos do Sistema

- **Python 3.10 ou superior**
- **Git**
- **FFmpeg** (adicionado ao PATH do sistema)
- **Demucs** (`pip install -r local-processor/requirements.txt`)

---

## Instalação do FFmpeg

O Demucs necessita do FFmpeg para converter e extrair os formatos de áudio (MP3, FLAC, OGG, WAV).

### Windows
Instalação rápida via Windows Package Manager:
```cmd
winget install Gyan.FFmpeg
```
Ou baixe a versão oficial compactada em [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html) e adicione a pasta `bin` às Variáveis de Ambiente (`PATH`).

### macOS
Via [Homebrew](https://brew.sh/):
```bash
brew install ffmpeg
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install ffmpeg
```

Para validar a instalação do FFmpeg em qualquer sistema:
```bash
ffmpeg -version
```

---

## Teste Direto do Demucs

Antes de utilizar a interface gráfica, você pode validar se o Demucs está funcionando corretamente com o comando:

**No Windows:**
```cmd
python -m demucs.separate -n htdemucs arquivo.mp3
```

**No Linux / macOS:**
```bash
python3 -m demucs.separate -n htdemucs arquivo.mp3
```

Se o Demucs iniciar o download do modelo e começar a separação, o seu ambiente está 100% pronto!

---

## Primeiro Teste Completo Passo a Passo

1. Instale o Python 3.10+.
2. Crie o ambiente virtual (`python -m venv .venv`).
3. Ative o ambiente virtual.
4. Instale as dependências (`pip install -r local-processor/requirements.txt`).
5. Instale o FFmpeg e confirme com `ffmpeg -version`.
6. Valide o Demucs com um arquivo de teste.
7. Inicie o processador local (`local-processor/start.bat` ou `python local-processor/server.py`).
8. Abra o Open Song pelo navegador (GitHub Pages ou servidor local).
9. Arraste ou selecione uma música (MP3, WAV, FLAC ou OGG).
10. Clique em **Separar faixas**.
11. Acompanhe a barra de progresso em tempo real.
12. Use o **Player** e a **Mesa de Mixagem** para ouvir cada stem sincronizado (Vocals, Drums, Bass, Other), ajustar volumes, usar **Mute** ou **Solo**, e baixar as faixas em WAV ou ZIP!

---

## Recursos da Plataforma

- **Player Sincronizado Multi-Faixa**: Todas as faixas iniciam, pausam e buscam posições temporais juntas sem drift de áudio via Web Audio API.
- **Comparador Original**: Ouça a música original e compare instantaneamente com os stems separados.
- **Mesa de Mixagem**: Sliders de volume individuais, botões de **Mute** e **Solo** independentes.
- **Exportação de Mix**: Crie um novo arquivo WAV combinando os stems com os volumes que você ajustou.
- **Downloads Flexíveis**: Baixe faixas individuais, baixe as faixas selecionadas em arquivo `.zip`, ou baixe todas de uma vez.
- **Privacidade Total**: Seus arquivos nunca saem da sua máquina para nuvens terceiras.
- **Modo Dark e Light**: Interface moderna estilo estúdio/DAW com line icons limpos e alto contraste.
- **Histórico Local**: Acesso rápido a separações recentes salvas no navegador.

---

## Estrutura do Projeto

```text
open-song/
├── index.html                  # Interface estática compatível com GitHub Pages
├── README.md                   # Documentação oficial completa
├── LICENSE                     # Licença MIT
├── requirements.txt            # Dependências Python na raiz
├── .gitignore                  # Arquivos ignorados pelo Git
│
├── assets/
│   ├── logo/
│   │   └── logo.svg            # Logo vetorial oficial
│   └── icons/
│       └── icons.svg           # Sprite de line icons SVG
│
├── css/
│   ├── app.css                 # Design system, temas dark/light, modais e layout
│   ├── player.css              # Player global, timelines e scrubber
│   ├── mixer.css               # Mesa de mixagem, faders e botões de canal
│   ├── stems.css               # Cards de faixas individuais e acentos de cores
│   └── responsive.css          # Adaptações para mobile e tablets
│
├── js/
│   ├── config.js               # Configuração central e URL do processador local
│   ├── storage.js              # Abstração de armazenamento local (localStorage)
│   ├── api.js                  # Cliente HTTP REST com suporte a CORS
│   ├── ui.js                   # Estados da interface, modais e notificações
│   ├── audio-player.js         # Player da faixa original e comparador
│   ├── audio-mixer.js          # Motor Web Audio multi-faixa rigorosamente sincronizado
│   ├── stem-manager.js         # Gerenciamento dinâmico dos cards de faixas
│   ├── downloader.js           # Gerenciador de downloads e pacotes ZIP
│   ├── exporter.js             # Exportador de mix personalizado
│   ├── history.js              # Histórico local de separações
│   ├── processor.js            # Ciclo de vida dos jobs de separação
│   └── app.js                  # Ponto de entrada da aplicação
│
├── local-processor/
│   ├── server.py               # Servidor HTTP local com streaming Range e CORS
│   ├── processor.py            # Motor Python que executa o Demucs de forma segura
│   ├── requirements.txt        # Dependências do processador
│   ├── start.bat               # Inicializador para Windows
│   ├── start.sh                # Inicializador para Linux e macOS
│   └── README.md               # Documentação focada do processador local
│
├── input/                      # Diretório de áudios recebidos para processamento
└── output/                     # Diretório de stems e mixes gerados
```

---

## Publicação no GitHub Pages

Para disponibilizar o frontend via GitHub Pages no seu repositório:
1. Faça o fork ou clone deste repositório para sua conta no GitHub.
2. Abra a página do repositório no GitHub e vá em **Settings**.
3. No menu lateral, acesse **Pages**.
4. Em **Build and deployment**, selecione a branch `main` e a pasta `/ (root)`.
5. Clique em **Save**.
6. Aguarde alguns minutos até a publicação. A URL será disponibilizada (ex: `https://mathmorato.github.io/open-song/`).
7. Pronto! A partir daí você só precisa iniciar o `local-processor` no seu computador e usar o site.

---

## Solução de Problemas (Troubleshooting)

### Demucs não encontrado
* Certifique-se de que ativou o ambiente virtual (`.venv\Scripts\activate` no Windows ou `source .venv/bin/activate` no Linux/Mac).
* Execute `pip install -r local-processor/requirements.txt`.

### FFmpeg não encontrado
* Verifique digitando `ffmpeg -version` no terminal. Se não for reconhecido, certifique-se de que a pasta onde o executável foi instalado consta no `PATH` do sistema e reinicie o terminal.

### Processador local desconectado
* Certifique-se de ter iniciado o processador via `start.bat` ou executando `python local-processor/server.py`.
* Abra no navegador o endereço `http://127.0.0.1:8765/health`. Se responder um JSON com `"status": "ok"`, o servidor está ativo.
* Se estiver usando uma porta diferente de `8765`, ajuste a URL no menu de **Configurações** na interface do Open Song.

### O GitHub Pages abre, mas não separa a música
* Lembre-se: o GitHub Pages hospeda apenas a interface visual. O processador local precisa estar rodando no seu computador para executar os cálculos de IA.

---

## Licenças

- **Open Song**: Licença MIT.
- **Demucs**: Licença MIT (Copyright © Meta Platforms, Inc. e afiliados).
- **Basic Pitch**: Licença Apache 2.0 (Spotify).
- **FFmpeg**: Licença LGPL/GPL (dependendo dos codecs habilitados).
