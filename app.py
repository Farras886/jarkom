from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
import requests
# 1. TAMBAHKAN 'timedelta' DI SINI
from datetime import datetime, timedelta 

app = Flask(__name__)
# ... (Config lain tetap sama) ...
app.config['SECRET_KEY'] = 'rahasia_project_akhir'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cuaca.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")
API_KEY = "f437ef3ab68d2f3b2cf1d916f89d2448"

class RiwayatPencarian(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    kota = db.Column(db.String(100), nullable=False)
    suhu = db.Column(db.String(10), nullable=False)
    waktu = db.Column(db.DateTime, default=datetime.utcnow)

with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

def get_weather_data(city):
    # ... (Request API weather & forecast tetap sama) ...
    url_weather = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&units=metric&lang=id"
    res_weather = requests.get(url_weather).json()
    
    if res_weather.get('cod') != 200:
        return None

    url_forecast = f"https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={API_KEY}&units=metric&lang=id"
    res_forecast = requests.get(url_forecast).json()

    chart_labels = []
    chart_temps = []
    
    temp_total = 0
    count = 0
    will_rain = False
    rain_time = ""
    
    # 2. UPDATE LOGIKA LOOPING INI
    for item in res_forecast['list'][:8]: # Ambil 8 data (24 jam kedepan)
        # KONVERSI WAKTU UTC KE WIB
        utc_time_str = item['dt_txt'] # Contoh: "2025-11-26 15:00:00"
        utc_dt = datetime.strptime(utc_time_str, "%Y-%m-%d %H:%M:%S")
        
        # Tambah 7 Jam untuk WIB
        wib_dt = utc_dt + timedelta(hours=7)
        
        # Ambil Jam yang sudah WIB (Hanya Jam:Menit)
        jam_indo = wib_dt.strftime("%H:%M") 
        
        # Masukkan ke data grafik
        chart_labels.append(jam_indo)
        chart_temps.append(round(item['main']['temp']))
        
        # Hitung Rata-rata & Cek Hujan
        suhu = item['main']['temp']
        kondisi = item['weather'][0]['main']
        temp_total += suhu
        count += 1
        
        if kondisi in ['Rain', 'Thunderstorm', 'Drizzle'] and not will_rain:
            will_rain = True
            rain_time = jam_indo # Gunakan jam yang sudah dikonversi

    avg_temp = round(temp_total / count, 1) if count > 0 else 0
    
    # ... (Logika Saran tetap sama) ...
    saran = ""
    if will_rain:
        saran = f"⚠️ Waspada! Diprediksi hujan turun sekitar jam {rain_time}. Siapkan payung."
    elif avg_temp > 33:
        saran = f"☀️ Cuaca panas terik (Rata-rata {avg_temp}°C). Jangan lupa minum air."
    elif avg_temp < 20:
        saran = f"❄️ Udara cukup dingin (Rata-rata {avg_temp}°C). Pakai jaket hangat."
    else:
        saran = f"✅ Cuaca aman & kondusif (Rata-rata {avg_temp}°C). Cocok untuk aktivitas luar."

    return {
        'weather': res_weather,
        'forecast': res_forecast,
        'summary': saran,
        'avg_temp': avg_temp,
        'chart_data': {
            'labels': chart_labels,
            'temps': chart_temps
        }
    }

@socketio.on('cari_cuaca')
def handle_cari_cuaca(data):
    city = data['city']
    result = get_weather_data(city)
    
    if result:
        # Simpan ke DB (Opsional)
        try:
            riwayat = RiwayatPencarian(kota=result['weather']['name'], suhu=str(round(result['weather']['main']['temp'])))
            db.session.add(riwayat)
            db.session.commit()
        except:
            pass
        emit('update_ui', result)
    else:
        emit('error_ui', {'pesan': 'Kota tidak ditemukan'})

if __name__ == '__main__':
    socketio.run(app, debug=True)