import pandas as pd

try:
    df = pd.read_excel('Filtros.xlsx')
    with open('columns.txt', 'w', encoding='utf-8') as f:
        f.write(f"Columns: {df.columns.tolist()}\n")
        f.write(f"Shape: {df.shape}\n")
        f.write(f"Row 0: {df.iloc[0].tolist()}\n")
        f.write(f"Row 1: {df.iloc[1].tolist()}\n")
        f.write(f"Row 2: {df.iloc[2].tolist()}\n")
except Exception as e:
    with open('columns.txt', 'w', encoding='utf-8') as f:
        f.write(f"Error: {e}\n")
