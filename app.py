import os
import sqlite3
from flask import Flask, render_template, jsonify, request, send_file
from datetime import datetime, timedelta
import holidays
import pandas as pd
import io
import xlsxwriter

# --- Inisialisasi Flask Versi Standar yang Benar ---
app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, 'vendor_database.db')
# --------------------------------------------------

def get_db_connection():
    conn = sqlite3.connect(DATABASE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

# --- Route Halaman ---
@app.route('/')
def index(): return render_template('index.html')

@app.route('/laporan')
def laporan(): return render_template('laporan.html')

@app.route('/grafik')
def grafik(): return render_template('grafik.html')

@app.route('/pengaturan')
def pengaturan(): return render_template('pengaturan.html')

# --- API ---
@app.route('/api/get_vendors')
def get_vendors():
    conn = get_db_connection(); vendors = conn.execute('SELECT * FROM vendors ORDER BY nama_vendor ASC').fetchall(); conn.close(); return jsonify([dict(row) for row in vendors])

@app.route('/api/add_vendor', methods=['POST'])
def add_vendor():
    data = request.json
    try:
        conn = get_db_connection(); conn.execute('INSERT INTO vendors (kode_supplier, nama_vendor, plant, truck_terminal, plan_arrival_time) VALUES (?, ?, ?, ?, ?)', (data['kode'], data['nama'], data['plant'], data['terminal'], data['jadwal'])); conn.commit()
        return jsonify({'success': True, 'message': f"Vendor {data['nama']} berhasil ditambahkan!"})
    except sqlite3.IntegrityError: return jsonify({'success': False, 'message': f"Error: Kode supplier '{data['kode']}' sudah ada."}), 400
    except Exception as e: return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/delete_vendor', methods=['POST'])
def delete_vendor():
    data = request.json
    try:
        conn = get_db_connection(); cursor = conn.cursor(); cursor.execute('DELETE FROM vendors WHERE kode_supplier = ?', (data['kode'],)); conn.commit()
        if cursor.rowcount > 0: return jsonify({'success': True, 'message': f"Vendor kode '{data['kode']}' berhasil dihapus."})
        else: return jsonify({'success': False, 'message': f"Error: Vendor kode '{data['kode']}' tidak ditemukan."}), 404
    except Exception as e: return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/search')
def search():
    query = request.args.get('q', '').lower()
    if not query: return jsonify([])
    conn = get_db_connection(); search_pattern = f'%{query}%'; vendors = conn.execute('SELECT kode_supplier, nama_vendor, plant, truck_terminal, plan_arrival_time FROM vendors WHERE lower(nama_vendor) LIKE ? OR lower(kode_supplier) LIKE ? LIMIT 10', (search_pattern, search_pattern)).fetchall(); conn.close()
    return jsonify([dict(row) for row in vendors])

@app.route('/api/save_arrival', methods=['POST'])
def save_arrival():
    data = request.json
    try:
        conn = get_db_connection(); conn.execute('INSERT INTO arrival_logs (vendor_kode, vendor_nama, tanggal_catat, waktu_tiba_aktual, selisih_menit, status_kedatangan) VALUES (?, ?, ?, ?, ?, ?)', (data.get('kode'), data.get('nama'), data.get('tanggal'), data.get('waktu'), data.get('selisihMenit'), data.get('status'))); conn.commit(); conn.close()
        return jsonify({'success': True, 'message': f'Data untuk {data.get("nama")} berhasil disimpan!'})
    except Exception as e: return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/laporan_data')
def get_laporan_data():
    start_date_str = request.args.get('start_date');end_date_str = request.args.get('end_date');id_holidays = holidays.Indonesia();conn = get_db_connection()
    logs_in_range = conn.execute("SELECT * FROM arrival_logs WHERE tanggal_catat BETWEEN ? AND ? ORDER BY tanggal_catat, vendor_nama", (start_date_str, end_date_str)).fetchall()
    if not logs_in_range: conn.close(); return jsonify({'dates': [], 'logs': [], 'summaries': {}})
    logs_with_details = [];vendor_details_cache = {}
    for log in logs_in_range:
        log_dict = dict(log);vendor_kode = log['vendor_kode']
        if vendor_kode not in vendor_details_cache:
            details = conn.execute("SELECT plant, truck_terminal, plan_arrival_time FROM vendors WHERE kode_supplier = ?", (vendor_kode,)).fetchone()
            vendor_details_cache[vendor_kode] = dict(details) if details else {}
        details = vendor_details_cache[vendor_kode];log_dict['plant'] = details.get('plant', '-');log_dict['truck_terminal'] = details.get('truck_terminal', '-');log_dict['plan_arrival_time'] = details.get('plan_arrival_time', '-');logs_with_details.append(log_dict)
    conn.close()
    date_range = []; current_date = datetime.strptime(start_date_str, '%Y-%m-%d'); end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
    while current_date <= end_date: date_str = current_date.strftime('%Y-%m-%d'); is_holiday = date_str in id_holidays or current_date.weekday() in [5, 6]; date_range.append({ "date_str": date_str, "is_holiday": is_holiday }); current_date += timedelta(days=1)
    summaries = {}
    for date_info in date_range:
        date_str = date_info["date_str"]; daily_logs = [log for log in logs_in_range if log['tanggal_catat'] == date_str]; late_logs = [log for log in daily_logs if log['selisih_menit'] is not None and log['selisih_menit'] > 0]
        summaries[date_str] = {'total_datang': len(daily_logs), 'total_telat': len(late_logs), 'nama_vendor_telat': [log['vendor_nama'] for log in late_logs]}
    return jsonify({'dates': date_range, 'logs': logs_with_details, 'summaries': summaries})

@app.route('/api/grafik_data')
def get_grafik_data():
    start_date_str=request.args.get('start_date');end_date_str=request.args.get('end_date');conn=get_db_connection()
    logs=conn.execute("SELECT * FROM arrival_logs WHERE tanggal_catat BETWEEN ? AND ?",(start_date_str,end_date_str)).fetchall();conn.close()
    bar_chart_data={};date_range=pd.date_range(start=start_date_str,end=end_date_str)
    for date in date_range:
        date_str=date.strftime('%Y-%m-%d')
        bar_chart_data[date_str]={'kedatangan':0,'on_schedule':0,'telat':0}
    for log in logs:
        date_str=log['tanggal_catat']
        if date_str in bar_chart_data:
            bar_chart_data[date_str]['kedatangan']+=1
            selisih=log['selisih_menit']
            if selisih is not None and selisih > 0:
                bar_chart_data[date_str]['telat']+=1
            else:
                bar_chart_data[date_str]['on_schedule']+=1
    late_vendor_counts={}
    for log in logs:
        if log['selisih_menit'] is not None and log['selisih_menit'] > 0:
            vendor_name=log['vendor_nama']
            late_vendor_counts[vendor_name]=late_vendor_counts.get(vendor_name,0)+1
    sorted_late_vendors=sorted(late_vendor_counts.items(),key=lambda item:item[1],reverse=True)
    return jsonify({'bar_chart':bar_chart_data,'late_vendor_data':sorted_late_vendors})

@app.route('/api/download_laporan')
def download_laporan():
    start_date_str=request.args.get('start_date');end_date_str=request.args.get('end_date');response=get_laporan_data();json_data=response.get_json()
    if not json_data or not json_data.get('logs'): return "Tidak ada data.", 404
    dates, logs, summaries = json_data['dates'], json_data['logs'], json_data['summaries'];output=io.BytesIO();writer=pd.ExcelWriter(output, engine='xlsxwriter');workbook=writer.book;worksheet=workbook.add_worksheet("Laporan Kedatangan")
    header_format=workbook.add_format({'bold':True,'align':'center','valign':'vcenter','border':1,'bg_color':'#DDEBF7'});holiday_header_format=workbook.add_format({'bold':True,'align':'center','valign':'vcenter','border':1,'bg_color':'#F8CBAD'});cell_format=workbook.add_format({'border':1,'align':'center','valign':'vcenter'});text_cell_format=workbook.add_format({'border':1,'align':'left','valign':'vcenter'});holiday_cell_format=workbook.add_format({'border':1,'bg_color':'#FCE4D6','align':'center','valign':'vcenter'});summary_label_format=workbook.add_format({'bold':True,'border':1,'align':'right','valign':'vcenter','bg_color':'#D9D9D9'})
    static_headers=['No','Supplier','Supplier Name','TRUCK TERI','plan Arrival Tim'];
    for i,text in enumerate(static_headers): worksheet.merge_range(0,i,1,i,text,header_format)
    col_offset=len(static_headers)
    for i,date_info in enumerate(dates):col=col_offset+(i*2);date_obj=datetime.strptime(date_info['date_str'],'%Y-%m-%d');fmt=holiday_header_format if date_info['is_holiday'] else header_format;worksheet.merge_range(0,col,0,col+1,date_obj.strftime('%d-%b'),fmt);worksheet.write(1,col,'AKTUAL TIBA',fmt);worksheet.write(1,col+1,'SELISIH',fmt)
    row_num=2
    for index,log in enumerate(logs):
        worksheet.write(row_num,0,index+1,cell_format);worksheet.write(row_num,1,log.get('vendor_kode','-'),cell_format);worksheet.write(row_num,2,log.get('vendor_nama','-'),text_cell_format);worksheet.write(row_num,3,log.get('truck_terminal','-'),cell_format);worksheet.write(row_num,4,log.get('plan_arrival_time','-'),cell_format)
        for i,date_info in enumerate(dates):
            col=col_offset+(i*2);date_str=date_info['date_str'];fmt=holiday_cell_format if date_info['is_holiday'] else cell_format
            if log.get('tanggal_catat')==date_str:
                selisih=log.get('selisih_menit');selisih_str='';
                if selisih is not None:is_negative=selisih<0;abs_selisih=abs(selisih);h,m=divmod(abs_selisih,60);selisih_str=f"{'-' if is_negative else ''}{h}:{m:02d}"
                worksheet.write(row_num,col,log.get('waktu_tiba_aktual',''),fmt);worksheet.write(row_num,col+1,selisih_str,fmt)
            else: worksheet.write(row_num,col,'',fmt);worksheet.write(row_num,col+1,'',fmt)
        row_num+=1
    summary_start_row=row_num+1;worksheet.merge_range(summary_start_row,0,summary_start_row,col_offset-1,'Total Datang',summary_label_format);worksheet.merge_range(summary_start_row+1,0,summary_start_row+1,col_offset-1,'Total Telat',summary_label_format);max_late_vendors=max(len(s.get('nama_vendor_telat',[])) for s in summaries.values()) if summaries else 0
    if max_late_vendors>0: worksheet.merge_range(summary_start_row+2,0,summary_start_row+2+max_late_vendors-1,col_offset-1,'Vendor Telat',summary_label_format)
    for i,date_info in enumerate(dates):
        col=col_offset+(i*2);date_str=date_info['date_str'];summary=summaries.get(date_str,{});fmt=holiday_cell_format if date_info['is_holiday'] else cell_format;worksheet.merge_range(summary_start_row,col,summary_start_row,col+1,summary.get('total_datang',0),fmt);worksheet.merge_range(summary_start_row+1,col,summary_start_row+1,col+1,summary.get('total_telat',0),fmt);late_vendors=summary.get('nama_vendor_telat',[]);
        for j in range(max_late_vendors):vendor_name=late_vendors[j] if j<len(late_vendors) else '';worksheet.merge_range(summary_start_row+2+j,col,summary_start_row+2+j,col+1,vendor_name,fmt)
    worksheet.set_column('B:B',12);worksheet.set_column('C:C',35);worksheet.set_column('D:D',12);worksheet.set_column('E:E',15);writer.close();output.seek(0)
    filename=f"Laporan_Kedatangan_{start_date_str}_sampai_{end_date_str}.xlsx"
    return send_file(output,download_name=filename,as_attachment=True,mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@app.route('/api/download_grafik')
def download_grafik():
    start_date_str=request.args.get('start_date');end_date_str=request.args.get('end_date');response=get_grafik_data();json_data=response.get_json()
    bar_data=json_data.get('bar_chart',{});late_vendor_data=json_data.get('late_vendor_data',[]);sheet_name='Analisis Grafik'
    if not bar_data:return"Tidak ada data grafik untuk diunduh.",404
    output=io.BytesIO();writer=pd.ExcelWriter(output,engine='xlsxwriter');workbook=writer.book;worksheet=workbook.add_worksheet(sheet_name)
    header_format=workbook.add_format({'bold':True,'align':'center','valign':'vcenter','border':1,'bg_color':'#4F81BD','font_color':'white'});title_format=workbook.add_format({'bold':True,'font_size':14,'align':'center'});cell_format=workbook.add_format({'border':1,'align':'center'});text_cell_format=workbook.add_format({'border':1,'align':'left'})
    worksheet.merge_range('A1:D1',f"Analisis Kedatangan: {start_date_str} s/d {end_date_str}",title_format)
    worksheet.write('A3','Tanggal',header_format);worksheet.write('B3','Jumlah Kedatangan',header_format);worksheet.write('C3','On Schedule',header_format);worksheet.write('D3','Telat',header_format)
    row_harian=4
    for date_str,values in bar_data.items():date_obj=datetime.strptime(date_str,'%Y-%m-%d');worksheet.write(row_harian,0,date_obj.strftime('%d-%b-%Y'),cell_format);worksheet.write(row_harian,1,values['kedatangan'],cell_format);worksheet.write(row_harian,2,values['on_schedule'],cell_format);worksheet.write(row_harian,3,values['telat'],cell_format);row_harian+=1
    chart1=workbook.add_chart({'type':'column'});chart1.set_title({'name':'Analisis Kedatangan Harian'});chart1.add_series({'name':f"='{sheet_name}'!$B$3",'categories':f"='{sheet_name}'!$A$5:$A${row_harian}",'values':f"='{sheet_name}'!$B$5:$B${row_harian}"});chart1.add_series({'name':f"='{sheet_name}'!$C$3",'categories':f"='{sheet_name}'!$A$5:$A${row_harian}",'values':f"='{sheet_name}'!$C$5:$C${row_harian}"});chart1.add_series({'name':f"='{sheet_name}'!$D$3",'categories':f"='{sheet_name}'!$A$5:$A${row_harian}",'values':f"='{sheet_name}'!$D$5:$D${row_harian}"});worksheet.insert_chart('F2',chart1,{'x_scale':2,'y_scale':1.5})
    row_peringkat_start=row_harian+2;worksheet.merge_range(f'A{row_peringkat_start}:B{row_peringkat_start}','Peringkat Vendor Telat',title_format);worksheet.write(f'A{row_peringkat_start+1}','Nama Vendor',header_format);worksheet.write(f'B{row_peringkat_start+1}','Jumlah Telat',header_format)
    row_vendor=row_peringkat_start+2
    if late_vendor_data:
        for vendor_name,count in late_vendor_data:worksheet.write(row_vendor,0,vendor_name,text_cell_format);worksheet.write(row_vendor,1,count,cell_format);row_vendor+=1
        chart2=workbook.add_chart({'type':'bar'});chart2.set_title({'name':'Peringkat Vendor Telat'});chart2.add_series({'name':f"='{sheet_name}'!$B${row_peringkat_start+1}",'categories':f"='{sheet_name}'!$A${row_peringkat_start+2}:$A${row_vendor-1}",'values':f"='{sheet_name}'!$B${row_peringkat_start+2}:$B${row_vendor-1}"});chart2.set_legend({'position':'none'});worksheet.insert_chart(f'F{row_peringkat_start}',chart2,{'x_scale':2,'y_scale':1.5})
    worksheet.set_column('A:A',35);worksheet.set_column('B:D',20);writer.close();output.seek(0)
    filename=f"Analisis_Grafik_{start_date_str}_sd_{end_date_str}.xlsx"
    return send_file(output,download_name=filename,as_attachment=True,mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

# --- Menjalankan Aplikasi ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)