import pandas as pd

try:
    df = pd.read_excel('Filtros.xlsx')
    with open('inspect_headers.txt', 'w', encoding='utf-8') as f:
        f.write(", ".join([str(c) for c in df.columns]))
        f.write("\n")
        f.write(", ".join([str(v) for v in df.iloc[0].values]))
    print("Inspection complete. Check inspect_headers.txt")
except Exception as e:
    print(f"Error: {e}")
