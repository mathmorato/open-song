"""
Open Song - Local Audio Processor Engine
Versão: v.1.0.2
Gerencia a fila de separação de áudio, execução segura do Demucs,
monitoramento de progresso e exportação de stems.
"""

import os
import sys
import re
import time
import shutil
import logging
import threading
import subprocess
import wave
import struct
from pathlib import Path
from typing import Dict, Any, Optional, List

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("open_song_processor")

SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg"}

def find_files(directory: str, extensions: set = SUPPORTED_EXTENSIONS) -> List[str]:
    """
    Descobre recursivamente arquivos de áudio suportados dentro de um diretório.
    Preserva a lógica conceitual de descoberta do projeto de referência.
    """
    matches = []
    for root, _, files in os.walk(directory):
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in extensions:
                matches.append(os.path.join(root, file))
    return sorted(matches)

class AudioJob:
    def __init__(self, job_id: str, original_filename: str, input_path: str, output_dir: str, options: dict):
        self.job_id = job_id
        self.original_filename = original_filename
        self.input_path = input_path
        self.output_dir = output_dir
        self.options = options
        self.status = "queued"  # queued, processing, completed, failed, cancelled
        self.progress = 0
        self.message = "Aguardando na fila..."
        self.error: Optional[str] = None
        self.created_at = time.time()
        self.updated_at = time.time()
        self.process: Optional[subprocess.Popen] = None
        self.stems: List[Dict[str, Any]] = []

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "filename": self.original_filename,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "stems": self.stems,
        }

class DemucsProcessor:
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir).resolve()
        self.input_dir = self.base_dir / "input"
        self.output_dir = self.base_dir / "output"
        self.input_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.jobs: Dict[str, AudioJob] = {}
        self.lock = threading.Lock()
        self.worker_thread: Optional[threading.Thread] = None
        self.queue_semaphore = threading.Semaphore(0)
        self.job_queue: List[str] = []
        self.running = True

        # Inicia worker em segundo plano
        self.worker_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.worker_thread.start()

    def get_python_runner(self) -> str:
        """
        Retorna o executável Python a ser utilizado para rodar o Demucs.
        Se existir um .venv na raiz do projeto ou no diretório local-processor, prioriza o venv.
        """
        candidates = [
            self.base_dir / ".venv" / "Scripts" / "python.exe",
            self.base_dir / ".venv" / "bin" / "python",
            self.base_dir / "local-processor" / ".venv" / "Scripts" / "python.exe",
            self.base_dir / "local-processor" / ".venv" / "bin" / "python"
        ]
        for c in candidates:
            if c.is_file():
                return str(c)
        return sys.executable

    def check_demucs_installed(self) -> bool:
        """Verifica se o pacote demucs está acessível no ambiente Python virtual ou atual."""
        try:
            python_bin = self.get_python_runner()
            cmd = [python_bin, "-c", "import demucs"]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=12)
            return res.returncode == 0
        except Exception:
            return False

    def check_ffmpeg_installed(self) -> bool:
        """Verifica se o binário ffmpeg está acessível no PATH ou em diretórios conhecidos (ex: winget)."""
        if shutil.which("ffmpeg") is not None:
            return True
        # Verifica locais comuns de instalação no Windows (ex: winget Gyan.FFmpeg)
        if os.name == "nt":
            local_app_data = os.environ.get("LOCALAPPDATA", "")
            program_files = os.environ.get("ProgramFiles", "")
            winget_locs = [
                Path(local_app_data) / "Microsoft" / "WinGet" / "Packages",
                Path(program_files) / "FFmpeg" / "bin",
            ]
            for loc in winget_locs:
                if loc.is_dir():
                    matches = list(loc.glob("**/ffmpeg.exe"))
                    if matches:
                        ffmpeg_dir = str(matches[0].parent)
                        os.environ["PATH"] = f"{ffmpeg_dir};{os.environ.get('PATH', '')}"
                        return True
        return False

    def create_job(self, original_filename: str, file_bytes: bytes, options: dict) -> AudioJob:
        """Cria um novo job de processamento, salva o arquivo de entrada e enfileira."""
        import uuid
        job_id = uuid.uuid4().hex[:12]
        
        # Sanitiza nome do arquivo
        clean_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', original_filename)
        if not clean_name:
            clean_name = "audio.wav"
            
        job_input_dir = self.input_dir / job_id
        job_output_dir = self.output_dir / job_id
        job_input_dir.mkdir(parents=True, exist_ok=True)
        job_output_dir.mkdir(parents=True, exist_ok=True)
        
        input_path = job_input_dir / clean_name
        with open(input_path, "wb") as f:
            f.write(file_bytes)

        job = AudioJob(
            job_id=job_id,
            original_filename=original_filename,
            input_path=str(input_path),
            output_dir=str(job_output_dir),
            options=options
        )

        with self.lock:
            self.jobs[job_id] = job
            self.job_queue.append(job_id)
            self.queue_semaphore.release()

        logger.info(f"Job {job_id} criado para '{original_filename}'. Fila: {len(self.job_queue)}")
        return job

    def get_job(self, job_id: str) -> Optional[AudioJob]:
        with self.lock:
            job = self.jobs.get(job_id)
            if job:
                return job

        # Tenta recuperar job já concluído persistido em output/job_id
        target_dir = self.output_dir / job_id
        if target_dir.is_dir():
            job = AudioJob(
                job_id=job_id,
                original_filename=f"track_{job_id}",
                input_path="",
                output_dir=str(target_dir),
                options={}
            )
            stems = self._discover_stems(job, "htdemucs")
            if stems:
                job.stems = stems
                job.status = "completed"
                job.progress = 100
                job.message = f"Faixas carregadas do disco ({len(stems)} stems)."
                with self.lock:
                    self.jobs[job_id] = job
                return job
        return None

    def cancel_job(self, job_id: str) -> bool:
        """Cancela um job em andamento ou remove da fila."""
        with self.lock:
            job = self.jobs.get(job_id)
            if not job:
                return False
                
            if job.status in ("completed", "cancelled", "failed"):
                return True
                
            job.status = "cancelled"
            job.message = "Processamento cancelado pelo usuário."
            job.updated_at = time.time()
            
            # Encerra subprocesso se estiver em execução
            if job.process:
                try:
                    self._kill_process_tree(job.process)
                    logger.info(f"Processo do Job {job_id} encerrado com sucesso.")
                except Exception as e:
                    logger.warning(f"Erro ao matar processo do Job {job_id}: {e}")

            # Limpa fila se ainda não iniciou
            if job_id in self.job_queue:
                self.job_queue.remove(job_id)

            return True

    def _kill_process_tree(self, proc: subprocess.Popen):
        """Mata o processo e sua árvore de filhos de forma cross-platform."""
        pid = proc.pid
        if os.name == 'nt':
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], 
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            try:
                import signal
                os.killpg(os.getpgid(pid), signal.SIGTERM)
            except Exception:
                proc.terminate()
                time.sleep(0.5)
                proc.kill()

    def _process_queue(self):
        """Worker contínuo que processa um job por vez."""
        while self.running:
            self.queue_semaphore.acquire()
            if not self.running:
                break
                
            job_id = None
            with self.lock:
                if self.job_queue:
                    job_id = self.job_queue.pop(0)
                    
            if not job_id:
                continue
                
            job = self.get_job(job_id)
            if not job or job.status == "cancelled":
                continue

            self._execute_separation(job)

    def _execute_separation(self, job: AudioJob):
        """Executa a separação propriamente dita chamando Demucs."""
        job.status = "processing"
        job.message = "Iniciando modelo Demucs..."
        job.progress = 5
        job.updated_at = time.time()
        logger.info(f"Iniciando separação para Job {job.job_id}")

        model = job.options.get("model", "htdemucs")
        shifts = str(job.options.get("shifts", 10))
        overlap = str(job.options.get("overlap", 0.25))
        
        # Validação de segurança dos parâmetros
        if not re.match(r'^[a-zA-Z0-9_-]+$', model):
            model = "htdemucs"
        try:
            float_overlap = float(overlap)
            if float_overlap <= 0 or float_overlap >= 1:
                overlap = "0.25"
        except ValueError:
            overlap = "0.25"

        python_bin = self.get_python_runner()

        # Validação preventiva de dependências antes de iniciar o processo
        if not self.check_demucs_installed():
            job.status = "failed"
            job.error = "O Demucs não está instalado no ambiente Python. Execute 'local-processor\\start.bat' ou rode 'pip install -r local-processor\\requirements.txt'."
            job.message = "Demucs não instalado."
            logger.error(f"Job {job.job_id}: {job.error}")
            return

        if not self.check_ffmpeg_installed():
            job.status = "failed"
            job.error = "O FFmpeg não foi encontrado no PATH do sistema. Instale o FFmpeg (ex: winget install Gyan.FFmpeg) para que o Demucs consiga processar o áudio."
            job.message = "FFmpeg não encontrado."
            logger.error(f"Job {job.job_id}: {job.error}")
            return

        cmd = [
            python_bin,
            "-m", "demucs.separate",
            "-n", model,
            "--shifts", shifts,
            "--overlap", overlap,
            "-o", job.output_dir,
            job.input_path
        ]

        logger.info(f"Comando Demucs seguro ({python_bin}): {' '.join(cmd)}")
        
        try:
            # Inicia o processo com pipe de saída
            job.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )

            # Regex para capturar porcentagem de barras de progresso (ex: 45%|...|)
            progress_pattern = re.compile(r'(\d+)%')
            captured_output = []

            if job.process.stdout:
                for line in iter(job.process.stdout.readline, ''):
                    if job.status == "cancelled":
                        break
                        
                    clean_line = line.strip()
                    if clean_line:
                        captured_output.append(clean_line)
                        if len(captured_output) > 20:
                            captured_output.pop(0)

                        match = progress_pattern.search(clean_line)
                        if match:
                            val = int(match.group(1))
                            # Escala 0 a 100 para o progresso do job (10% a 95%)
                            scaled = 10 + int(val * 0.85)
                            job.progress = min(max(scaled, 10), 95)
                            job.message = f"Processando faixas ({val}%)..."
                        elif "Separating track" in clean_line:
                            job.progress = max(job.progress, 15)
                            job.message = "Separando instrumentos..."
                        elif "Loading model" in clean_line:
                            job.progress = max(job.progress, 8)
                            job.message = "Carregando modelo de IA..."

                        job.updated_at = time.time()

            job.process.wait()
            return_code = job.process.returncode

            if job.status == "cancelled":
                logger.info(f"Job {job.job_id} foi cancelado.")
                return

            if return_code != 0:
                job.status = "failed"
                tail_err = "\n".join(captured_output[-3:]) if captured_output else ""
                job.error = f"O processo do Demucs encerrou com código {return_code}. {tail_err}".strip()
                job.message = "Falha no processamento."
                logger.error(f"Job {job.job_id} falhou com código {return_code}: {tail_err}")
                return

            # Coleta stems gerados
            stems = self._discover_stems(job, model)
            if not stems:
                job.status = "failed"
                job.error = "Processamento concluído, mas nenhuma faixa de áudio foi encontrada na pasta de saída."
                job.message = "Nenhum stem gerado."
                return

            job.stems = stems
            job.progress = 100
            job.status = "completed"
            job.message = f"Separação concluída! {len(stems)} faixas disponíveis."
            job.updated_at = time.time()
            logger.info(f"Job {job.job_id} concluído com sucesso. Stems: {[s['name'] for s in stems]}")

        except Exception as e:
            if job.status != "cancelled":
                job.status = "failed"
                job.error = f"Erro interno durante processamento: {str(e)}"
                job.message = "Erro inesperado."
                logger.exception(f"Erro ao processar Job {job.job_id}")
        finally:
            job.process = None

    def _discover_stems(self, job: AudioJob, model: str) -> List[Dict[str, Any]]:
        """Varre o diretório de saída do Demucs e mapeia os stems encontrados."""
        output_path = Path(job.output_dir)
        stems = []

        # Demucs normalmente gera: output_dir / model / track_basename / stem.wav
        found_audio_files = find_files(str(output_path), extensions={".wav", ".mp3", ".flac", ".ogg"})
        
        friendly_names = {
            "vocals": "Vocals",
            "drums": "Drums",
            "bass": "Bass",
            "other": "Other",
            "piano": "Piano",
            "guitar": "Guitar"
        }

        stem_icons = {
            "vocals": "mic",
            "drums": "disc",
            "bass": "activity",
            "other": "music"
        }

        for file_path_str in found_audio_files:
            file_path = Path(file_path_str)
            stem_key = file_path.stem.lower()
            name = friendly_names.get(stem_key, stem_key.capitalize())
            size = file_path.stat().st_size
            
            stems.append({
                "id": stem_key,
                "name": name,
                "icon": stem_icons.get(stem_key, "volume-2"),
                "filename": file_path.name,
                "path": str(file_path),
                "size": size,
                "size_formatted": self._format_size(size),
                "url": f"/download/{job.job_id}/{stem_key}"
            })

        # Ordena: Vocals, Drums, Bass, Other, e outros
        priority = {"vocals": 1, "drums": 2, "bass": 3, "other": 4}
        stems.sort(key=lambda x: priority.get(x["id"], 99))
        return stems

    def _format_size(self, bytes_size: int) -> str:
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes_size < 1024.0:
                return f"{bytes_size:.1f} {unit}"
            bytes_size /= 1024.0
        return f"{bytes_size:.1f} GB"

    def export_mix(self, job_id: str, mix_spec: List[dict]) -> Optional[str]:
        """
        Combina múltiplos stems WAV aplicando volumes e mute de forma pura com o módulo wave.
        Retorna o caminho relativo do arquivo exportado.
        """
        job = self.get_job(job_id)
        if not job or not job.stems:
            return None

        stem_map = {s["id"]: s["path"] for s in job.stems}
        
        # Filtra faixas ativas com seus respectivos ganhos
        active_tracks = []
        for item in mix_spec:
            stem_id = item.get("stem")
            volume = float(item.get("volume", 1.0))
            muted = bool(item.get("muted", False))
            
            if not muted and volume > 0 and stem_id in stem_map:
                active_tracks.append((stem_map[stem_id], volume))

        if not active_tracks:
            return None

        # Abre todos os arquivos wave de entrada
        wave_readers = []
        try:
            for path, vol in active_tracks:
                wr = wave.open(path, "rb")
                wave_readers.append((wr, vol))

            ref_reader, _ = wave_readers[0]
            nchannels = ref_reader.getnchannels()
            sampwidth = ref_reader.getsampwidth()
            framerate = ref_reader.getframerate()
            nframes = min(wr.getnframes() for wr, _ in wave_readers)

            export_filename = f"Export_Mix_{job_id}.wav"
            export_path = Path(job.output_dir) / export_filename

            out_wave = wave.open(str(export_path), "wb")
            out_wave.setnchannels(nchannels)
            out_wave.setsampwidth(sampwidth)
            out_wave.setframerate(framerate)

            # Processa em blocos para eficiência de memória
            chunk_size = 4096
            frames_left = nframes
            
            # Suporte a 16-bit PCM (formato padrão de Demucs)
            fmt = "<h" if sampwidth == 2 else "<i"
            max_val = 32767 if sampwidth == 2 else 2147483647
            min_val = -32768 if sampwidth == 2 else -2147483648

            while frames_left > 0:
                current_chunk = min(chunk_size, frames_left)
                samples_to_read = current_chunk * nchannels
                
                # Inicializa acumulador com zeros
                accumulated = [0.0] * samples_to_read

                for wr, vol in wave_readers:
                    raw_data = wr.readframes(current_chunk)
                    actual_read = len(raw_data) // sampwidth
                    if actual_read == 0:
                        continue
                    unpacked = struct.unpack(f"<{actual_read}{'h' if sampwidth==2 else 'i'}", raw_data)
                    for i in range(min(len(accumulated), actual_read)):
                        accumulated[i] += unpacked[i] * vol

                # Limita (clipping) e converte de volta para bytes
                packed_samples = bytearray()
                for sample in accumulated:
                    clamped = int(max(min(sample, max_val), min_val))
                    packed_samples.extend(struct.pack(fmt, clamped))

                out_wave.writeframes(packed_samples)
                frames_left -= current_chunk

            out_wave.close()
            return str(export_path)

        except Exception as e:
            logger.error(f"Erro ao exportar mix: {e}")
            return None
        finally:
            for wr, _ in wave_readers:
                try:
                    wr.close()
                except Exception:
                    pass

    def cleanup_old_jobs(self, max_age_hours: int = 24):
        """Remove jobs antigos e seus arquivos para liberar disco."""
        now = time.time()
        cutoff = now - (max_age_hours * 3600)
        with self.lock:
            to_remove = [jid for jid, j in self.jobs.items() if j.created_at < cutoff]
            for jid in to_remove:
                job = self.jobs.pop(jid, None)
                if job:
                    shutil.rmtree(job.input_path, ignore_errors=True)
                    shutil.rmtree(job.output_dir, ignore_errors=True)
                    logger.info(f"Job antigo {jid} limpo com sucesso.")
