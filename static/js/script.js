document.addEventListener('DOMContentLoaded', () => {
    const submenuToggle = document.querySelector('.has-submenu > a');
    if (submenuToggle) {
        submenuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.currentTarget.parentElement.classList.toggle('open');
        });
    }

    const searchInput = document.getElementById('searchInput');
    const resultsList = document.getElementById('resultsList');
    const vendorNotFoundMessage = document.getElementById('vendorNotFoundMessage');
    const detailKode = document.getElementById('detail-kode');
    const detailNama = document.getElementById('detail-nama');
    const detailPlant = document.getElementById('detail-plant');
    const detailTerminal = document.getElementById('detail-terminal');
    const detailJadwal = document.getElementById('detail-jadwal');
    const detailSelisih = document.getElementById('detail-selisih');
    const arrivalDateInput = document.getElementById('arrivalDateInput');
    const actualHourInput = document.getElementById('actualHourInput');
    const actualMinuteInput = document.getElementById('actualMinuteInput');
    const saveButton = document.getElementById('saveButton');
    const currentTimeEl = document.getElementById('current-time');
    const dynamicDateEl = document.getElementById('dynamic-date');
    let selisihMenitGlobal = 0;

    const updateTimeAndDate = () => {
        const now = new Date();
        if (currentTimeEl) currentTimeEl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        if (dynamicDateEl) dynamicDateEl.textContent = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    };

    const loadSelectedDate = () => {
        const savedDate = localStorage.getItem('selectedArrivalDate');
        if (savedDate) {
            arrivalDateInput.value = savedDate;
        } else {
            arrivalDateInput.value = new Date().toISOString().split('T')[0];
        }
    };

    const saveSelectedDate = () => {
        localStorage.setItem('selectedArrivalDate', arrivalDateInput.value);
    };

    loadSelectedDate();
    arrivalDateInput.addEventListener('change', saveSelectedDate);

    const calculateAndDisplayDifference = () => {
        const jadwalText = detailJadwal.textContent;
        const jamAktual = actualHourInput.value;
        const menitAktual = actualMinuteInput.value;

        if (jadwalText === '-' || !jadwalText || !jamAktual || !menitAktual) {
            detailSelisih.textContent = '-';
            detailSelisih.className = 'selisih-highlight';
            return;
        }

        try {
            const [jadwalJam, jadwalMenit] = jadwalText.split(':').map(Number);
            const totalMenitJadwal = (jadwalJam * 60) + jadwalMenit;
            const totalMenitAktual = (parseInt(jamAktual) * 60) + parseInt(menitAktual);

            if (isNaN(totalMenitJadwal) || isNaN(totalMenitAktual)) return;

            selisihMenitGlobal = totalMenitAktual - totalMenitJadwal;
            const absSelisih = Math.abs(selisihMenitGlobal);
            detailSelisih.className = 'selisih-highlight';
            let selisihText = '';

            if (selisihMenitGlobal >= 60 || selisihMenitGlobal <= -60) {
                detailSelisih.classList.add('status-bahaya');
                const jam = Math.floor(absSelisih / 60);
                const menit = absSelisih % 60;
                selisihText = `${jam} jam ${menit} menit (LATE)`;
            } else {
                detailSelisih.classList.add('status-aman');
                if (selisihMenitGlobal === 0) {
                    selisihText = 'Tepat Waktu (SAVE)';
                } else {
                    selisihText = `${absSelisih} menit (SAVE)`;
                }
            }
            detailSelisih.textContent = selisihText.trim();

        } catch (error) {
            detailSelisih.textContent = '-';
        }
    };

    const searchVendors = async (query) => {
        if (query.length < 1) {
            resultsList.style.display = 'none';
            vendorNotFoundMessage.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
            const vendors = await response.json();
            displayResults(vendors);
        } catch (error) { console.error('Error fetching search results:', error); }
    };

    const displayResults = (vendors) => {
        resultsList.innerHTML = '';
        if (vendors.length === 0) {
            resultsList.style.display = 'none';
            vendorNotFoundMessage.style.display = 'block';
        } else {
            vendorNotFoundMessage.style.display = 'none';
            vendors.forEach(vendor => {
                const li = document.createElement('li');
                li.textContent = `${vendor.nama_vendor} (${vendor.kode_supplier || 'Tanpa Kode'})`;
                li.dataset.vendor = JSON.stringify(vendor);
                resultsList.appendChild(li);
            });
            resultsList.style.display = 'block';
        }
    };

    const resetForm = () => {
        detailKode.textContent = '-';
        detailNama.textContent = '-';
        detailPlant.textContent = '-';
        detailTerminal.textContent = '-';
        detailJadwal.textContent = '-';
        detailSelisih.textContent = '-';
        detailSelisih.className = 'selisih-highlight';
        actualHourInput.value = '';
        actualMinuteInput.value = '';
        searchInput.value = '';
        resultsList.style.display = 'none';
        vendorNotFoundMessage.style.display = 'none';
    };

    setInterval(updateTimeAndDate, 1000);
    updateTimeAndDate();

    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => searchVendors(searchInput.value), 300);
    });

    resultsList.addEventListener('click', (e) => {
        if (e.target.nodeName === 'LI' && e.target.dataset.vendor) {
            const vendorData = JSON.parse(e.target.dataset.vendor);
            detailKode.textContent = vendorData.kode_supplier || '-';
            detailNama.textContent = vendorData.nama_vendor || '-';
            detailPlant.textContent = vendorData.plant || '-';
            detailTerminal.textContent = vendorData.truck_terminal || '-';
            detailJadwal.textContent = vendorData.plan_arrival_time || '-';
            searchInput.value = '';
            resultsList.style.display = 'none';
            actualHourInput.focus();
            calculateAndDisplayDifference();
        }
    });

    actualHourInput.addEventListener('input', calculateAndDisplayDifference);
    actualMinuteInput.addEventListener('input', calculateAndDisplayDifference);

    saveButton.addEventListener('click', async () => {
        const dataToSave = {
            kode: detailKode.textContent,
            nama: detailNama.textContent,
            waktu: `${actualHourInput.value.padStart(2, '0')}:${actualMinuteInput.value.padStart(2, '0')}`,
            selisihMenit: selisihMenitGlobal,
            status: detailSelisih.textContent,
            tanggal: arrivalDateInput.value
        };
        if (dataToSave.nama === '-' || !actualHourInput.value || !actualMinuteInput.value || !dataToSave.tanggal) {
            alert('Silakan pilih vendor, isi tanggal, dan jam tiba aktual.');
            return;
        }
        try {
            const response = await fetch('/api/save_arrival', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSave) });
            const result = await response.json();
            alert(result.message);
            if (result.success) resetForm();
        } catch (error) {
            alert('Gagal terhubung ke server untuk menyimpan data.');
        }
    });
});