document.addEventListener('DOMContentLoaded', () => {
    const submenuToggle = document.querySelector('.has-submenu > a');
    if (submenuToggle) {
        submenuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.currentTarget.parentElement.classList.toggle('open');
        });
    }

    const vendorTableBody = document.getElementById('vendorTableBody');
    const addForm = document.getElementById('addVendorForm');
    const deleteForm = document.getElementById('deleteVendorForm');
    const deleteSearchInput = document.getElementById('deleteSearchInput');
    const deleteResultsList = document.getElementById('deleteResultsList');
    const deleteKodeInput = document.getElementById('deleteKode');
    const currentTimeEl = document.getElementById('current-time');
    const dynamicDateEl = document.getElementById('dynamic-date');
    
    const updateTimeAndDate = () => {
        const now = new Date();
        if (currentTimeEl) currentTimeEl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        if (dynamicDateEl) dynamicDateEl.textContent = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    };
    
    const fetchAndDisplayVendors = async () => {
        try {
            const response = await fetch('/api/get_vendors');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const vendors = await response.json();
            vendorTableBody.innerHTML = '';
            if (vendors.length > 0) {
                vendors.forEach(vendor => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${vendor.kode_supplier}</td><td>${vendor.nama_vendor}</td><td>${vendor.plant}</td><td>${vendor.truck_terminal}</td><td>${vendor.plan_arrival_time}</td>`;
                    vendorTableBody.appendChild(tr);
                });
            } else {
                vendorTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Belum ada data vendor.</td></tr>`;
            }
        } catch (error) {
            console.error('Gagal mengambil data vendor:', error);
            vendorTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Gagal memuat data.</td></tr>`;
        }
    };

    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            kode: document.getElementById('addKode').value,
            nama: document.getElementById('addNama').value,
            plant: document.getElementById('addPlant').value,
            terminal: document.getElementById('addTerminal').value,
            jadwal: document.getElementById('addJadwal').value,
        };
        try {
            const response = await fetch('/api/add_vendor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            alert(result.message);
            if (result.success) {
                addForm.reset();
                fetchAndDisplayVendors();
            }
        } catch (error) { alert('Terjadi kesalahan koneksi.'); }
    });

    deleteSearchInput.addEventListener('input', async () => {
        const query = deleteSearchInput.value;
        deleteKodeInput.value = '';
        if (query.length < 2) {
            deleteResultsList.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`/search?q=${query}`);
            const vendors = await response.json();
            deleteResultsList.innerHTML = '';
            if (vendors.length > 0) {
                vendors.forEach(vendor => {
                    const li = document.createElement('li');
                    li.textContent = `${vendor.kode_supplier} - ${vendor.nama_vendor}`;
                    li.addEventListener('click', () => {
                        deleteSearchInput.value = `${vendor.kode_supplier} - ${vendor.nama_vendor}`;
                        deleteKodeInput.value = vendor.kode_supplier;
                        deleteResultsList.style.display = 'none';
                    });
                    deleteResultsList.appendChild(li);
                });
                deleteResultsList.style.display = 'block';
            } else {
                deleteResultsList.style.display = 'none';
            }
        } catch (error) {
            console.error('Gagal mencari vendor:', error);
        }
    });

    deleteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const kode = deleteKodeInput.value;
        if (!kode) {
            alert('Silakan cari dan pilih vendor yang akan dihapus terlebih dahulu.');
            return;
        }
        if (!confirm(`Anda yakin ingin menghapus vendor dengan kode "${kode}"?`)) {
            return;
        }
        try {
            const response = await fetch('/api/delete_vendor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kode: kode }) });
            const result = await response.json();
            alert(result.message);
            if (result.success) {
                deleteForm.reset();
                fetchAndDisplayVendors();
            }
        } catch (error) { alert('Terjadi kesalahan koneksi.'); }
    });

    fetchAndDisplayVendors();
    updateTimeAndDate();
    setInterval(updateTimeAndDate, 1000);
});