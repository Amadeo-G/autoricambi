import pandas as pd

try:
    df = pd.read_excel('Filtros.xlsx')
    # Print some rows that might have tildes or ñ
    # descriptions are in column 1 (index 1) based on excel-worker.js logic: row[1]
    descriptions = df.iloc[:, 1].dropna().unique()
    with open('inspect_excel.txt', 'w', encoding='utf-8') as f:
        for d in descriptions[:100]:
            if any(c in str(d) for c in 'áéíóúÁÉÍÓÚñÑ'):
                f.write(f"{d}\n")
    print("Inspection complete. Check inspect_excel.txt")
except Exception as e:
    print(f"Error: {e}")
