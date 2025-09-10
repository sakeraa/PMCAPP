document.addEventListener('DOMContentLoaded', () => {
    const submenuToggle = document.querySelector('.has-submenu > a');
    if (submenuToggle) {
        submenuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.currentTarget.parentElement.classList.toggle('open');
        });
    }

    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const viewReportButton = document.getElementById('viewReportButton');
    const downloadButton = document.getElementById('downloadButton');
    const reportTable = document.getElementById('reportTable');
    const currentTimeEl = document.getElementById('current-time');
    const dynamicDateEl = document.getElementById('dynamic-date');

    const updateTimeAndDate = () => {
        const now = new Date();
        if (currentTimeEl) currentTimeEl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        if (dynamicDateEl) dynamicDateEl.textContent = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    };

    const formatDateForInput = (date) => date.toISOString().split('T')[0];

    const formatSelisihToHM = (minutes) => {
        if (minutes === null || minutes === undefined) return '';
        const isNegative = minutes < 0;
        const absMinutes = Math.abs(minutes);
        const hours = Math.floor(absMinutes / 60);
        const mins = absMinutes % 60;
        const formattedTime = `${hours}:${String(mins).padStart(2, '0')}`;
        return isNegative ? `-${formattedTime}` : formattedTime;
    };

    const fetchAndBuildReport = async () => {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        if (!startDate || !endDate) {
            alert('Silakan pilih rentang tanggal.');
            return;
        }
        reportTable.innerHTML = '<thead><tr><th>Memuat data laporan...</th></tr></thead><tbody></tbody>';

        try {
            const response = await fetch(`/api/laporan_data?start_date=${startDate}&end_date=${endDate}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            buildTable(result.dates, result.logs, result.summaries);
        } catch (error) {
            console.error('Gagal membangun laporan:', error);
            reportTable.innerHTML = '<thead><tr><th>Terjadi kesalahan saat memuat data.</th></tr></thead><tbody></tbody>';
        }
    };
    
    const buildTable = (dates, logs, summaries) => {
        const thead = reportTable.querySelector('thead');
        const tbody = reportTable.querySelector('tbody');
        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (!dates || dates.length === 0 || !logs || logs.length === 0) {
            thead.innerHTML = '<tr><th>Informasi</th></tr>';
            tbody.innerHTML = '<tr><td>Tidak ada data kedatangan pada rentang tanggal yang dipilih.</td></tr>';
            return;
        }

        const headerRow1 = document.createElement('tr');
        const headerRow2 = document.createElement('tr');
        const staticHeaders = ['No', 'Supplier', 'Supplier Name', 'TRUCK TERI', 'plan Arrival Tim'];
        staticHeaders.forEach(text => {
            const th = document.createElement('th');
            th.rowSpan = 2;
            th.textContent = text;
            headerRow1.appendChild(th);
        });

        dates.forEach(dateInfo => {
            const dateObj = new Date(dateInfo.date_str + 'T00:00:00');
            const thDate = document.createElement('th');
            thDate.colSpan = 2;
            thDate.textContent = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            if (dateInfo.is_holiday) thDate.classList.add('holiday-header');
            headerRow1.appendChild(thDate);

            const thActual = document.createElement('th');
            thActual.textContent = 'AKTUAL TIBA';
            if (dateInfo.is_holiday) thActual.classList.add('holiday-header');
            headerRow2.appendChild(thActual);

            const thSelisih = document.createElement('th');
            thSelisih.textContent = 'SELISIH';
            if (dateInfo.is_holiday) thSelisih.classList.add('holiday-header');
            headerRow2.appendChild(thSelisih);
        });
        thead.appendChild(headerRow1);
        thead.appendChild(headerRow2);

        logs.forEach((log, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${index + 1}</td><td>${log.vendor_kode || '-'}</td><td class="text-left">${log.vendor_nama || '-'}</td><td>${log.truck_terminal || '-'}</td><td>${log.plan_arrival_time || '-'}</td>`;
            dates.forEach(dateInfo => {
                const dateStr = dateInfo.date_str;
                const tdActual = document.createElement('td');
                const tdSelisih = document.createElement('td');
                if (log.tanggal_catat === dateStr) {
                    tdActual.textContent = log.waktu_tiba_aktual || '';
                    tdSelisih.textContent = formatSelisihToHM(log.selisih_menit);
                }
                if (dateInfo.is_holiday) {
                    tdActual.classList.add('holiday-cell');
                    tdSelisih.classList.add('holiday-cell');
                }
                tr.appendChild(tdActual);
                tr.appendChild(tdSelisih);
            });
            tbody.appendChild(tr);
        });

        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="${staticHeaders.length + dates.length * 2}" style="border: none; height: 10px;"></td>`;
        tbody.appendChild(emptyRow);
        const trTotalDatang = document.createElement('tr');
        let cellDatangLabel = `<td class="summary-label" colspan="${staticHeaders.length}">Total Datang</td>`;
        dates.forEach(dateInfo => {
            const summary = summaries[dateInfo.date_str];
            cellDatangLabel += `<td colspan="2" class="${dateInfo.is_holiday ? 'holiday-cell' : ''}">${summary.total_datang}</td>`;
        });
        trTotalDatang.innerHTML = cellDatangLabel;
        tbody.appendChild(trTotalDatang);
        const trTotalTelat = document.createElement('tr');
        let cellTelatLabel = `<td class="summary-label" colspan="${staticHeaders.length}">Total Telat</td>`;
        dates.forEach(dateInfo => {
            const summary = summaries[dateInfo.date_str];
            cellTelatLabel += `<td colspan="2" class="${dateInfo.is_holiday ? 'holiday-cell' : ''}">${summary.total_telat}</td>`;
        });
        trTotalTelat.innerHTML = cellTelatLabel;
        tbody.appendChild(trTotalTelat);
        const trVendorTelat = document.createElement('tr');
        let cellVendorLabel = `<td class="summary-label" colspan="${staticHeaders.length}">Vendor Telat</td>`;
        dates.forEach(dateInfo => {
            const summary = summaries[dateInfo.date_str];
            const vendorList = summary.nama_vendor_telat.join('<br>'); 
            cellVendorLabel += `<td colspan="2" class="text-left ${dateInfo.is_holiday ? 'holiday-cell' : ''}">${vendorList}</td>`;
        });
        trVendorTelat.innerHTML = cellVendorLabel;
        tbody.appendChild(trVendorTelat);
    };
    
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    startDateInput.value = formatDateForInput(firstDayOfMonth);
    endDateInput.value = formatDateForInput(today);
    
    viewReportButton.addEventListener('click', fetchAndBuildReport);
    
    downloadButton.addEventListener('click', () => {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        if (!startDate || !endDate) {
            alert('Silakan pilih rentang tanggal terlebih dahulu.');
            return;
        }
        window.location.href = `/api/download_laporan?start_date=${startDate}&end_date=${endDate}`;
    });

    fetchAndBuildReport(); 
    updateTimeAndDate();
    setInterval(updateTimeAndDate, 1000);
});