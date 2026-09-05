"""Own only this benchmark's process tree, including children of an exited launcher."""
from __future__ import annotations
import ctypes
import json
import os
import signal
import subprocess
import sys
import time
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
    kernel.SetInformationJobObject.restype = w.BOOL
    kernel.AssignProcessToJobObject.argtypes = [w.HANDLE, w.HANDLE]
    kernel.AssignProcessToJobObject.restype = w.BOOL
    kernel.TerminateJobObject.argtypes = [w.HANDLE, w.UINT]
    kernel.TerminateJobObject.restype = w.BOOL
    kernel.QueryInformationJobObject.argtypes = [w.HANDLE, ctypes.c_int, ctypes.c_void_p, w.DWORD, ctypes.c_void_p]
    kernel.QueryInformationJobObject.restype = w.BOOL
    kernel.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]
    kernel.OpenProcess.restype = w.HANDLE
    kernel.WaitForSingleObject.argtypes = [w.HANDLE, w.DWORD]
    kernel.WaitForSingleObject.restype = w.DWORD
    kernel.CloseHandle.argtypes = [w.HANDLE]
    kernel.CloseHandle.restype = w.BOOL
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


def terminate_windows_job(kernel, handle, timeout=30):
    from ctypes import wintypes as w

    def process_ids():
        capacity = 64
        while True:
            class ProcessList(ctypes.Structure):
                _fields_ = [("assigned", w.DWORD), ("listed", w.DWORD),
                            ("pids", ctypes.c_size_t * capacity)]
            info = ProcessList()
            if kernel.QueryInformationJobObject(handle, 3, ctypes.byref(info), ctypes.sizeof(info), None):
                return list(info.pids[:info.listed])
            error = ctypes.get_last_error()
            if error != 234:  # ERROR_MORE_DATA: descendants outgrew the buffer.
                raise ctypes.WinError(error)
            capacity = max(capacity * 2, info.assigned)

    deadline = time.monotonic() + timeout
    while True:
        processes = []
        try:
            # Keep handles before termination: the Job can report zero active
            # processes while their handles are not yet signaled and sockets
            # are still closing. Waiting only on the launcher misses this gap.
            for pid in process_ids():
                process = kernel.OpenProcess(0x100000, False, pid)  # SYNCHRONIZE
                if process:
                    processes.append(process)
                elif ctypes.get_last_error() != 87:  # Process already exited.
                    raise ctypes.WinError(ctypes.get_last_error())
            if not kernel.TerminateJobObject(handle, 1):
                raise ctypes.WinError(ctypes.get_last_error())
            for process in processes:
                remaining_ms = max(0, int((deadline - time.monotonic()) * 1000))
                result = kernel.WaitForSingleObject(process, remaining_ms)
                if result == 258:  # WAIT_TIMEOUT
                    raise TimeoutError("服务退出超时：本阶段仍有子进程未结束，已停止切换阶段。")
                if result != 0:
                    raise ctypes.WinError(ctypes.get_last_error())
            if not process_ids():
                return
            if time.monotonic() >= deadline:
                raise TimeoutError("服务退出超时：本阶段进程树尚未清空，已停止切换阶段。")
        finally:
            for process in processes:
                kernel.CloseHandle(process)


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
        try:
            if self.job:
                kernel, handle = self.job
                try:
                    terminate_windows_job(kernel, handle)
                finally:
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
        finally:
            self.stdout.close()
            self.stderr.close()


if __name__ == "__main__" and sys.argv[1:] == ["--host"]:
    line = sys.stdin.buffer.readline()
    if not line:
        raise SystemExit(2)
    command = json.loads(line.decode("utf-8"))
    if not isinstance(command, list) or not command or not all(isinstance(x, str) for x in command):
        raise SystemExit(2)
    # CREATE_NO_WINDOW does not reliably inherit standard handles implicitly.
    # Forward the host's log streams explicitly so the parent can read startup
    # messages and the generated API key before sending benchmark requests.
    raise SystemExit(subprocess.call(command, stdout=sys.stdout, stderr=sys.stderr,
                                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0))
