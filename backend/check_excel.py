import openpyxl
wb = openpyxl.load_workbook('C:/Users/rambh/OneDrive/Desktop/DDUGU project/backend/data/faculty.xlsx')
ws = wb.active
print('Sheet name:', ws.title)
print('Dimensions:', ws.dimensions)
for i, row in enumerate(ws.iter_rows(values_only=False), 1):
    print(f"Row {i}: {[cell.value for cell in row]}")