const cityInput = document.querySelector('.city-input')
const searchBtn = document.querySelector('.search-btn')
const weatherInfoSection = document.querySelector('.weather-info')
const notFoundSection = document.querySelector('.not-found')
const searchCitySection = document.querySelector('.search-city')

const cityText = document.querySelector('.city-text')
const tempText = document.querySelector('.temp-text')
const conditionText = document.querySelector('.condition-text')
const humidityValueText = document.querySelector('.humidity-text')
const windValueText = document.querySelector('.wind-text')
const weatherImg = document.querySelector('.weather-img')
const curdateText = document.querySelector('.curdate-text')
const forecastItemsContainer = document.querySelector('.forecast-container')

const socket = io();
let myChart = null;

// KAMUS TERJEMAHAN (Inggris -> Indonesia)
const translateWeather = {
    "Clouds": "Berawan",
    "Rain": "Hujan",
    "Clear": "Cerah",
    "Thunderstorm": "Badai Petir",
    "Drizzle": "Gerimis",
    "Snow": "Salju",
    "Mist": "Berkabut",
    "Smoke": "Asap",
    "Haze": "Berkabut",
    "Dust": "Berdebu",
    "Fog": "Kabut Tebal",
    "Sand": "Badai Pasir",
    "Ash": "Abu Vulkanik",
    "Squall": "Angin Kencang",
    "Tornado": "Puting Beliung"
};

let currentCity = ""; 
let countdownInterval = null;
const UPDATE_DURATION = 300; // 300 detik = 5 menit
let timeLeft = UPDATE_DURATION; // Waktu tersisa yang berjalan

searchBtn.addEventListener('click', () => {
    if(cityInput.value.trim() != '') {
        requestWeather(cityInput.value)
        cityInput.value = ''
        cityInput.blur()
    }
})

cityInput.addEventListener('keydown', (event) => {
    if (event.key == 'Enter' && cityInput.value.trim() != '') {
        requestWeather(cityInput.value)
        cityInput.value = ''
        cityInput.blur()
    }
})

function handleSearch() {
    if(cityInput.value.trim() != '') {
        currentCity = cityInput.value;
        
        requestWeather(currentCity, false); // Manual Search
        
        // RESET TIMER SETIAP KALI CARI MANUAL
        // Supaya user gak kaget baru cari 10 detik tiba-tiba refresh sendiri
        resetCountdown(); 
        
        cityInput.value = '';
        cityInput.blur();
    }
}

function requestWeather(city) {
    socket.emit('cari_cuaca', { city: city });
}

socket.on('update_ui', (data) => {
    console.log("Data diterima:", data); // Cek di Console browser
    updateWeatherUI(data.weather);
    updateForecastUI(data.forecast);
    renderChart(data.chart_data);
    
    // --- UPDATE KESIMPULAN (FIX UNDEFINED) ---
    const kotakSaran = document.getElementById('kotak_saran');
    const teksSaran = document.getElementById('teks_saran');
    
    // Pastikan elemen ada sebelum diisi
    if(kotakSaran && teksSaran && data.summary) {
        kotakSaran.style.display = 'block';
        teksSaran.innerText = data.summary; // Mengambil text Indonesia dari Python
        
        // Ganti warna border
        if (data.summary.includes("⚠️")) {
            kotakSaran.style.borderLeft = "5px solid #ff4757"; 
        } else {
            kotakSaran.style.borderLeft = "5px solid #2ed573"; 
        }
    }

    showDisplaySection(weatherInfoSection);
});

socket.on('error_ui', (data) => {
    showDisplaySection(notFoundSection);
});

function getWeatherIcon(id) {
    if (id <= 232) return 'thunderstorm.svg'
    if (id <= 321) return 'drizzle.svg'
    if (id <= 531) return 'rain.svg'
    if (id <= 622) return 'snow.svg'
    if (id <= 781) return 'atmosphere.svg'
    if (id <= 800) return 'clear.svg'
    else return 'clouds.svg'
}

function getCurrentDate() {
    const curDate = new Date()
    // Ubah format tanggal jadi Indonesia
    const options = { weekday: 'long', day: 'numeric', month: 'long' }
    return curDate.toLocaleDateString('id-ID', options)
}

function updateWeatherUI(data) {
    const { name: country, main: { temp, humidity }, weather: [{ id, main }], wind: { speed } } = data

    cityText.textContent = country
    tempText.textContent = Math.round(temp) + ' °C'
    
    // TERJEMAHKAN KONDISI UTAMA
    // Jika ada di kamus pakai terjemahan, jika tidak pakai aslinya
    conditionText.textContent = translateWeather[main] || main; 
    
    humidityValueText.textContent = humidity + '%'
    windValueText.textContent = speed + ' M/s'

    curdateText.textContent = getCurrentDate()
    weatherImg.src = `static/assets/weather/${getWeatherIcon(id)}`
}

function updateForecastUI(forecastData) {
    const timeTaken = '12:00:00'
    const todayDate = new Date().toISOString().split('T')[0]

    forecastItemsContainer.innerHTML = ''
    forecastData.list.forEach(forecastWeather => {
        if (forecastWeather.dt_txt.includes(timeTaken) && !forecastWeather.dt_txt.includes(todayDate)) {
            const { dt_txt: date, weather: [{ id }], main: { temp } } = forecastWeather
            
            // Format Tanggal Forecast ke Indonesia
            const dateObj = new Date(date);
            const dateResult = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

            const forecastItem = `
                <div class="forecast-item">
                    <h5 class="forecast-date regular-text">${dateResult}</h5>
                    <img class="forecast-image" src="static/assets/weather/${getWeatherIcon(id)}" />
                    <h5 class="forecast-temp">${Math.round(temp)} °C</h5>
                </div>
            `
            forecastItemsContainer.insertAdjacentHTML('beforeend', forecastItem)
        }
    })
}

function renderChart(chartData) {
    const ctx = document.getElementById('weatherChart').getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Suhu (°C)',
                data: chartData.temps,
                borderColor: 'rgba(255, 255, 255, 1)',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointRadius: 4,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { 
                    ticks: { color: 'rgba(255,255,255,0.8)', font: { size: 10 } },
                    grid: { display: false }
                },
                y: { 
                    display: false // Sembunyikan angka sumbu Y biar bersih
                }
            }
        }
    });
}

function showDisplaySection(section) {
    [weatherInfoSection, searchCitySection, notFoundSection]
        .forEach(sec => sec.style.display = 'none')
    section.style.display = 'flex'
}
function updateClock() {
    const now = new Date();
    
    // 1. Format Jam (HH:MM:SS)
    const jam = String(now.getHours()).padStart(2, '0');
    const menit = String(now.getMinutes()).padStart(2, '0');
    const detik = String(now.getSeconds()).padStart(2, '0');
    
    const jamElement = document.getElementById('jam-digital');
    if (jamElement) {
        jamElement.innerText = `${jam}:${menit}:${detik} WIB`;
    }

    // 2. Format Tanggal (Senin, 26 November 2025) - Opsional biar sinkron
    const curDateElement = document.querySelector('.curdate-text');
    if (curDateElement) {
        const options = { weekday: 'long', day: 'numeric', month: 'short' };
        // Pastikan pakai 'id-ID' untuk Bahasa Indonesia
        curDateElement.innerText = now.toLocaleDateString('id-ID', options);
    }
}

function resetCountdown() {
    // 1. Reset waktu ke awal (5 menit)
    timeLeft = UPDATE_DURATION;
    updateTimerDisplay();

    // 2. Matikan interval lama biar gak numpuk
    if (countdownInterval) clearInterval(countdownInterval);

    // 3. Mulai interval baru (jalan setiap 1 detik)
    countdownInterval = setInterval(() => {
        timeLeft--; // Kurangi 1 detik
        
        updateTimerDisplay(); // Update tulisan di layar

        // JIKA WAKTU HABIS (00:00)
        if (timeLeft <= 0) {
            // Trigger Update Otomatis
            if (currentCity) {
                requestWeather(currentCity, true);
            }
            // Kembalikan waktu ke 5 menit lagi
            timeLeft = UPDATE_DURATION; 
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerElement = document.getElementById('timer-update');
    if (timerElement) {
        // Konversi detik ke format MM:SS
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        // Tambahkan angka '0' di depan jika satuan (misal 5 jadi 05)
        const minStr = String(minutes).padStart(2, '0');
        const secStr = String(seconds).padStart(2, '0');

        timerElement.innerText = `Auto-update: ${minStr}:${secStr}`;
    }
}

// Jalankan fungsi updateClock setiap 1000ms (1 detik)
setInterval(updateClock, 1000);

// Panggil sekali saat halaman dimuat agar tidak menunggu 1 detik baru muncul
updateClock();