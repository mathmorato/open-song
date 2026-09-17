"""
Open Song - Local Processor HTTP Server
Versão: v.1.0.0
Servidor HTTP leve baseado na biblioteca padrão do Python com suporte a CORS,
Range requests para streaming de áudio, upload multipart e empacotamento ZIP.
"""

import os
import sys
import json
import shutil
import zipfile
import mimetypes
import urllib.parse
from http import HTTPStatus
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from pathlib import Path
from processor import DemucsProcessor

VERSION = "v.1.0.1"
API_VERSION = "v1"
DEFAULT_PORT = 8765
DEFAULT_HOST = "127.0.0.1"

# Diretório base do projeto (raiz de open-song)
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent.resolve()

processor = DemucsProcessor(str(PROJECT_ROOT))

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class OpenSongRequestHandler(BaseHTTPRequestHandler):
    server_version = f"OpenSongServer/{VERSION}"

    def _set_cors_headers(self):
        """Configura os cabeçalhos de CORS permitindo conexões locais e do GitHub Pages."""
        origin = self.headers.get("Origin", "*")
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Range, X-Requested-With")
        self.send_header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Content-Disposition, Accept-Ranges")
        self.send_header("Access-Control-Allow-Credentials", "true")

    def do_OPTIONS(self):
        """Responde a requisições de pre-flight CORS."""
        self.send_response(HTTPStatus.OK)
        self._set_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _send_json(self, data: dict, status: int = 200):
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, message: str, status: int = 400):
        self._send_json({"status": "error", "message": message}, status=status)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. Health check
        if path == "/health" or path == "/api/v1/health":
            demucs_ok = processor.check_demucs_installed()
            ffmpeg_ok = processor.check_ffmpeg_installed()
            self._send_json({
                "status": "ok",
                "service": "open-song-local",
                "version": VERSION,
                "apiVersion": API_VERSION,
                "demucs_installed": demucs_ok,
                "ffmpeg_installed": ffmpeg_ok,
                "python_version": sys.version.split()[0]
            })
            return

        # 2. Status do job: /status/{job_id} ou /api/v1/status/{job_id}
        if path.startswith("/status/") or path.startswith("/api/v1/status/"):
            parts = [p for p in path.split("/") if p]
            job_id = parts[-1]
            job = processor.get_job(job_id)
            if not job:
                self._send_error(f"Job '{job_id}' não encontrado.", status=404)
                return
            self._send_json(job.to_dict())
            return

        # 3. Lista de stems: /stems/{job_id}
        if path.startswith("/stems/") or path.startswith("/api/v1/stems/"):
            parts = [p for p in path.split("/") if p]
            job_id = parts[-1]
            job = processor.get_job(job_id)
            if not job:
                self._send_error(f"Job '{job_id}' não encontrado.", status=404)
                return
            self._send_json({"job_id": job_id, "stems": job.stems})
            return

        # 4. Download / streaming de stem individual: /download/{job_id}/{stem_id}
        if path.startswith("/download/"):
            parts = [p for p in path.split("/") if p]
            if len(parts) >= 3:
                job_id = parts[1]
                stem_id = parts[2].lower()
                self._serve_stem_file(job_id, stem_id, query)
                return

        # 5. Download de arquivo ZIP com stems: /download-zip/{job_id}
        if path.startswith("/download-zip/"):
            parts = [p for p in path.split("/") if p]
            if len(parts) >= 2:
                job_id = parts[1]
                stems_filter = query.get("stems", [None])[0]
                self._serve_zip(job_id, stems_filter)
                return

        # 6. Download de mix exportado: /download-export/{job_id}
        if path.startswith("/download-export/"):
            parts = [p for p in path.split("/") if p]
            if len(parts) >= 2:
                job_id = parts[1]
                self._serve_export_file(job_id)
                return

        self._send_error("Endpoint não encontrado.", status=404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. Cancelamento: /cancel/{job_id}
        if path.startswith("/cancel/") or path.startswith("/api/v1/cancel/"):
            parts = [p for p in path.split("/") if p]
            job_id = parts[-1]
            success = processor.cancel_job(job_id)
            if success:
                self._send_json({"status": "cancelled", "job_id": job_id, "message": "Processo cancelado."})
            else:
                self._send_error(f"Job '{job_id}' não pôde ser cancelado ou não existe.", status=404)
            return

        # 2. Separação: /separate ou /api/v1/separate
        if path == "/separate" or path == "/api/v1/separate":
            self._handle_separate()
            return

        # 3. Exportação de Mix: /export ou /api/v1/export
        if path == "/export" or path == "/api/v1/export":
            self._handle_export()
            return

        self._send_error("Endpoint não encontrado.", status=404)

    def _handle_separate(self):
        content_type = self.headers.get("Content-Type", "")
        content_length = int(self.headers.get("Content-Length", 0))

        if content_length <= 0:
            self._send_error("Nenhum dado enviado.")
            return

        body = self.rfile.read(content_length)

        filename = "audio.wav"
        file_bytes = b""
        options = {
            "model": "htdemucs",
            "shifts": 10,
            "overlap": 0.25
        }

        # Parsing de multipart/form-data
        if "multipart/form-data" in content_type:
            try:
                boundary = content_type.split("boundary=")[1].strip()
                if boundary.startswith('"') and boundary.endswith('"'):
                    boundary = boundary[1:-1]
                boundary_bytes = ("--" + boundary).encode("ascii")
                parts = body.split(boundary_bytes)

                for part in parts:
                    if not part or part == b"--\r\n" or part == b"--":
                        continue
                    if b"\r\n\r\n" in part:
                        header_data, payload = part.split(b"\r\n\r\n", 1)
                        header_str = header_data.decode("utf-8", errors="ignore")
                        # Remove quebra final antes da fronteira
                        if payload.endswith(b"\r\n"):
                            payload = payload[:-2]

                        if 'name="file"' in header_str or 'filename=' in header_str:
                            file_bytes = payload
                            import re
                            fname_match = re.search(r'filename="([^"]+)"', header_str)
                            if fname_match:
                                filename = fname_match.group(1)
                        elif 'name="model"' in header_str:
                            options["model"] = payload.decode("utf-8", errors="ignore").strip()
                        elif 'name="shifts"' in header_str:
                            try:
                                options["shifts"] = int(payload.decode("utf-8", errors="ignore").strip())
                            except ValueError:
                                pass
                        elif 'name="overlap"' in header_str:
                            try:
                                options["overlap"] = float(payload.decode("utf-8", errors="ignore").strip())
                            except ValueError:
                                pass
            except Exception as e:
                self._send_error(f"Erro ao processar upload multipart: {str(e)}")
                return
        else:
            # Envio binário direto com cabeçalho X-Filename
            file_bytes = body
            hdr_fname = self.headers.get("X-Filename")
            if hdr_fname:
                filename = urllib.parse.unquote(hdr_fname)

        if not file_bytes:
            self._send_error("Nenhum arquivo de áudio recebido no upload.")
            return

        # Cria e enfileira job
        job = processor.create_job(filename, file_bytes, options)
        self._send_json({
            "status": "queued",
            "job_id": job.job_id,
            "filename": filename,
            "message": "Música recebida com sucesso. Processamento iniciado!"
        }, status=202)

    def _serve_stem_file(self, job_id: str, stem_id: str, query: dict):
        job = processor.get_job(job_id)
        if not job or not job.stems:
            self._send_error("Job ou stems não encontrados.", status=404)
            return

        target_stem = None
        for s in job.stems:
            if s["id"] == stem_id:
                target_stem = s
                break

        if not target_stem:
            self._send_error(f"Faixa '{stem_id}' não encontrada.", status=404)
            return

        file_path = Path(target_stem["path"])
        if not file_path.is_file():
            self._send_error("Arquivo de áudio não encontrado em disco.", status=404)
            return

        self._stream_audio_file(file_path, target_stem["filename"], query)

    def _serve_export_file(self, job_id: str):
        job = processor.get_job(job_id)
        if not job:
            self._send_error("Job não encontrado.", status=404)
            return

        export_path = Path(job.output_dir) / f"Export_Mix_{job_id}.wav"
        if not export_path.is_file():
            self._send_error("Mix exportado não encontrado.", status=404)
            return

        self._stream_audio_file(export_path, f"OpenSong_{job.original_filename}_Mix.wav", {"attachment": ["1"]})

    def _stream_audio_file(self, file_path: Path, download_name: str, query: dict):
        file_size = file_path.stat().st_size
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type:
            mime_type = "audio/wav"

        range_header = self.headers.get("Range")
        is_attachment = query.get("attachment", ["0"])[0] in ("1", "true")

        if range_header and range_header.startswith("bytes="):
            try:
                range_str = range_header.replace("bytes=", "")
                start_str, end_str = range_str.split("-")
                start = int(start_str) if start_str else 0
                end = int(end_str) if end_str else file_size - 1
                length = end - start + 1

                self.send_response(HTTPStatus.PARTIAL_CONTENT)
                self._set_cors_headers()
                self.send_header("Content-Type", mime_type)
                self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                self.send_header("Content-Length", str(length))
                self.send_header("Accept-Ranges", "bytes")
                if is_attachment:
                    self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
                self.end_headers()

                with open(file_path, "rb") as f:
                    f.seek(start)
                    bytes_remaining = length
                    while bytes_remaining > 0:
                        chunk = f.read(min(65536, bytes_remaining))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        bytes_remaining -= len(chunk)
                return
            except Exception:
                pass

        # Resposta completa (200 OK)
        self.send_response(HTTPStatus.OK)
        self._set_cors_headers()
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(file_size))
        self.send_header("Accept-Ranges", "bytes")
        if is_attachment:
            self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
        self.end_headers()

        with open(file_path, "rb") as f:
            shutil.copyfileobj(f, self.wfile, length=65536)

    def _serve_zip(self, job_id: str, stems_filter: str = None):
        job = processor.get_job(job_id)
        if not job or not job.stems:
            self._send_error("Job ou stems não encontrados.", status=404)
            return

        # Determina quais stems incluir
        selected_ids = None
        if stems_filter:
            selected_ids = set(s.strip().lower() for s in stems_filter.split(","))

        included_stems = [s for s in job.stems if selected_ids is None or s["id"] in selected_ids]
        if not included_stems:
            self._send_error("Nenhum stem corresponde aos filtros solicitados.", status=400)
            return

        base_clean = Path(job.original_filename).stem
        tag = "Selected" if selected_ids is not None else "Stems"
        zip_dir_name = f"OpenSong_{base_clean}_{tag}"
        zip_filename = f"{zip_dir_name}.zip"
        
        # Cria arquivo ZIP temporário
        zip_temp_path = Path(job.output_dir) / f"temp_{zip_filename}"
        try:
            with zipfile.ZipFile(str(zip_temp_path), "w", zipfile.ZIP_DEFLATED) as zf:
                for stem in included_stems:
                    src_path = Path(stem["path"])
                    if src_path.is_file():
                        arcname = f"{zip_dir_name}/{stem['filename']}"
                        zf.write(str(src_path), arcname=arcname)

            zip_size = zip_temp_path.stat().st_size

            self.send_response(HTTPStatus.OK)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Length", str(zip_size))
            self.send_header("Content-Disposition", f'attachment; filename="{zip_filename}"')
            self.end_headers()

            with open(zip_temp_path, "rb") as f:
                shutil.copyfileobj(f, self.wfile, length=65536)

        finally:
            if zip_temp_path.is_file():
                try:
                    zip_temp_path.unlink()
                except Exception:
                    pass

    def _handle_export(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            self._send_error("Corpo da requisição vazio.")
            return

        body_bytes = self.rfile.read(content_length)
        try:
            data = json.loads(body_bytes.decode("utf-8"))
        except Exception:
            self._send_error("JSON inválido.")
            return

        job_id = data.get("job_id")
        mix_spec = data.get("mix", [])

        if not job_id or not mix_spec:
            self._send_error("Campos 'job_id' e 'mix' são obrigatórios.")
            return

        export_path = processor.export_mix(job_id, mix_spec)
        if not export_path:
            self._send_error("Falha ao gerar a mixagem dos stems selecionados.")
            return

        self._send_json({
            "status": "ok",
            "job_id": job_id,
            "export_url": f"/download-export/{job_id}",
            "message": "Mixagem gerada com sucesso!"
        })

    def log_message(self, format, *args):
        # Log limpo
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

def run_server(host=DEFAULT_HOST, port=DEFAULT_PORT):
    server_address = (host, port)
    httpd = ThreadedHTTPServer(server_address, OpenSongRequestHandler)
    print("=" * 60)
    print(f"  OPEN SONG - LOCAL PROCESSOR ({VERSION})")
    print("=" * 60)
    print(f"  Servidor local em execução:")
    print(f"  -> http://{host}:{port}")
    print(f"  Verificação de saúde:")
    print(f"  -> http://{host}:{port}/health")
    print(f"  Demucs disponível: {'Sim' if processor.check_demucs_installed() else 'Não (instale via requirements.txt)'}")
    print(f"  FFmpeg disponível: {'Sim' if processor.check_ffmpeg_installed() else 'Não (necessário no PATH)'}")
    print("=" * 60)
    print("  Mantenha este terminal aberto enquanto utilizar o Open Song.")
    print("  Pressione Ctrl+C para encerrar.")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando Open Song Local Processor...")
        httpd.shutdown()

if __name__ == "__main__":
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port=port)
