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

// KAMUS TERJEMAHAN
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
let timeLeft = UPDATE_DURATION; 

// --- PERBAIKAN EVENT LISTENER ---
// Sekarang memanggil handleSearch, bukan requestWeather langsung
searchBtn.addEventListener('click', () => {
    handleSearch();
})

cityInput.addEventListener('keydown', (event) => {
    if (event.key == 'Enter') {
        handleSearch();
    }
})

function handleSearch() {
    if(cityInput.value.trim() != '') {
        currentCity = cityInput.value;
        
        // False = Manual Search (Simpan ke History)
        requestWeather(currentCity, false); 
        
        resetCountdown(); 
        
        cityInput.value = '';
        cityInput.blur();
    }
}

// --- PERBAIKAN REQUEST WEATHER ---
// Menambahkan parameter isAuto
function requestWeather(city, isAuto = false) {
    socket.emit('cari_cuaca', { city: city, is_auto: isAuto });
}

socket.on('update_ui', (data) => {
    console.log("Data diterima:", data);
    updateWeatherUI(data.weather);
    updateForecastUI(data.forecast);
    renderChart(data.chart_data);
    
    // UPDATE KESIMPULAN
    const kotakSaran = document.getElementById('kotak_saran');
    const teksSaran = document.getElementById('teks_saran');
    
    if(kotakSaran && teksSaran && data.summary) {
        kotakSaran.style.display = 'block';
        teksSaran.innerText = data.summary;
        
        if (data.summary.includes("⚠️")) {
            kotakSaran.style.borderLeft = "5px solid #ff4757"; 
        } else {
            kotakSaran.style.borderLeft = "5px solid #2ed573"; 
        }
    }

    showDisplaySection(weatherInfoSection);
});

// TERIMA UPDATE HISTORY DARI SERVER
socket.on('update_history', (historyData) => {
    updateHistoryUI(historyData);
});

socket.on('error_ui', (data) => {
    showDisplaySection(notFoundSection);
});

// FUNGSI RENDER HISTORY KE HTML
function updateHistoryUI(data) {
    const historyContainer = document.querySelector('.history-list');
    if (!historyContainer) return; // Cek jika elemen ada

    historyContainer.innerHTML = ''; // Reset list

    data.forEach(item => {
        // Konversi waktu UTC Server ke WIB
        const dateObj = new Date(item.waktu + " UTC");
        const timeString = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const dateString = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        const kondisiIndo = translateWeather[item.kondisi] || item.kondisi;

        const htmlItem = `
            <div class="history-item">
                <div class="history-left">
                    <span class="history-city">${item.kota} <small>(${kondisiIndo})</small></span>
                    <span class="history-time">${dateString}, ${timeString}</span>
                </div>
                <div class="history-temp">${item.suhu}°C</div>
            </div>
        `;
        historyContainer.insertAdjacentHTML('beforeend', htmlItem);
    });
}

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
    const options = { weekday: 'long', day: 'numeric', month: 'long' }
    return curDate.toLocaleDateString('id-ID', options)
}

function updateWeatherUI(data) {
    const { name: country, main: { temp, humidity }, weather: [{ id, main }], wind: { speed } } = data

    cityText.textContent = country
    tempText.textContent = Math.round(temp) + ' °C'
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
                y: { display: false }
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
    const jam = String(now.getHours()).padStart(2, '0');
    const menit = String(now.getMinutes()).padStart(2, '0');
    const detik = String(now.getSeconds()).padStart(2, '0');
    
    const jamElement = document.getElementById('jam-digital');
    if (jamElement) {
        jamElement.innerText = `${jam}:${menit}:${detik} WIB`;
    }
}

function resetCountdown() {
    timeLeft = UPDATE_DURATION;
    updateTimerDisplay();

    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
        timeLeft--; 
        updateTimerDisplay(); 

        if (timeLeft <= 0) {
            // Auto Update = True
            if (currentCity) {
                requestWeather(currentCity, true);
            }
            timeLeft = UPDATE_DURATION; 
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerElement = document.getElementById('timer-update');
    if (timerElement) {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        const minStr = String(minutes).padStart(2, '0');
        const secStr = String(seconds).padStart(2, '0');
        timerElement.innerText = `Update dalam: ${minStr}:${secStr}`;
    }
}

setInterval(updateClock, 1000);
updateClock();