import pandas as pd
import re

def has_non_ascii(text):
    if not isinstance(text, str): return False
    return any(ord(c) > 127 for c in text)

try:
    df = pd.read_excel('Filtros.xlsx')
    with open('inspect_non_ascii.txt', 'w', encoding='utf-8') as f:
        for col in df.columns:
            for val in df[col].dropna().unique():
                if has_non_ascii(str(val)):
                    f.write(f"Col {col}: {val}\n")
    print("Inspection complete. Check inspect_non_ascii.txt")
except Exception as e:
    print(f"Error: {e}")
