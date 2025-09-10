import sqlite3
import os

DATABASE_FILE = 'vendor_database.db'
TXT_FILE = 'suplier kode,name,stasiun,jam datang.txt' 
VENDORS_TABLE = 'vendors'

def import_vendors_from_txt_final():
    if not os.path.exists(DATABASE_FILE):
        print(f"Error: DB '{DATABASE_FILE}' tidak ditemukan. Jalankan reset_database.py dulu.")
        return
    if not os.path.exists(TXT_FILE):
        print(f"Error: File TXT '{TXT_FILE}' tidak ditemukan.")
        return

    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    print("Koneksi database berhasil.")
    try:
        with open(TXT_FILE, mode='r', encoding='utf-8') as file:
            vendors_to_insert = []
            for line_number, line in enumerate(file, 1):
                line = line.strip()
                if not line: continue
                
                parts = line.split(',')
                if len(parts) >= 3:
                    kode_supplier = parts[0].strip()
                    
                    if len(parts) >= 4:
                        plan_arrival_time = parts[-2].strip()
                        truck_terminal = parts[-1].strip()
                        nama_vendor = ",".join(parts[1:-2]).strip()
                    else:
                        plan_arrival_time = parts[-1].strip()
                        truck_terminal = "" 
                        nama_vendor = ",".join(parts[1:-1]).strip()
                    
                    plant = 'A'
                    
                    if kode_supplier and nama_vendor and plan_arrival_time:
                        vendors_to_insert.append((kode_supplier, nama_vendor, plant, truck_terminal, plan_arrival_time))
                    else:
                        print(f"Melewati baris #{line_number} karena data penting kosong.")
                else:
                    print(f"Melewati baris #{line_number} karena format salah.")

            if vendors_to_insert:
                cursor.executemany(f"INSERT OR IGNORE INTO {VENDORS_TABLE} (kode_supplier, nama_vendor, plant, truck_terminal, plan_arrival_time) VALUES (?, ?, ?, ?, ?)", vendors_to_insert)
                conn.commit()
                print(f"\nSelesai! Berhasil memproses {len(vendors_to_insert)} baris data.")
                print(f"{cursor.rowcount} vendor baru berhasil ditambahkan.")
    except Exception as e:
        print(f"Terjadi error: {e}")
    finally:
        conn.close()
        print("Koneksi database ditutup.")

if __name__ == '__main__':
    import_vendors_from_txt_final()