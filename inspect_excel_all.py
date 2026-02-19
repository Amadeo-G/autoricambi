import pandas as pd

try:
    df = pd.read_excel('Filtros.xlsx')
    descriptions = df.iloc[:, 1].dropna().unique()
    with open('inspect_excel_all.txt', 'w', encoding='utf-8') as f:
        for d in descriptions[:50]:
            f.write(f"{d}\n")
    print("Inspection complete. Check inspect_excel_all.txt")
except Exception as e:
    print(f"Error: {e}")
