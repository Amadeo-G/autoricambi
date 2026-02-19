import pandas as pd
import json
import os
import time

# CONFIGURATION
EXCEL_FILE = 'usuarios db.xlsx'
JSON_OUTPUT = 'src/js/users.json'

def sync_users():
    if not os.path.exists(EXCEL_FILE):
        print(f"Error: {EXCEL_FILE} no encontrado.")
        return False
    
    try:
        # Read Excel
        df = pd.read_excel(EXCEL_FILE)
        
        # Mapping columns to clean JSON
        # Looking for potential column names added by the user
        col_map = {
            'Usuarios': 'email',
            'Contraseñas': 'password',
            'Nombre': 'name',
            'Nombres': 'name'
        }
        
        # Rename columns if they exist in the dataframe
        df = df.rename(columns=lambda x: col_map.get(x, x))

        # Cleanup: Fix common encoding issues (Halfwidth Katakana range misused for Latin-1)
        def fix_encoding(val):
            if not isinstance(val, str):
                return val
            # Map U+FF60-U+FFFD to U+0060-U+00FD
            def replace_char(match):
                c = match.group(0)
                code = ord(c)
                latin1_code = code - 0xFF00
                
                # Windows-1252 fixes for 0x80-0x9F
                win1252_map = {
                    0x82: '\u201a', 0x83: '\u0192', 0x84: '\u201e', 0x85: '\u2026',
                    0x86: '\u2020', 0x87: '\u2021', 0x88: '\u02c6', 0x89: '\u2030',
                    0x8a: '\u0160', 0x8b: '\u2039', 0x8c: '\u0152', 0x8e: '\u017d',
                    0x91: '\u2018', 0x92: '\u2019', 0x93: '\u201c', 0x94: '\u201d',
                    0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014', 0x98: '\u02dc',
                    0x99: '\u2122', 0x9a: '\u0161', 0x9b: '\u203a', 0x9c: '\u0153',
                    0x9e: '\u017e', 0x9f: '\u0178'
                }
                if latin1_code in win1252_map:
                    return win1252_map[latin1_code]
                if 0x20 <= latin1_code <= 0xFF:
                    return chr(latin1_code)
                return c

            import re
            return re.sub(r'[\uff60-\ufffd]', replace_char, val).strip()
        
        df = df.applymap(fix_encoding)
        
        # Ensure we have at least email and password
        if 'email' not in df.columns or 'password' not in df.columns:
            print(f"Error: El Excel debe tener columnas llamadas 'Usuarios' y 'Contraseñas'.")
            print(f"Columnas detectadas: {df.columns.tolist()}")
            return False
            
        # Convert to list of dicts
        users = df.to_dict(orient='records')
        
        # Save JSON
        os.makedirs(os.path.dirname(JSON_OUTPUT), exist_ok=True)
        with open(JSON_OUTPUT, 'w', encoding='utf-8') as f:
            json.dump(users, f, ensure_ascii=False, indent=4)
        
        print(f"[{time.strftime('%H:%M:%S')}] Sincronización exitosa: {len(users)} usuarios procesados.")
        return True
    except Exception as e:
        print(f"Error durante la sincronización: {e}")
        return False

if __name__ == "__main__":
    sync_users()
