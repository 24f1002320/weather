import 'dotenv/config';
const apiKey = process.env.apiKey;

const searchBtn = document.getElementById("searchBtn");
const cityInput = document.getElementById("cityInput");

searchBtn.addEventListener("click", () => {
  const city = cityInput.value.trim();

  if (!city) {
    alert("Please enter a city name.");
    return;
  }

  fetchWeather(city);
});

cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
});

function fetchWeather(city) {
  if (!apiKey || apiKey.startsWith("sk-")) {
    alert("Please set a valid OpenWeatherMap API key in `index.js` (replace the `apiKey` value).");
    return;
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

  fetch(url)
    .then((response) => {
      if (!response.ok) {
        if (response.status === 401) {
          return response.json().then((err) => {
            const msg = err && err.message ? err.message : 'Invalid API key';
            throw new Error(`401 Unauthorized - ${msg}. Replace the 'apiKey' value in index.js with a valid OpenWeatherMap API key: https://openweathermap.org/`);
          }).catch(() => {
            throw new Error("401 Unauthorized - Invalid API key. Replace the 'apiKey' value in index.js with a valid OpenWeatherMap API key: https://openweathermap.org/");
          });
        }

        return response.json().then((err) => {
          const msg = err && err.message ? err.message : `HTTP ${response.status}`;
          throw new Error(msg);
        }).catch(() => {
          throw new Error(`HTTP ${response.status}`);
        });
      }

      return response.json();
    })
    .then((data) => {
      if (!data || (data.cod && Number(data.cod) !== 200)) {
        const msg = data && data.message ? data.message : 'City not found';
        alert(`Error: ${msg}`);
        return;
      }

      const cityNameEl = document.getElementById("cityName");
      const temperatureEl = document.getElementById("temperature");
      const conditionEl = document.getElementById("condition");
      const resultEl = document.getElementById("weatherResult");

      if (cityNameEl) cityNameEl.textContent = data.name || city;
      if (temperatureEl) temperatureEl.textContent = (data.main && data.main.temp) ? `${data.main.temp}°C` : 'N/A';
      if (conditionEl) conditionEl.textContent = (data.weather && data.weather[0] && data.weather[0].description) ? data.weather[0].description : 'N/A';
      if (resultEl) resultEl.classList.remove("hidden");
      // set current icon if available
      const currentIconEl = document.getElementById("currentIcon");
      if (currentIconEl && data.weather && data.weather[0] && data.weather[0].icon) {
        currentIconEl.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
        currentIconEl.alt = data.weather[0].description || 'weather icon';
      }

      // fetch 5-day forecast
      fetchForecast(city);

      // update hero / first impression
      const heroEl = document.getElementById('hero');
      const heroIcon = document.getElementById('heroIcon');
      const heroCity = document.getElementById('heroCity');
      const heroTemp = document.getElementById('heroTemp');
      const heroCond = document.getElementById('heroCond');
      if (heroEl) {
        // determine theme class from weather main
        const main = data.weather && data.weather[0] && data.weather[0].main ? data.weather[0].main.toLowerCase() : '';
        let theme = 'theme-clear';
        if (main.includes('cloud')) theme = 'theme-clouds';
        else if (main.includes('rain')) theme = 'theme-rain';
        else if (main.includes('drizzle')) theme = 'theme-drizzle';
        else if (main.includes('thunder')) theme = 'theme-thunderstorm';
        else if (main.includes('snow')) theme = 'theme-snow';
        else if (main.includes('mist') || main.includes('fog') || main.includes('haze')) theme = 'theme-mist';

        // temp feel
        const tempVal = data.main && typeof data.main.temp === 'number' ? data.main.temp : null;
        let feel = '';
        if (tempVal !== null) {
          if (tempVal >= 30) feel = 'feel-hot';
          else if (tempVal >= 20) feel = 'feel-warm';
          else if (tempVal >= 10) feel = 'feel-cool';
          else feel = 'feel-cold';
        }

        // apply classes
        heroEl.className = `hero ${theme} ${feel}`;
        if (heroIcon && data.weather[0].icon) {
          heroIcon.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;
          heroIcon.alt = data.weather[0].description || 'weather icon';
        }
        if (heroCity) heroCity.textContent = data.name || city;
        if (heroTemp) heroTemp.textContent = tempVal !== null ? `${Math.round(tempVal)}°C` : '';
        if (heroCond) heroCond.textContent = data.weather && data.weather[0] ? data.weather[0].description : '';
        heroEl.classList.remove('hidden');
        // remove empty state when populated
        heroEl.classList.remove('empty');
      }
    })
    .catch((err) => {
      alert(`Error fetching weather data: ${err.message}`);
      console.error('Weather fetch error:', err);
    });
}

// when fetch fails or user input is invalid, restore the empty hero look
function restoreEmptyHero() {
  const heroEl = document.getElementById('hero');
  if (!heroEl) return;
  heroEl.className = 'hero empty';
}

// restore empty on fetch errors globally
window.addEventListener('error', () => restoreEmptyHero());

function fetchForecast(city) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

  fetch(url)
    .then((res) => {
      if (!res.ok) return res.json().then(e => { throw new Error(e.message || `HTTP ${res.status}`); });
      return res.json();
    })
    .then((data) => {
      renderForecast(data);
    })
    .catch((err) => {
      console.error('Forecast fetch error:', err);
    });
}

function renderForecast(forecastData) {
  const forecastEl = document.getElementById('forecast');
  if (!forecastEl || !forecastData || !forecastData.list) return;

  // Group entries by date (YYYY-MM-DD)
  const groups = {};
  forecastData.list.forEach(item => {
    const date = new Date(item.dt * 1000).toISOString().split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
  });

  // get sorted dates and skip today
  const dates = Object.keys(groups).sort();
  const today = new Date().toISOString().split('T')[0];
  const nextDates = dates.filter(d => d !== today).slice(0,5);

  // build cards
  forecastEl.innerHTML = '';
  nextDates.forEach(date => {
    const items = groups[date];
    // choose the item closest to 12:00
    let best = items[0];
    const targetHour = 12;
    let bestDiff = Math.abs(new Date(items[0].dt * 1000).getHours() - targetHour);
    for (let i=1;i<items.length;i++){
      const h = new Date(items[i].dt * 1000).getHours();
      const diff = Math.abs(h - targetHour);
      if (diff < bestDiff) { best = items[i]; bestDiff = diff; }
    }

    const dt = new Date(best.dt * 1000);
    const dayLabel = dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const icon = best.weather && best.weather[0] ? best.weather[0].icon : '';
    const desc = best.weather && best.weather[0] ? best.weather[0].description : '';
    const temp = best.main && best.main.temp ? Math.round(best.main.temp) : 'N/A';

    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.innerHTML = `
      <div class="date">${dayLabel}</div>
      <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}" />
      <div class="temp">${temp}°C</div>
      <div class="desc">${desc}</div>
    `;

    forecastEl.appendChild(card);
  });
}
