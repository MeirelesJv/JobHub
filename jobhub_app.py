"""
JobHub — painel de controle local.

Sobe/derruba o docker compose do projeto com um clique, mostra o log e
minimiza pra bandeja do Windows. Empacotado como .exe standalone via
PyInstaller — quem só usa o app não precisa ter Python instalado.
"""
import os
import sys
import time
import queue
import threading
import subprocess
import urllib.request
import webbrowser
from pathlib import Path

import customtkinter as ctk
import pystray
from PIL import Image, ImageDraw, ImageFont

APP_URL = "http://localhost:3000"
IMAGE_TAG = "jobhub-backend"
POLL_TIMEOUT_TICKS = 90  # 90 * 2s = 3 min

if getattr(sys, "frozen", False):
    SCRIPT_DIR = Path(sys.executable).resolve().parent
else:
    SCRIPT_DIR = Path(__file__).resolve().parent

CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0

events: "queue.Queue[tuple]" = queue.Queue()


# ─── Docker helpers ──────────────────────────────────────────────────────────

def _run_streaming(cmd: list[str]) -> int:
    proc = subprocess.Popen(
        cmd, cwd=SCRIPT_DIR,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1, creationflags=CREATE_NO_WINDOW,
    )
    for line in proc.stdout:
        line = line.rstrip()
        if line:
            events.put(("log", line))
    proc.wait()
    return proc.returncode


def _docker_running() -> bool:
    try:
        r = subprocess.run(
            ["docker", "info"], cwd=SCRIPT_DIR,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=CREATE_NO_WINDOW, timeout=15,
        )
        return r.returncode == 0
    except Exception:
        return False


def _image_built() -> bool:
    try:
        r = subprocess.run(
            ["docker", "images", "-q", IMAGE_TAG], cwd=SCRIPT_DIR,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, creationflags=CREATE_NO_WINDOW, timeout=15,
        )
        return bool(r.stdout.strip())
    except Exception:
        return False


def site_online() -> bool:
    try:
        with urllib.request.urlopen(APP_URL, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def start_worker():
    events.put(("status", "Verificando Docker...", "orange"))
    if not _docker_running():
        events.put(("log", "Docker Desktop não está rodando. Abra o Docker Desktop e tente de novo."))
        events.put(("status", "Docker Desktop fechado", "red"))
        events.put(("idle",))
        return

    if _image_built():
        events.put(("log", "Subindo containers..."))
        cmd = ["docker", "compose", "up", "-d"]
    else:
        events.put(("log", "Primeira vez neste computador — construindo imagens (pode levar alguns minutos)..."))
        cmd = ["docker", "compose", "up", "-d", "--build"]

    events.put(("status", "Iniciando...", "orange"))
    code = _run_streaming(cmd)

    if code != 0:
        events.put(("log", f"Falha ao subir os containers (código {code})."))
        events.put(("status", "Erro ao iniciar", "red"))
        events.put(("idle",))
        return

    events.put(("log", "Containers no ar. Aguardando o site responder..."))
    events.put(("status", "Aguardando site...", "orange"))

    for _ in range(POLL_TIMEOUT_TICKS):
        if site_online():
            events.put(("log", f"JobHub online em {APP_URL}"))
            events.put(("status", f"Online — {APP_URL}", "green"))
            events.put(("online",))
            return
        time.sleep(2)

    events.put(("log", "Demorou mais que o esperado. Tente 'Abrir no navegador' manualmente ou confira os logs."))
    events.put(("status", "Demorando...", "orange"))
    events.put(("running",))


def stop_worker():
    events.put(("status", "Parando...", "orange"))
    events.put(("log", "Parando o JobHub..."))
    _run_streaming(["docker", "compose", "down"])
    events.put(("log", "JobHub parado."))
    events.put(("status", "Parado", "gray"))
    events.put(("stopped",))


# ─── Ícone da bandeja ────────────────────────────────────────────────────────

def make_icon_image() -> Image.Image:
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((2, 2, size - 2, size - 2), radius=16, fill=(37, 99, 235, 255))
    try:
        font = ImageFont.truetype("segoeuib.ttf", 34)
    except Exception:
        font = ImageFont.load_default()
    text = "J"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1]), text, fill="white", font=font)
    return img


# ─── App ─────────────────────────────────────────────────────────────────────

class JobHubApp:
    STATUS_COLORS = {
        "orange": "#f59e0b",
        "green": "#22c55e",
        "red": "#ef4444",
        "gray": "#9ca3af",
    }

    def __init__(self):
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.root = ctk.CTk()
        self.root.title("JobHub")
        self.root.geometry("560x460")
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close_request)
        self.root.bind("<Unmap>", self._on_unmap)

        self.running = False
        self.busy = False
        self._closing = False

        self._build_ui()
        self._build_tray()

        self.root.after(150, self._poll_events)
        self.root.after(300, self._check_initial_state)

    # -- UI --------------------------------------------------------------

    def _build_ui(self):
        header = ctk.CTkFrame(self.root, fg_color="transparent")
        header.pack(fill="x", padx=24, pady=(24, 8))

        ctk.CTkLabel(header, text="JobHub", font=ctk.CTkFont(size=22, weight="bold")).pack(side="left")

        self.status_label = ctk.CTkLabel(
            self.root, text="Parado", font=ctk.CTkFont(size=15, weight="bold"),
            text_color=self.STATUS_COLORS["gray"],
        )
        self.status_label.pack(anchor="w", padx=24, pady=(0, 12))

        btn_row = ctk.CTkFrame(self.root, fg_color="transparent")
        btn_row.pack(fill="x", padx=24)

        self.btn_toggle = ctk.CTkButton(
            btn_row, text="Iniciar sistema", height=40, width=170,
            corner_radius=10, command=self.on_toggle,
        )
        self.btn_toggle.pack(side="left")

        self.btn_open = ctk.CTkButton(
            btn_row, text="Abrir no navegador", height=40, width=170,
            corner_radius=10, fg_color="transparent", border_width=1,
            command=lambda: webbrowser.open(APP_URL), state="disabled",
        )
        self.btn_open.pack(side="left", padx=(10, 0))

        ctk.CTkLabel(
            self.root,
            text="Fechar esta janela minimiza para a bandeja — o JobHub continua rodando.",
            font=ctk.CTkFont(size=11), text_color="#9ca3af",
        ).pack(anchor="w", padx=24, pady=(10, 8))

        self.log_box = ctk.CTkTextbox(
            self.root, height=250, corner_radius=10,
            font=ctk.CTkFont(family="Consolas", size=11),
        )
        self.log_box.pack(fill="both", expand=True, padx=24, pady=(0, 24))
        self.log_box.configure(state="disabled")

    def _build_tray(self):
        icon_img = make_icon_image()
        menu = pystray.Menu(
            pystray.MenuItem("Abrir janela", lambda: events.put(("cmd", "show")), default=True),
            pystray.MenuItem("Abrir no navegador", lambda: events.put(("cmd", "open"))),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Iniciar sistema", lambda: events.put(("cmd", "start"))),
            pystray.MenuItem("Parar sistema", lambda: events.put(("cmd", "stop"))),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Sair", lambda: events.put(("cmd", "exit"))),
        )
        self.tray = pystray.Icon("jobhub", icon_img, "JobHub — parado", menu)
        threading.Thread(target=self.tray.run, daemon=True).start()

    # -- ações -------------------------------------------------------------

    def on_toggle(self):
        if self.busy:
            return
        if self.running:
            self.do_stop()
        else:
            self.do_start()

    def do_start(self):
        self.busy = True
        self.btn_toggle.configure(state="disabled")
        self.append_log("Clicou em Iniciar sistema.")
        threading.Thread(target=start_worker, daemon=True).start()

    def do_stop(self):
        self.busy = True
        self.btn_toggle.configure(state="disabled")
        self.btn_open.configure(state="disabled")
        threading.Thread(target=stop_worker, daemon=True).start()

    def show_window(self):
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()

    def _on_unmap(self, event):
        # Disparado ao minimizar a janela (ou ao escondê-la, o que gera o mesmo evento).
        # Só reagimos quando é o próprio root minimizando de verdade — daí escondemos
        # da barra de tarefas também, então "minimizar" = ir pra bandeja.
        if event.widget is self.root and self.root.state() == "iconic":
            self.root.withdraw()
            try:
                self.tray.notify("Continua rodando em segundo plano. Use o ícone da bandeja pra abrir de novo.", "JobHub")
            except Exception:
                pass

    def on_close_request(self):
        # Botão X: fecha de verdade — garante que os containers são derrubados
        # (docker compose down) antes de encerrar o app, mesmo que nada esteja rodando.
        if self._closing:
            return
        if self.busy:
            self.append_log("Aguarde a operação atual terminar antes de fechar.")
            return
        self._closing = True
        self.btn_toggle.configure(state="disabled")
        self.btn_open.configure(state="disabled")
        self.append_log("Fechando o JobHub — parando os containers (docker compose down)...")
        self.set_status("Parando...", "orange")
        threading.Thread(target=stop_worker, daemon=True).start()

    def exit_app(self):
        try:
            self.tray.stop()
        except Exception:
            pass
        self.root.after(0, self.root.destroy)

    # -- log / status --------------------------------------------------------

    def append_log(self, text: str):
        self.log_box.configure(state="normal")
        self.log_box.insert("end", text + "\n")
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def set_status(self, text: str, color_key: str):
        color = self.STATUS_COLORS.get(color_key, self.STATUS_COLORS["gray"])
        self.status_label.configure(text=text, text_color=color)
        try:
            self.tray.title = f"JobHub — {text}"
        except Exception:
            pass

    def _check_initial_state(self):
        def check():
            if site_online():
                events.put(("log", "JobHub já estava rodando."))
                events.put(("status", f"Online — {APP_URL}", "green"))
                events.put(("online",))
            else:
                events.put(("log", "Clique em 'Iniciar sistema' para subir o JobHub."))
        threading.Thread(target=check, daemon=True).start()

    # -- fila de eventos (thread worker/tray -> thread da UI) ---------------

    def _poll_events(self):
        try:
            while True:
                item = events.get_nowait()
                kind = item[0]

                if kind == "log":
                    self.append_log(item[1])
                elif kind == "status":
                    self.set_status(item[1], item[2])
                elif kind == "idle":
                    self.busy = False
                    self.btn_toggle.configure(state="normal", text="Iniciar sistema")
                    self.running = False
                elif kind == "online":
                    self.busy = False
                    self.running = True
                    self.btn_toggle.configure(state="normal", text="Parar sistema")
                    self.btn_open.configure(state="normal")
                elif kind == "running":
                    self.busy = False
                    self.running = True
                    self.btn_toggle.configure(state="normal", text="Parar sistema")
                    self.btn_open.configure(state="normal")
                elif kind == "stopped":
                    self.busy = False
                    self.running = False
                    if self._closing:
                        self.exit_app()
                        return
                    self.btn_toggle.configure(state="normal", text="Iniciar sistema")
                    self.btn_open.configure(state="disabled")
                elif kind == "cmd":
                    action = item[1]
                    if action == "show":
                        self.show_window()
                    elif action == "open":
                        webbrowser.open(APP_URL)
                    elif action == "start":
                        self.show_window()
                        if not self.running and not self.busy:
                            self.do_start()
                    elif action == "stop":
                        self.show_window()
                        if self.running and not self.busy:
                            self.do_stop()
                    elif action == "exit":
                        self.exit_app()
                        return
        except queue.Empty:
            pass
        self.root.after(150, self._poll_events)

    def run(self):
        self.root.mainloop()


def main():
    JobHubApp().run()


if __name__ == "__main__":
    main()
