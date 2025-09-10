import sqlite3
import os

DATABASE_FILE = 'vendor_database.db'

def create_fresh_database():
    if os.path.exists(DATABASE_FILE):
        os.remove(DATABASE_FILE)
        print(f"Database lama '{DATABASE_FILE}' berhasil dihapus.")
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        print(f"Database baru '{DATABASE_FILE}' berhasil dibuat.")
        cursor.execute("""
        CREATE TABLE vendors (
            kode_supplier TEXT PRIMARY KEY,
            nama_vendor TEXT NOT NULL,
            plant TEXT,
            truck_terminal TEXT,
            plan_arrival_time TEXT
        );
        """)
        print("Tabel 'vendors' berhasil dibuat.")
        cursor.execute("""
        CREATE TABLE arrival_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_kode TEXT,
            vendor_nama TEXT,
            tanggal_catat TEXT,
            waktu_tiba_aktual TEXT,
            selisih_menit INTEGER,
            status_kedatangan TEXT
        );
        """)
        print("Tabel 'arrival_logs' berhasil dibuat.")
        conn.commit()
        print("\nDatabase berhasil di-reset dan siap digunakan!")
    except sqlite3.Error as e:
        print(f"Terjadi error pada database: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    konfirmasi = input("Anda yakin ingin menghapus SEMUA data dan membuat database baru? (ketik 'ya' atau 'y' untuk lanjut): ")
    if konfirmasi.lower() in ['ya', 'y']:
        create_fresh_database()
    else:
        print("Operasi dibatalkan.")