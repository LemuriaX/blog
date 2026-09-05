"""Own only this benchmark's process tree, including children of an exited launcher."""
from __future__ import annotations
import ctypes
import json
import os
import signal
import subprocess
import sys
from pathlib import Path


def create_windows_job(process_handle):
    from ctypes import wintypes as w
    class Basic(ctypes.Structure):
        _fields_ = [("process_time", ctypes.c_longlong), ("job_time", ctypes.c_longlong),
                    ("flags", w.DWORD), ("min_working_set", ctypes.c_size_t),
                    ("max_working_set", ctypes.c_size_t), ("active_process_limit", w.DWORD),
                    ("affinity", ctypes.c_size_t), ("priority_class", w.DWORD), ("scheduling_class", w.DWORD)]
    class IO(ctypes.Structure):
        _fields_ = [(n, ctypes.c_ulonglong) for n in ("reads", "writes", "other", "read_bytes", "write_bytes", "other_bytes")]
    class Extended(ctypes.Structure):
        _fields_ = [("basic", Basic), ("io", IO), ("process_memory", ctypes.c_size_t),
                    ("job_memory", ctypes.c_size_t), ("peak_process", ctypes.c_size_t), ("peak_job", ctypes.c_size_t)]
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, w.LPCWSTR]
    kernel.CreateJobObjectW.restype = w.HANDLE
    kernel.SetInformationJobObject.argtypes = [w.HANDLE, ctypes.c_int, ctypes.c_void_p, w.DWORD]
    kernel.AssignProcessToJobObject.argtypes = [w.HANDLE, w.HANDLE]
    kernel.CloseHandle.argtypes = [w.HANDLE]
    handle = kernel.CreateJobObjectW(None, None)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    limits = Extended()
    limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    if not kernel.SetInformationJobObject(handle, 9, ctypes.byref(limits), ctypes.sizeof(limits)) or not kernel.AssignProcessToJobObject(handle, int(process_handle)):
        error = ctypes.get_last_error()
        kernel.CloseHandle(handle)
        raise ctypes.WinError(error)
    return kernel, handle


class ManagedProcess:
    def __init__(self, command, stdout_path: Path, stderr_path: Path, env=None):
        self.job = None
        self.stdout = stdout_path.open("ab")
        self.stderr = stderr_path.open("ab")
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        try:
            self.process = subprocess.Popen([sys.executable, "-u", str(Path(__file__).resolve()), "--host"],
                                            stdin=subprocess.PIPE, stdout=self.stdout, stderr=self.stderr,
                                            creationflags=flags, start_new_session=os.name != "nt", env=env)
        except BaseException:
            self.stdout.close()
            self.stderr.close()
            raise
        try:
            if os.name == "nt":
                self.job = create_windows_job(self.process._handle)
            # The host cannot spawn the model until it has been assigned to our Job Object.
            self.process.stdin.write((json.dumps(command) + "\n").encode("utf-8"))
            self.process.stdin.flush()
            self.process.stdin.close()
        except BaseException:
            self.close()
            raise

    def poll(self):
        return self.process.poll()

    def close(self):
        if self.job:
            kernel, handle = self.job
            kernel.CloseHandle(handle)
            self.job = None
        elif os.name != "nt":
            try:
                os.killpg(self.process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        elif self.process.poll() is None:
            self.process.kill()
        try:
            self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=5)
        self.stdout.close()
        self.stderr.close()


if __name__ == "__main__" and sys.argv[1:] == ["--host"]:
    line = sys.stdin.buffer.readline()
    if not line:
        raise SystemExit(2)
    command = json.loads(line.decode("utf-8"))
    if not isinstance(command, list) or not command or not all(isinstance(x, str) for x in command):
        raise SystemExit(2)
    raise SystemExit(subprocess.call(command, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0))
