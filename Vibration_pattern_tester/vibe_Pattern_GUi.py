import copy
import json
import math
import threading
import time
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    serial = None


# ─────────────────────────── Undo / Redo ───────────────────────────
class UndoManager:
    """points 리스트의 스냅샷 기반 Undo/Redo."""

    def __init__(self, max_history: int = 80):
        self._stack: list[list[dict]] = []
        self._redo: list[list[dict]] = []
        self._max = max_history

    def push(self, points: list[dict]):
        self._stack.append(copy.deepcopy(points))
        if len(self._stack) > self._max:
            self._stack.pop(0)
        self._redo.clear()

    def undo(self, current: list[dict]) -> list[dict] | None:
        if not self._stack:
            return None
        self._redo.append(copy.deepcopy(current))
        return self._stack.pop()

    def redo(self, current: list[dict]) -> list[dict] | None:
        if not self._redo:
            return None
        self._stack.append(copy.deepcopy(current))
        return self._redo.pop()

    def clear(self):
        self._stack.clear()
        self._redo.clear()

    @property
    def can_undo(self):
        return bool(self._stack)

    @property
    def can_redo(self):
        return bool(self._redo)


# ─────────────────────────── Main App ───────────────────────────
class RTPPatternEditor:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("DRV2605L RTP Pattern Editor")
        self.root.geometry("1200x780")
        self.root.minsize(980, 640)

        self.points: list[dict] = []  # [{"amp": int, "dur": int}]
        self.selected_index: int | None = None
        self.dragging_index: int | None = None
        self.drag_mode: str | None = None  # "amp" | "dur"
        self.drag_start_x: float | None = None
        self.drag_start_dur: int | None = None
        self.drag_start_total: int | None = None  # dur 드래그 안정화용

        self.play_thread: threading.Thread | None = None
        self.stop_flag = False
        self.ser = None

        # 재생 커서
        self._playback_t: float | None = None  # 현재 재생 시간 (ms)
        self._cursor_after_id = None

        # Undo
        self.undo_mgr = UndoManager()

        # 캔버스 마진
        self.margin_left = 50
        self.margin_right = 20
        self.margin_top = 20
        self.margin_bottom = 40

        # Zoom / Scroll
        self._zoom = 1.0       # 1.0 = 전체가 캔버스에 딱 맞음
        self._scroll_x = 0.0   # 스크롤 오프셋 (ms 단위)
        self._MIN_ZOOM = 1.0
        self._MAX_ZOOM = 20.0
        self._pan_start_x: float | None = None
        self._pan_start_scroll: float | None = None

        self._EDGE_GRAB_PX = 8

        self.build_ui()
        self.refresh_ports()

        # 키 바인딩
        self.root.bind("<Control-z>", lambda e: self.do_undo())
        self.root.bind("<Control-y>", lambda e: self.do_redo())
        self.root.bind("<Control-Z>", lambda e: self.do_redo())  # Ctrl+Shift+Z
        self.root.bind("<Delete>", lambda e: self.delete_selected())

        self.redraw_all()
        self.sync_table()

    # ═══════════════════════ UI 구성 ═══════════════════════
    def build_ui(self):
        container = ttk.Frame(self.root, padding=10)
        container.pack(fill="both", expand=True)

        left = ttk.Frame(container)
        left.pack(side="left", fill="both", expand=True)

        right = ttk.Frame(container, width=340)
        right.pack(side="right", fill="y", padx=(12, 0))
        right.pack_propagate(False)

        self.build_top_controls(left)
        self.build_canvas(left)
        self.build_bottom_controls(left)
        self.build_side_panel(right)

    def build_top_controls(self, parent):
        frame = ttk.LabelFrame(parent, text="Connection / Playback", padding=10)
        frame.pack(fill="x", pady=(0, 10))

        ttk.Label(frame, text="Port").grid(row=0, column=0, sticky="w")
        self.port_var = tk.StringVar()
        self.port_combo = ttk.Combobox(frame, textvariable=self.port_var, state="readonly", width=18)
        self.port_combo.grid(row=0, column=1, padx=6)

        ttk.Button(frame, text="Refresh", command=self.refresh_ports).grid(row=0, column=2, padx=4)
        ttk.Button(frame, text="Connect", command=self.connect_serial).grid(row=0, column=3, padx=4)
        ttk.Button(frame, text="Disconnect", command=self.disconnect_serial).grid(row=0, column=4, padx=4)

        ttk.Label(frame, text="Baud").grid(row=0, column=5, sticky="e", padx=(16, 0))
        self.baud_var = tk.StringVar(value="115200")
        ttk.Entry(frame, textvariable=self.baud_var, width=10).grid(row=0, column=6, padx=6)

        self.status_var = tk.StringVar(value="Disconnected")
        ttk.Label(frame, textvariable=self.status_var).grid(row=0, column=7, padx=(18, 0), sticky="w")

        ttk.Separator(frame, orient="horizontal").grid(row=1, column=0, columnspan=8, sticky="ew", pady=10)

        ttk.Label(frame, text="Loop count").grid(row=2, column=0, sticky="w")
        self.loop_var = tk.StringVar(value="1")
        ttk.Entry(frame, textvariable=self.loop_var, width=8).grid(row=2, column=1, sticky="w", padx=6)

        ttk.Button(frame, text="\u25b6 Play ESP32", command=self.play_pattern).grid(row=2, column=2, padx=4)
        ttk.Button(frame, text="\u25a0 Stop", command=self.stop_pattern).grid(row=2, column=3, padx=4)
        ttk.Button(frame, text="Preview", command=self.preview_summary).grid(row=2, column=4, padx=4)

    def build_canvas(self, parent):
        frame = ttk.LabelFrame(
            parent,
            text="Pattern Graph  [\uc88c\ud074\ub9ad=Amp\ub4dc\ub798\uadf8 | \uc6b0\uce21\ub05d=Dur\ub4dc\ub798\uadf8 | \uc6b0\ud074\ub9ad=\uc0ad\uc81c | \ub354\ube14\ud074\ub9ad=\uc0bd\uc785 | \ud720=\uc90c | \uc911\ud074\ub9ad/Shift+\ub4dc\ub798\uadf8=\ud32c]",
            padding=8,
        )
        frame.pack(fill="both", expand=True)

        self.canvas = tk.Canvas(frame, bg="#111111", highlightthickness=0, cursor="crosshair")
        self.canvas.pack(fill="both", expand=True)

        self.canvas.bind("<Button-1>", self.on_canvas_click)
        self.canvas.bind("<B1-Motion>", self.on_canvas_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_canvas_release)
        self.canvas.bind("<Button-3>", self.on_canvas_right_click)
        self.canvas.bind("<Double-Button-1>", self.on_canvas_double_click)
        self.canvas.bind("<Motion>", self.on_canvas_motion)
        # Zoom
        self.canvas.bind("<MouseWheel>", self.on_mouse_wheel)          # Windows/macOS
        self.canvas.bind("<Button-4>", lambda e: self.on_mouse_wheel_linux(e, 1))   # Linux up
        self.canvas.bind("<Button-5>", lambda e: self.on_mouse_wheel_linux(e, -1))  # Linux down
        # Pan (middle button)
        self.canvas.bind("<Button-2>", self.on_pan_start)
        self.canvas.bind("<B2-Motion>", self.on_pan_drag)
        self.canvas.bind("<ButtonRelease-2>", self.on_pan_end)
        # Shift + 좌클릭 드래그로도 팬
        self.canvas.bind("<Shift-Button-1>", self.on_pan_start)
        self.canvas.bind("<Shift-B1-Motion>", self.on_pan_drag)
        self.canvas.bind("<Shift-ButtonRelease-1>", self.on_pan_end)

    def build_bottom_controls(self, parent):
        frame = ttk.LabelFrame(parent, text="Quick Add / Tools", padding=10)
        frame.pack(fill="x", pady=(10, 0))

        ttk.Label(frame, text="Amplitude").grid(row=0, column=0, sticky="w")
        self.amp_var = tk.IntVar(value=120)
        ttk.Scale(frame, from_=0, to=255, orient="horizontal",
                  command=self.on_amp_slider, variable=self.amp_var, length=160).grid(row=0, column=1, padx=6)
        self.amp_label = ttk.Label(frame, text="120")
        self.amp_label.grid(row=0, column=2, sticky="w")

        ttk.Label(frame, text="Duration(ms)").grid(row=0, column=3, sticky="w", padx=(14, 0))
        self.dur_var = tk.IntVar(value=40)
        ttk.Scale(frame, from_=5, to=500, orient="horizontal",
                  command=self.on_dur_slider, variable=self.dur_var, length=160).grid(row=0, column=4, padx=6)
        self.dur_label = ttk.Label(frame, text="40")
        self.dur_label.grid(row=0, column=5, sticky="w")

        ttk.Button(frame, text="Add Point", command=self.add_point_from_controls).grid(row=0, column=6, padx=(16, 4))
        ttk.Button(frame, text="Insert After Sel", command=self.insert_after_selected).grid(row=0, column=7, padx=4)
        ttk.Button(frame, text="Delete Selected", command=self.delete_selected).grid(row=0, column=8, padx=4)

        ttk.Button(frame, text="Undo (Ctrl+Z)", command=self.do_undo).grid(row=1, column=0, columnspan=2, padx=4, pady=(10, 0), sticky="w")
        ttk.Button(frame, text="Redo (Ctrl+Y)", command=self.do_redo).grid(row=1, column=2, padx=4, pady=(10, 0), sticky="w")
        ttk.Button(frame, text="Zoom Fit", command=self.zoom_fit).grid(row=1, column=3, padx=4, pady=(10, 0))

        ttk.Button(frame, text="Smooth", command=self.smooth_points).grid(row=1, column=6, padx=4, pady=(10, 0))
        ttk.Button(frame, text="Normalize", command=self.normalize_points).grid(row=1, column=7, padx=4, pady=(10, 0))
        ttk.Button(frame, text="Clear", command=self.clear_points).grid(row=1, column=8, padx=4, pady=(10, 0))

    def build_side_panel(self, parent):
        frame = ttk.LabelFrame(parent, text="Pattern Data", padding=10)
        frame.pack(fill="both", expand=True)

        columns = ("idx", "amp", "dur", "t0", "t1")
        self.tree = ttk.Treeview(frame, columns=columns, show="headings", height=16)
        self.tree.heading("idx", text="#")
        self.tree.heading("amp", text="Amp")
        self.tree.heading("dur", text="Dur")
        self.tree.heading("t0", text="Start")
        self.tree.heading("t1", text="End")

        self.tree.column("idx", width=36, anchor="center")
        self.tree.column("amp", width=58, anchor="center")
        self.tree.column("dur", width=64, anchor="center")
        self.tree.column("t0", width=68, anchor="center")
        self.tree.column("t1", width=68, anchor="center")
        self.tree.pack(fill="both", expand=True)
        self.tree.bind("<<TreeviewSelect>>", self.on_tree_select)

        form = ttk.Frame(frame)
        form.pack(fill="x", pady=(10, 0))

        ttk.Label(form, text="Selected Amp").grid(row=0, column=0, sticky="w")
        self.sel_amp_var = tk.StringVar(value="")
        ttk.Entry(form, textvariable=self.sel_amp_var, width=10).grid(row=0, column=1, padx=6)

        ttk.Label(form, text="Selected Dur").grid(row=1, column=0, sticky="w", pady=(8, 0))
        self.sel_dur_var = tk.StringVar(value="")
        ttk.Entry(form, textvariable=self.sel_dur_var, width=10).grid(row=1, column=1, padx=6, pady=(8, 0))

        ttk.Button(form, text="Apply Edit", command=self.apply_selected_edit).grid(
            row=2, column=0, columnspan=2, sticky="ew", pady=(10, 0)
        )

        ttk.Separator(frame, orient="horizontal").pack(fill="x", pady=12)

        preset_frame = ttk.LabelFrame(frame, text="Presets", padding=8)
        preset_frame.pack(fill="x")
        for label, cmd in [
            ("Wave", self.load_preset_wave),
            ("Firework Launch", self.load_preset_firework_launch),
            ("Sparkle", self.load_preset_sparkle),
            ("Clap", self.load_preset_clap),
        ]:
            ttk.Button(preset_frame, text=label, command=cmd).pack(fill="x", pady=2)

        export_frame = ttk.LabelFrame(frame, text="Import / Export", padding=8)
        export_frame.pack(fill="x", pady=(12, 0))
        for label, cmd in [
            ("Save JSON", self.save_json),
            ("Load JSON", self.load_json),
            ("Copy C Array", self.copy_c_array),
            ("Copy Serial Lines", self.copy_serial_lines),
        ]:
            ttk.Button(export_frame, text=label, command=cmd).pack(fill="x", pady=2)

        self.summary_var = tk.StringVar(value="Points: 0 | Total: 0 ms")
        ttk.Label(frame, textvariable=self.summary_var).pack(anchor="w", pady=(12, 0))

    # ═══════════════════════ Undo / Redo ═══════════════════════
    def _save_undo(self):
        self.undo_mgr.push(self.points)

    def do_undo(self):
        prev = self.undo_mgr.undo(self.points)
        if prev is not None:
            self.points = prev
            self.selected_index = None
            self._clamp_scroll()
            self.redraw_all()
            self.sync_table()

    def do_redo(self):
        nxt = self.undo_mgr.redo(self.points)
        if nxt is not None:
            self.points = nxt
            self.selected_index = None
            self._clamp_scroll()
            self.redraw_all()
            self.sync_table()

    # ═══════════════════════ Serial ═══════════════════════
    def refresh_ports(self):
        ports = []
        if serial is not None:
            ports = [p.device for p in serial.tools.list_ports.comports()]
        self.port_combo["values"] = ports
        if ports and not self.port_var.get():
            self.port_var.set(ports[0])

    def connect_serial(self):
        if serial is None:
            messagebox.showerror("Missing dependency", "pyserial\uc774 \uc124\uce58\ub418\uc5b4 \uc788\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.\n\npip install pyserial")
            return
        port = self.port_var.get().strip()
        if not port:
            messagebox.showwarning("No port", "\uc2dc\ub9ac\uc5bc \ud3ec\ud2b8\ub97c \uc120\ud0dd\ud558\uc138\uc694.")
            return
        try:
            baud = int(self.baud_var.get().strip())
            self.ser = serial.Serial(port, baudrate=baud, timeout=1)
            time.sleep(1.0)
            self.status_var.set(f"Connected: {port}")
        except Exception as e:
            self.ser = None
            messagebox.showerror("Connection failed", str(e))

    def disconnect_serial(self):
        try:
            if self.ser and self.ser.is_open:
                self.ser.close()
        finally:
            self.ser = None
            self.status_var.set("Disconnected")

    def send_serial_line(self, line: str):
        if not self.ser or not self.ser.is_open:
            raise RuntimeError("ESP32\uac00 \uc5f0\uacb0\ub418\uc5b4 \uc788\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.")
        self.ser.write((line + "\n").encode("utf-8"))
        self.ser.flush()

    # ═══════════════════════ Playback ═══════════════════════
    def play_pattern(self):
        if not self.points:
            messagebox.showwarning("Empty pattern", "\ud328\ud134 \ud3ec\uc778\ud2b8\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.")
            return
        if not self.ser or not self.ser.is_open:
            messagebox.showwarning("Not connected", "\uba3c\uc800 ESP32 \uc2dc\ub9ac\uc5bc \uc5f0\uacb0\uc744 \ud574\uc8fc\uc138\uc694.")
            return
        if self.play_thread and self.play_thread.is_alive():
            messagebox.showinfo("Playing", "\uc774\ubbf8 \uc7ac\uc0dd \uc911\uc785\ub2c8\ub2e4.")
            return
        try:
            loops = max(1, int(self.loop_var.get().strip()))
        except ValueError:
            loops = 1
            self.loop_var.set("1")

        self.stop_flag = False
        self._playback_t = 0.0
        self._start_cursor_animation()
        self.play_thread = threading.Thread(target=self._play_worker, args=(loops,), daemon=True)
        self.play_thread.start()

    def _play_worker(self, loops: int):
        try:
            total = self.total_duration()
            for loop_i in range(loops):
                if self.stop_flag:
                    break
                t = 0.0
                for p in self.points:
                    if self.stop_flag:
                        break
                    amp = max(0, min(255, int(p["amp"])))
                    dur = max(1, int(p["dur"]))
                    self._playback_t = t + loop_i * total
                    self.send_serial_line(f"{amp} {dur}")
                    time.sleep(dur / 1000.0)
                    t += dur
            self.send_serial_line("0 20")
        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror("Playback error", str(e)))
        finally:
            self._playback_t = None
            self.root.after(0, self._stop_cursor_animation)
            self.root.after(0, lambda: self.status_var.set(
                "Connected" if self.ser and self.ser.is_open else "Disconnected"
            ))

    def stop_pattern(self):
        self.stop_flag = True
        self._playback_t = None
        try:
            if self.ser and self.ser.is_open:
                self.send_serial_line("0 20")
        except Exception:
            pass
        self._stop_cursor_animation()
        self.redraw_all()

    def preview_summary(self):
        total = self.total_duration()
        amps = [p["amp"] for p in self.points]
        if not amps:
            messagebox.showinfo("Preview", "\ud328\ud134\uc774 \ube44\uc5b4 \uc788\uc2b5\ub2c8\ub2e4.")
            return
        info = (
            f"\ud3ec\uc778\ud2b8 \uc218: {len(self.points)}\n"
            f"\ucd1d \uae38\uc774: {total} ms\n"
            f"\ucd5c\ub300 \uc9c4\ud3ed: {max(amps)}\n"
            f"\ud3c9\uade0 \uc9c4\ud3ed: {sum(amps)/len(amps):.1f}"
        )
        messagebox.showinfo("Pattern Summary", info)

    # ─── Playback Cursor Animation ───
    def _start_cursor_animation(self):
        self._stop_cursor_animation()
        self._tick_cursor()

    def _tick_cursor(self):
        self.redraw_all()
        if self._playback_t is not None:
            self._cursor_after_id = self.root.after(33, self._tick_cursor)  # ~30fps

    def _stop_cursor_animation(self):
        if self._cursor_after_id is not None:
            self.root.after_cancel(self._cursor_after_id)
            self._cursor_after_id = None

    # ═══════════════════════ Point Editing ═══════════════════════
    def add_point_from_controls(self):
        self._save_undo()
        amp = int(self.amp_var.get())
        dur = int(self.dur_var.get())
        self.points.append({"amp": amp, "dur": dur})
        self.selected_index = len(self.points) - 1
        self._clamp_scroll()
        self.redraw_all()
        self.sync_table()

    def insert_after_selected(self):
        self._save_undo()
        amp = int(self.amp_var.get())
        dur = int(self.dur_var.get())
        point = {"amp": amp, "dur": dur}
        if self.selected_index is None:
            self.points.append(point)
            self.selected_index = len(self.points) - 1
        else:
            self.points.insert(self.selected_index + 1, point)
            self.selected_index += 1
        self._clamp_scroll()
        self.redraw_all()
        self.sync_table()

    def delete_selected(self):
        if self.selected_index is None or not self.points:
            return
        self._save_undo()
        del self.points[self.selected_index]
        if self.selected_index >= len(self.points):
            self.selected_index = len(self.points) - 1 if self.points else None
        self._clamp_scroll()
        self.redraw_all()
        self.sync_table()

    def apply_selected_edit(self):
        if self.selected_index is None or self.selected_index >= len(self.points):
            return
        try:
            amp = max(0, min(255, int(self.sel_amp_var.get().strip())))
            dur = max(1, int(self.sel_dur_var.get().strip()))
        except ValueError:
            messagebox.showwarning("Invalid value", "\uc9c4\ud3ed\uacfc \uae38\uc774\ub294 \uc22b\uc790\ub85c \uc785\ub825\ud558\uc138\uc694.")
            return
        self._save_undo()
        self.points[self.selected_index] = {"amp": amp, "dur": dur}
        self._clamp_scroll()
        self.redraw_all()
        self.sync_table()

    def smooth_points(self):
        if len(self.points) < 3:
            return
        self._save_undo()
        new_pts = []
        for i, p in enumerate(self.points):
            if i == 0 or i == len(self.points) - 1:
                new_pts.append(dict(p))
            else:
                a = int(round((self.points[i - 1]["amp"] + p["amp"] + self.points[i + 1]["amp"]) / 3))
                d = int(round((self.points[i - 1]["dur"] + p["dur"] + self.points[i + 1]["dur"]) / 3))
                new_pts.append({"amp": a, "dur": max(1, d)})
        self.points = new_pts
        self.redraw_all()
        self.sync_table()

    def normalize_points(self):
        if not self.points:
            return
        mx = max(p["amp"] for p in self.points)
        if mx == 0:
            return
        self._save_undo()
        s = 255 / mx
        for p in self.points:
            p["amp"] = int(round(p["amp"] * s))
        self.redraw_all()
        self.sync_table()

    def clear_points(self):
        if not self.points:
            return
        self._save_undo()
        self.points.clear()
        self.selected_index = None
        self._zoom = 1.0
        self._scroll_x = 0.0
        self.redraw_all()
        self.sync_table()

    # ═══════════════════════ Presets ═══════════════════════
    def _load_preset(self, pts: list[dict]):
        self._save_undo()
        self.points = pts
        self.selected_index = None
        self._zoom = 1.0
        self._scroll_x = 0.0
        self.redraw_all()
        self.sync_table()

    def load_preset_wave(self):
        self._load_preset([
            {"amp": 20, "dur": 40}, {"amp": 40, "dur": 40}, {"amp": 70, "dur": 40},
            {"amp": 100, "dur": 40}, {"amp": 140, "dur": 40}, {"amp": 170, "dur": 50},
            {"amp": 140, "dur": 40}, {"amp": 100, "dur": 40}, {"amp": 70, "dur": 40},
            {"amp": 40, "dur": 40}, {"amp": 15, "dur": 60},
        ])

    def load_preset_firework_launch(self):
        self._load_preset([
            {"amp": 15, "dur": 25}, {"amp": 30, "dur": 25}, {"amp": 55, "dur": 25},
            {"amp": 90, "dur": 25}, {"amp": 135, "dur": 22}, {"amp": 180, "dur": 22},
            {"amp": 225, "dur": 18}, {"amp": 190, "dur": 18}, {"amp": 140, "dur": 20},
            {"amp": 0, "dur": 70},
        ])

    def load_preset_sparkle(self):
        self._load_preset([
            {"amp": 60, "dur": 18}, {"amp": 0, "dur": 12}, {"amp": 90, "dur": 18},
            {"amp": 0, "dur": 10}, {"amp": 120, "dur": 16}, {"amp": 0, "dur": 12},
            {"amp": 75, "dur": 20}, {"amp": 0, "dur": 20},
        ])

    def load_preset_clap(self):
        self._load_preset([
            {"amp": 220, "dur": 25}, {"amp": 0, "dur": 40},
        ])

    # ═══════════════════════ Import / Export ═══════════════════════
    def save_json(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".json", filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if not path:
            return
        data = {"version": 1, "points": self.points, "total_duration_ms": self.total_duration()}
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_json(self):
        path = filedialog.askopenfilename(filetypes=[("JSON files", "*.json"), ("All files", "*.*")])
        if not path:
            return
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self._save_undo()
        pts = data.get("points", [])
        self.points = [{"amp": max(0, min(255, int(p["amp"]))), "dur": max(1, int(p["dur"]))} for p in pts]
        self.selected_index = None
        self._zoom = 1.0
        self._scroll_x = 0.0
        self.redraw_all()
        self.sync_table()

    def copy_c_array(self):
        if not self.points:
            return
        flat = []
        for p in self.points:
            flat.extend([p["amp"], p["dur"]])
        lines, chunk = [], []
        for i, val in enumerate(flat, 1):
            chunk.append(str(val))
            if i % 12 == 0:
                lines.append("  " + ", ".join(chunk))
                chunk = []
        if chunk:
            lines.append("  " + ", ".join(chunk))
        text = "const uint8_t rtp_pattern[] = {\n" + ",\n".join(lines) + "\n};"
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        messagebox.showinfo("Copied", "C \ubc30\uc5f4\uc774 \ud074\ub9bd\ubcf4\ub4dc\uc5d0 \ubcf5\uc0ac\ub418\uc5c8\uc2b5\ub2c8\ub2e4.")

    def copy_serial_lines(self):
        if not self.points:
            return
        text = "\n".join(f'{p["amp"]} {p["dur"]}' for p in self.points)
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        messagebox.showinfo("Copied", "Serial line \ud3ec\ub9f7\uc774 \ud074\ub9bd\ubcf4\ub4dc\uc5d0 \ubcf5\uc0ac\ub418\uc5c8\uc2b5\ub2c8\ub2e4.")

    # ═══════════════════════ Zoom / Scroll ═══════════════════════
    def _visible_time_range(self):
        """현재 뷰포트에 보이는 시간 범위 (ms) -> (t_start, t_end)."""
        total = max(1, self.total_duration())
        visible_span = total / self._zoom
        t_start = self._scroll_x
        t_end = t_start + visible_span
        return t_start, t_end

    def _clamp_scroll(self):
        total = max(1, self.total_duration())
        visible_span = total / self._zoom
        max_scroll = max(0, total - visible_span)
        self._scroll_x = max(0, min(self._scroll_x, max_scroll))

    def _time_to_x(self, t_ms: float) -> float:
        x0, _, x1, _ = self.graph_area()
        t_start, t_end = self._visible_time_range()
        span = max(0.001, t_end - t_start)
        return x0 + ((t_ms - t_start) / span) * (x1 - x0)

    def _x_to_time(self, px: float) -> float:
        x0, _, x1, _ = self.graph_area()
        t_start, t_end = self._visible_time_range()
        span = max(0.001, t_end - t_start)
        ratio = (px - x0) / max(1, x1 - x0)
        return t_start + ratio * span

    def zoom_fit(self):
        self._zoom = 1.0
        self._scroll_x = 0.0
        self.redraw_all()

    def on_mouse_wheel(self, event):
        factor = 1.25 if event.delta > 0 else 1 / 1.25
        self._apply_zoom(factor, event.x)

    def on_mouse_wheel_linux(self, event, direction):
        factor = 1.25 if direction > 0 else 1 / 1.25
        self._apply_zoom(factor, event.x)

    def _apply_zoom(self, factor: float, pivot_x: float):
        t_pivot = self._x_to_time(pivot_x)
        new_zoom = max(self._MIN_ZOOM, min(self._MAX_ZOOM, self._zoom * factor))
        self._zoom = new_zoom
        total = max(1, self.total_duration())
        visible_span = total / self._zoom
        x0, _, x1, _ = self.graph_area()
        ratio = (pivot_x - x0) / max(1, x1 - x0)
        self._scroll_x = t_pivot - ratio * visible_span
        self._clamp_scroll()
        self.redraw_all()

    def on_pan_start(self, event):
        self._pan_start_x = event.x
        self._pan_start_scroll = self._scroll_x

    def on_pan_drag(self, event):
        if self._pan_start_x is None:
            return
        x0, _, x1, _ = self.graph_area()
        total = max(1, self.total_duration())
        visible_span = total / self._zoom
        dx_px = event.x - self._pan_start_x
        dx_ms = -(dx_px / max(1, x1 - x0)) * visible_span
        self._scroll_x = self._pan_start_scroll + dx_ms
        self._clamp_scroll()
        self.redraw_all()

    def on_pan_end(self, event):
        self._pan_start_x = None
        self._pan_start_scroll = None

    # ═══════════════════════ Canvas Drawing ═══════════════════════
    def graph_area(self):
        x0 = self.margin_left
        y0 = self.margin_top
        x1 = self.canvas.winfo_width() - self.margin_right
        y1 = self.canvas.winfo_height() - self.margin_bottom
        if x1 <= x0:
            x1 = x0 + 600
        if y1 <= y0:
            y1 = y0 + 300
        return x0, y0, x1, y1

    def redraw_all(self):
        self.canvas.delete("all")
        self.draw_grid()
        self.draw_step_graph()
        self.draw_step_handles()
        self.draw_playback_cursor()
        self.update_summary()

    def draw_grid(self):
        x0, y0, x1, y1 = self.graph_area()
        self.canvas.create_rectangle(x0, y0, x1, y1, outline="#666666")

        for i in range(6):
            y = y0 + (y1 - y0) * i / 5
            amp = int(round(255 - 255 * i / 5))
            self.canvas.create_line(x0, y, x1, y, fill="#222222")
            self.canvas.create_text(x0 - 10, y, text=str(amp), fill="#CCCCCC", anchor="e")

        t_start, t_end = self._visible_time_range()
        span = t_end - t_start
        for i in range(6):
            x = x0 + (x1 - x0) * i / 5
            t = t_start + span * i / 5
            self.canvas.create_line(x, y0, x, y1, fill="#222222")
            self.canvas.create_text(x, y1 + 15, text=f"{t:.0f}", fill="#CCCCCC", anchor="n")

        self.canvas.create_text((x0 + x1) / 2, y1 + 32, text="Time (ms)", fill="#DDDDDD")
        self.canvas.create_text(18, (y0 + y1) / 2, text="Amp", fill="#DDDDDD", angle=90)

        if self._zoom > 1.01:
            self.canvas.create_text(x1 - 4, y0 + 4, text=f"\u00d7{self._zoom:.1f}",
                                    fill="#888888", anchor="ne", font=("Arial", 9))

    def _get_step_rects(self):
        x0, y0, x1, y1 = self.graph_area()
        if not self.points:
            return []
        gh = y1 - y0
        rects = []
        t = 0
        for p in self.points:
            xl = self._time_to_x(t)
            xr = self._time_to_x(t + p["dur"])
            yt = y1 - (p["amp"] / 255.0) * gh
            rects.append((xl, yt, xr, y1))
            t += p["dur"]
        return rects

    def draw_step_graph(self):
        if not self.points:
            return
        rects = self._get_step_rects()
        x0, y0, x1, y1 = self.graph_area()

        for i, (xl, yt, xr, _) in enumerate(rects):
            if xr < x0 or xl > x1:
                continue
            is_sel = (i == self.selected_index)
            fill = "#3A6A4A" if is_sel else "#2A4A5A"
            cl = max(xl, x0)
            cr = min(xr, x1)
            self.canvas.create_rectangle(cl, yt, cr, y1, fill=fill, outline="", width=0)

        line_pts = []
        for i, (xl, yt, xr, _) in enumerate(rects):
            if i == 0:
                line_pts.extend([xl, yt])
            else:
                prev_yt = rects[i - 1][1]
                line_pts.extend([xl, prev_yt])
                line_pts.extend([xl, yt])
            line_pts.extend([xr, yt])

        if len(line_pts) >= 4:
            self.canvas.create_line(*line_pts, fill="#4FC3F7", width=2, smooth=False)

    def draw_step_handles(self):
        rects = self._get_step_rects()
        x0, y0, x1, y1 = self.graph_area()
        for i, (xl, yt, xr, yb) in enumerate(rects):
            if xr < x0 or xl > x1:
                continue
            is_sel = (i == self.selected_index)

            cx = max(x0, min(x1, (xl + xr) / 2))
            r = 6 if is_sel else 4
            fill_c = "#FFD54F" if is_sel else "#FF7043"
            self.canvas.create_oval(cx - r, yt - r, cx + r, yt + r, fill=fill_c, outline="")
            self.canvas.create_text(cx, yt - 14, text=str(i), fill="#EEEEEE", font=("Arial", 9))

            if x0 <= xr <= x1:
                handle_h = min(16, max(6, (yb - yt) * 0.4))
                mid_y = (yt + yb) / 2
                self.canvas.create_line(xr, mid_y - handle_h, xr, mid_y + handle_h,
                                        fill="#FFA726" if is_sel else "#FFCC80", width=3)

    def draw_playback_cursor(self):
        if self._playback_t is None:
            return
        total = max(1, self.total_duration())
        t = self._playback_t % total
        cx = self._time_to_x(t)
        x0, y0, x1, y1 = self.graph_area()
        if x0 <= cx <= x1:
            self.canvas.create_line(cx, y0, cx, y1, fill="#FF4444", width=2, dash=(6, 3))
            self.canvas.create_text(cx, y0 - 6, text=f"{t:.0f}ms", fill="#FF6666",
                                    anchor="s", font=("Arial", 8))

    # ═══════════════════════ Canvas Hit-Test ═══════════════════════
    def _hit_test(self, mx, my):
        rects = self._get_step_rects()
        if not rects:
            return None, None

        for i, (xl, yt, xr, yb) in enumerate(rects):
            if abs(mx - xr) <= self._EDGE_GRAB_PX and yt - 10 <= my <= yb + 10:
                return i, "dur"

        for i, (xl, yt, xr, yb) in enumerate(rects):
            cx = (xl + xr) / 2
            if math.hypot(mx - cx, my - yt) <= 12:
                return i, "amp"

        for i, (xl, yt, xr, yb) in enumerate(rects):
            if xl <= mx <= xr and yt - 5 <= my <= yb + 5:
                return i, "amp"

        return None, None

    def _find_insert_index(self, mx):
        if not self.points:
            return 0, 0
        click_t = self._x_to_time(mx)
        t = 0
        for i, p in enumerate(self.points):
            mid = t + p["dur"] / 2
            if click_t < mid:
                return i, t
            t += p["dur"]
        return len(self.points), t

    # ═══════════════════════ Canvas Events ═══════════════════════
    def on_canvas_motion(self, event):
        idx, mode = self._hit_test(event.x, event.y)
        if mode == "dur":
            self.canvas.config(cursor="sb_h_double_arrow")
        elif mode == "amp":
            self.canvas.config(cursor="sb_v_double_arrow")
        else:
            self.canvas.config(cursor="crosshair")

    def on_canvas_click(self, event):
        idx, mode = self._hit_test(event.x, event.y)
        if idx is not None:
            self.selected_index = idx
            self.dragging_index = idx
            self.drag_mode = mode
            self.drag_start_x = event.x
            self.drag_start_dur = self.points[idx]["dur"]
            self.drag_start_total = self.total_duration()
            self._save_undo()
            self.sync_selection_fields()
            self.redraw_all()
            self.sync_table(select_current=True)
            return

        self.selected_index = None
        self.dragging_index = None
        self.drag_mode = None
        self.sync_selection_fields()
        self.redraw_all()
        self.sync_table()

    def on_canvas_drag(self, event):
        if self.dragging_index is None:
            return
        x0, y0, x1, y1 = self.graph_area()
        idx = self.dragging_index

        if self.drag_mode == "amp":
            y = min(max(event.y, y0), y1)
            amp = int(round((y1 - y) / (y1 - y0) * 255))
            self.points[idx]["amp"] = max(0, min(255, amp))

        elif self.drag_mode == "dur":
            frozen_total = max(1, self.drag_start_total or self.total_duration())
            visible_span = frozen_total / self._zoom
            gw = max(1, x1 - x0)
            dx_px = event.x - self.drag_start_x
            dx_ms = (dx_px / gw) * visible_span
            new_dur = int(round(self.drag_start_dur + dx_ms))
            self.points[idx]["dur"] = max(5, min(2000, new_dur))

        self.sync_selection_fields()
        self.redraw_all()
        self.sync_table(select_current=True)

    def on_canvas_release(self, event):
        self.dragging_index = None
        self.drag_mode = None
        self.drag_start_x = None
        self.drag_start_dur = None
        self.drag_start_total = None

    def on_canvas_right_click(self, event):
        idx, _ = self._hit_test(event.x, event.y)
        if idx is not None:
            self.selected_index = idx
            self.delete_selected()

    def on_canvas_double_click(self, event):
        x0, y0, x1, y1 = self.graph_area()
        if not (x0 <= event.x <= x1 and y0 <= event.y <= y1):
            return
        amp = int(round((y1 - event.y) / (y1 - y0) * 255))
        amp = max(0, min(255, amp))
        dur = int(self.dur_var.get())

        self._save_undo()
        if not self.points:
            self.points.append({"amp": amp, "dur": dur})
            self.selected_index = 0
        else:
            insert_idx, _ = self._find_insert_index(event.x)
            self.points.insert(insert_idx, {"amp": amp, "dur": dur})
            self.selected_index = insert_idx

        self._clamp_scroll()
        self.redraw_all()
        self.sync_table(select_current=True)

    # ═══════════════════════ Table / Selection ═══════════════════════
    def sync_table(self, select_current=False):
        self.tree.delete(*self.tree.get_children())
        t = 0
        for i, p in enumerate(self.points):
            start = t
            end = t + p["dur"]
            self.tree.insert("", "end", iid=str(i), values=(i, p["amp"], p["dur"], start, end))
            t = end
        if select_current and self.selected_index is not None and str(self.selected_index) in self.tree.get_children():
            self.tree.selection_set(str(self.selected_index))
            self.tree.see(str(self.selected_index))
        self.update_summary()

    def on_tree_select(self, event):
        selected = self.tree.selection()
        if not selected:
            return
        self.selected_index = int(selected[0])
        self.sync_selection_fields()
        self.redraw_all()

    def sync_selection_fields(self):
        if self.selected_index is None or self.selected_index >= len(self.points):
            self.sel_amp_var.set("")
            self.sel_dur_var.set("")
            return
        p = self.points[self.selected_index]
        self.sel_amp_var.set(str(p["amp"]))
        self.sel_dur_var.set(str(p["dur"]))

    # ═══════════════════════ Helpers ═══════════════════════
    def total_duration(self):
        return sum(p["dur"] for p in self.points)

    def update_summary(self):
        undo_s = " | Undo" if self.undo_mgr.can_undo else ""
        redo_s = " | Redo" if self.undo_mgr.can_redo else ""
        zoom_s = f" | Zoom \u00d7{self._zoom:.1f}" if self._zoom > 1.01 else ""
        self.summary_var.set(
            f"Points: {len(self.points)} | Total: {self.total_duration()} ms{zoom_s}{undo_s}{redo_s}"
        )

    def on_amp_slider(self, _):
        self.amp_label.config(text=str(int(float(self.amp_var.get()))))

    def on_dur_slider(self, _):
        self.dur_label.config(text=str(int(float(self.dur_var.get()))))


# ═══════════════════════ Main ═══════════════════════
def main():
    root = tk.Tk()
    style = ttk.Style(root)
    try:
        style.theme_use("clam")
    except Exception:
        pass
    app = RTPPatternEditor(root)
    root.protocol("WM_DELETE_WINDOW", lambda: on_close(app))
    root.mainloop()


def on_close(app: RTPPatternEditor):
    try:
        app.stop_pattern()
        app.disconnect_serial()
    finally:
        app.root.destroy()


if __name__ == "__main__":
    main()