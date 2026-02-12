import time
import os
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from sync_users import sync_users

# CONFIGURATION
FILE_TO_WATCH = 'usuarios db.xlsx'
DIRECTORY_TO_WATCH = '.'

class ExcelChangeHandler(FileSystemEventHandler):
    def on_modified(self, event):
        # Check if the modified file is our Excel db
        # Note: Some Excel editors create temp files, we filter for the exact name
        filename = os.path.basename(event.src_path)
        if filename == FILE_TO_WATCH:
            print(f"[{time.strftime('%H:%M:%S')}] Cambio detectado en {FILE_TO_WATCH}. Sincronizando...")
            # Small delay to ensure Excel has finished writing/unlocking the file
            time.sleep(1)
            sync_users()

if __name__ == "__main__":
    event_handler = ExcelChangeHandler()
    observer = Observer()
    observer.schedule(event_handler, DIRECTORY_TO_WATCH, recursive=False)
    
    print(f"--- Iniciando Monitor de Usuarios ---")
    print(f"Monitoreando: {FILE_TO_WATCH}")
    print(f"Presiona Ctrl+C para detener.")
    
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
