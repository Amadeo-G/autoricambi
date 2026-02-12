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
