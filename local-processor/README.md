# Open Song Local Processor

O **Open Song Local Processor** é o componente de backend em Python responsável por executar o processamento de áudio via inteligência artificial com o **Demucs** diretamente no seu computador.

---

## Recursos da API

- `GET /health`: Informa status de execução e verificação de dependências (Demucs e FFmpeg).
- `POST /separate`: Recebe áudio via upload multipart ou binário e enfileira a separação em stems.
- `GET /status/{job_id}`: Retorna o progresso em tempo real (0 a 100%) e status do job.
- `POST /cancel/{job_id}`: Interrompe com segurança o subprocesso do Demucs e limpa arquivos temporários.
- `GET /stems/{job_id}`: Lista as faixas geradas e seus metadados.
- `GET /download/{job_id}/{stem}`: Faz streaming com suporte a Range requests (para reprodução contínua) ou download direto.
- `GET /download-zip/{job_id}`: Compacta todas as faixas ou faixas selecionadas em um arquivo `.zip`.
- `POST /export`: Gera um novo arquivo WAV mixado de acordo com os níveis de volume e mute especificados.

---

## Como Iniciar

### No Windows:
Basta clicar duas vezes em `start.bat` ou executar via terminal:
```cmd
start.bat
```

### No Linux / macOS:
Dê permissão de execução e inicie:
```bash
chmod +x start.sh
./start.sh
```

### Execução Manual:
```bash
# Com o ambiente virtual ativado:
pip install -r requirements.txt
python server.py
```

O servidor iniciará em `http://127.0.0.1:8765`.
