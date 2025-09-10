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
    const viewChartButton = document.getElementById('viewChartButton');
    const downloadChartButton = document.getElementById('downloadChartButton');
    const currentTimeEl = document.getElementById('current-time');
    const dynamicDateEl = document.getElementById('dynamic-date');
    const barChartCtx = document.getElementById('barChart').getContext('2d');
    const lateVendorTableBody = document.getElementById('lateVendorTableBody');
    let barChartInstance;

    const updateTimeAndDate = () => {
        const now = new Date();
        if (currentTimeEl) currentTimeEl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        if (dynamicDateEl) dynamicDateEl.textContent = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    };
    
    const formatDateForInput = (date) => date.toISOString().split('T')[0];

    const fetchAndBuildCharts = async () => {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        if (!startDate || !endDate) {
            alert('Silakan pilih rentang tanggal.');
            return;
        }
        try {
            const response = await fetch(`/api/grafik_data?start_date=${startDate}&end_date=${endDate}`);
             if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            buildBarChart(result.bar_chart);
            buildLateVendorTable(result.late_vendor_data);
        } catch (error) {
            console.error('Gagal mengambil data grafik:', error);
        }
    };

    const buildBarChart = (data) => {
        if (barChartInstance) barChartInstance.destroy();
        const labels = Object.keys(data).map(dateStr => new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
        barChartInstance = new Chart(barChartCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Jumlah Kedatangan', data: Object.values(data).map(d => d.kedatangan), backgroundColor: '#3498db' },
                    { label: 'On Schedule', data: Object.values(data).map(d => d.on_schedule), backgroundColor: '#2ecc71' },
                    { label: 'Telat', data: Object.values(data).map(d => d.telat), backgroundColor: '#e74c3c' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } }
            }
        });
    };

    const buildLateVendorTable = (lateVendors) => {
        lateVendorTableBody.innerHTML = '';
        if (!lateVendors || lateVendors.length === 0) {
            lateVendorTableBody.innerHTML = `<tr><td colspan="2" style="text-align: center;">Tidak ada data vendor telat.</td></tr>`;
            return;
        }
        lateVendors.forEach(vendorData => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${vendorData[0]}</td><td>${vendorData[1]}</td>`;
            lateVendorTableBody.appendChild(tr);
        });
    };

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    startDateInput.value = formatDateForInput(firstDayOfMonth);
    endDateInput.value = formatDateForInput(today);
    
    viewChartButton.addEventListener('click', fetchAndBuildCharts);

    downloadChartButton.addEventListener('click', () => {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        if (!startDate || !endDate) {
            alert('Silakan pilih rentang tanggal terlebih dahulu.');
            return;
        }
        window.location.href = `/api/download_grafik?start_date=${startDate}&end_date=${endDate}`;
    });

    fetchAndBuildCharts();
    updateTimeAndDate();
    setInterval(updateTimeAndDate, 1000);
});