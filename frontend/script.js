// === Configuration ===
// Vercel rewrites /api/* → AWS backend
const API_BASE_URL = '';

// === State ===
let googleMap = null;
let directionsRenderer = null;
let routePolyline = null;
let placesAutocompleteStart = null;
let placesAutocompleteEnd = null;
let lastApiResponse = null;
let mapInitialized = false;

// === Bootstrap: Fetch Maps Key then Load Google Maps ===
async function bootstrap() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/maps-key`);
        const { key } = await res.json();
        loadGoogleMapsScript(key);
    } catch (err) {
        console.error('Could not fetch Maps API key:', err);
        // Fallback: init app without map
        initApp();
    }
}

function loadGoogleMapsScript(key) {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry&callback=onGoogleMapsReady`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

// Called by Google Maps SDK once loaded
window.onGoogleMapsReady = function () {
    initApp();
};

// === Main App Init ===
function initApp() {
    // === DOM Elements ===
    const landingView = document.getElementById('landing-view');
    const appView = document.getElementById('app-view');
    const authModal = document.getElementById('auth-modal');
    const navSigninBtn = document.getElementById('nav-signin');
    const heroGetStartedBtn = document.getElementById('hero-get-started');
    const closeModalBtn = document.getElementById('close-modal');
    const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
    const modalTitle = document.getElementById('modal-title');
    const authForm = document.getElementById('auth-form');
    const calcBestRouteBtn = document.getElementById('calc-best-route');
    const menuToggleBtn = document.getElementById('menu-toggle');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const logoutBtn = document.getElementById('logout-btn');
    const findRouteBtn = document.getElementById('find-route-btn');
    const routeResult = document.getElementById('route-result');
    const startLocationInput = document.getElementById('start-location');
    const endLocationInput = document.getElementById('end-location');
    const modeSelector = document.getElementById('mode-selector');
    const navLinks = document.querySelectorAll('.nav-link');

    // Weather
    const weatherIconEl = document.getElementById('weather-icon');
    const currentTempEl = document.getElementById('current-temp');
    const currentDescEl = document.getElementById('current-desc');
    const feelsLikeEl = document.getElementById('feels-like');
    const rainChanceEl = document.getElementById('rain-chance');
    const precipMmEl = document.getElementById('precip-mm');
    const policyBadgeEl = document.getElementById('policy-badge');

    // Route result
    const routeModeIconEl = document.getElementById('route-mode-icon');
    const routeDurationEl = document.getElementById('route-duration');
    const routeDistanceEl = document.getElementById('route-distance');
    const routeSummaryEl = document.getElementById('route-summary');
    const routeReasonEl = document.getElementById('route-reason');
    const routeWarningEl = document.getElementById('route-warning');
    const alternativesPanel = document.getElementById('alternatives-panel');
    const alternativesList = document.getElementById('alternatives-list');

    let isSignUpMode = false;
    let isMenuOpen = false;

    // === Places Autocomplete (if Google Maps loaded) ===
    if (window.google?.maps?.places) {
        const manilaLatLng = new google.maps.LatLng(14.5995, 120.9842);
        const manilaRadius = 50000; // 50km around Manila
        const autocompleteOptions = {
            location: manilaLatLng,
            radius: manilaRadius,
            componentRestrictions: { country: 'ph' },
        };

        placesAutocompleteStart = new google.maps.places.Autocomplete(startLocationInput, autocompleteOptions);
        placesAutocompleteEnd = new google.maps.places.Autocomplete(endLocationInput, autocompleteOptions);

        // Prevent form submit on autocomplete selection
        [placesAutocompleteStart, placesAutocompleteEnd].forEach(ac => {
            ac.addListener('place_changed', () => { /* selection handled */ });
        });
    }

    // === Nav / Scroll ===
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            document.querySelector(this.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
        });
    });

    // === Modal ===
    const openModal = () => authModal.classList.remove('hidden');
    const closeModal = () => authModal.classList.add('hidden');

    navSigninBtn.addEventListener('click', openModal);
    heroGetStartedBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    authModal.addEventListener('click', (e) => { if (e.target === authModal) closeModal(); });

    toggleAuthModeBtn.addEventListener('click', () => {
        isSignUpMode = !isSignUpMode;
        if (isSignUpMode) {
            modalTitle.textContent = 'Create an Account';
            authForm.querySelector('button[type="submit"]').textContent = 'Sign Up';
            toggleAuthModeBtn.parentElement.innerHTML = 'Already have an account? <button type="button" id="toggle-auth-mode" class="btn-text highlight">Sign In</button>';
        } else {
            modalTitle.textContent = 'Welcome Back';
            authForm.querySelector('button[type="submit"]').textContent = 'Sign In';
            toggleAuthModeBtn.parentElement.innerHTML = 'Don\'t have an account? <button type="button" id="toggle-auth-mode" class="btn-text highlight">Sign Up</button>';
        }
        document.getElementById('toggle-auth-mode').addEventListener('click', () => toggleAuthModeBtn.click());
    });

    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        closeModal();
        enterAppView();
    });

    calcBestRouteBtn.addEventListener('click', () => enterAppView());

    // === Hamburger ===
    menuToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isMenuOpen = !isMenuOpen;
        dropdownMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
        if (isMenuOpen) { dropdownMenu.classList.add('hidden'); isMenuOpen = false; }
    });

    // === Logout ===
    logoutBtn.addEventListener('click', () => {
        appView.classList.add('hidden');
        landingView.classList.remove('hidden');
        document.body.style.overflow = 'auto';
        window.scrollTo(0, 0);
    });

    // === Mode Selector ===
    modeSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.mode-btn');
        if (!btn) return;
        btn.classList.toggle('active');
        if (modeSelector.querySelectorAll('.mode-btn.active').length === 0) {
            btn.classList.add('active');
        }
    });

    function getSelectedModes() {
        return [...modeSelector.querySelectorAll('.mode-btn.active')].map(b => b.dataset.mode);
    }

    // === Route API Call ===
    findRouteBtn.addEventListener('click', async () => {
        const origin = startLocationInput.value.trim();
        const destination = endLocationInput.value.trim();
        if (!origin || !destination) return;

        const originalHTML = findRouteBtn.innerHTML;
        findRouteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Calculating...';
        findRouteBtn.disabled = true;
        routeResult.classList.add('hidden');

        try {
            const response = await fetch(`${API_BASE_URL}/api/commute-routes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin, destination, modes: getSelectedModes() }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'Unknown server error.' }));
                throw new Error(err.error || `Server error: ${response.status}`);
            }

            const data = await response.json();
            lastApiResponse = data;
            handleRouteResponse(data, null);

        } catch (err) {
            console.error('Route fetch failed:', err);
            showRouteError(err.message);
        } finally {
            findRouteBtn.innerHTML = originalHTML;
            findRouteBtn.disabled = false;
        }
    });

    // === Handle API Response ===
    function handleRouteResponse(data, selectedAltIndex) {
        const { recommendation, alternatives, weather, policy } = data;

        if (weather) updateWeatherWidget(weather, policy);

        if (!recommendation) {
            showRouteError('No route could be found for this trip.');
            return;
        }

        const displayRoute = selectedAltIndex !== null && alternatives?.[selectedAltIndex]
            ? alternatives[selectedAltIndex]
            : recommendation;

        routeModeIconEl.innerHTML = getModeIcon(displayRoute.mode);
        routeDurationEl.textContent = `${displayRoute.durationMinutes} mins`;
        routeDistanceEl.textContent = displayRoute.distanceKm ? `· ${displayRoute.distanceKm} km` : '';
        routeSummaryEl.textContent = displayRoute.summary || '';
        routeReasonEl.textContent = displayRoute.recommendationReason || '';

        if (policy?.message) {
            routeWarningEl.innerHTML = `${getPolicyIcon(policy.condition)} <span>${policy.message}</span>`;
            routeWarningEl.style.display = 'flex';
        } else {
            routeWarningEl.style.display = 'none';
        }

        routeResult.classList.remove('hidden');

        if (displayRoute.encodedPolyline) {
            drawRouteOnMap(displayRoute.encodedPolyline);
        }

        renderAlternatives(recommendation, alternatives, selectedAltIndex);
    }

    function showRouteError(message) {
        routeModeIconEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="color:#ef4444;"></i>';
        routeDurationEl.textContent = 'Error';
        routeDistanceEl.textContent = '';
        routeSummaryEl.textContent = '';
        routeReasonEl.textContent = '';
        routeWarningEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${message}</span>`;
        routeWarningEl.style.display = 'flex';
        routeResult.classList.remove('hidden');
        alternativesPanel.classList.add('hidden');
    }

    // === Alternatives Panel ===
    function renderAlternatives(recommendation, alternatives, selectedAltIndex) {
        if (!alternatives || alternatives.length === 0) {
            alternativesPanel.classList.add('hidden');
            return;
        }

        alternativesList.innerHTML = '';
        const allRoutes = [recommendation, ...alternatives];

        allRoutes.forEach((route, idx) => {
            const isSelected = (selectedAltIndex === null && idx === 0) ||
                (selectedAltIndex !== null && idx === selectedAltIndex + 1);
            const isBest = idx === 0;

            const item = document.createElement('div');
            item.className = `alt-route-item${isSelected ? ' selected' : ''}`;
            item.innerHTML = `
                <div class="alt-mode-icon">${getModeIcon(route.mode)}</div>
                <div class="alt-info">
                    <div class="alt-duration">${route.durationMinutes} mins${isBest ? ' <span style="color:#22c55e;font-size:0.7rem;">★ Best</span>' : ''}</div>
                    <div class="alt-detail">${route.distanceKm ? route.distanceKm + ' km · ' : ''}${route.summary || modeLabel(route.mode)}</div>
                </div>
            `;
            item.addEventListener('click', () => {
                const altIdx = idx === 0 ? null : idx - 1;
                handleRouteResponse(lastApiResponse, altIdx);
            });
            alternativesList.appendChild(item);
        });

        alternativesPanel.classList.remove('hidden');
    }

    // === Weather Widget ===
    function updateWeatherWidget(weather, policy) {
        if (currentTempEl) currentTempEl.textContent = weather.temperatureC !== null ? `${Math.round(weather.temperatureC)}°C` : '--°C';
        if (currentDescEl) currentDescEl.textContent = getWeatherDescription(weather.weatherCode);
        if (feelsLikeEl) feelsLikeEl.textContent = weather.apparentTemperatureC !== null ? `Feels like ${Math.round(weather.apparentTemperatureC)}°C` : 'Feels like --°C';
        if (rainChanceEl) rainChanceEl.textContent = weather.precipitationProbability !== undefined ? `${weather.precipitationProbability}%` : '--%';
        if (precipMmEl) precipMmEl.textContent = weather.precipitationMm !== undefined ? `${weather.precipitationMm} mm` : '-- mm';
        if (weatherIconEl) weatherIconEl.innerHTML = getWeatherIconHTML(weather.weatherCode);
        if (policyBadgeEl && policy) {
            policyBadgeEl.className = 'policy-badge';
            if (policy.condition === 'HIGH_PRECIPITATION') {
                policyBadgeEl.textContent = 'RAIN ALERT';
                policyBadgeEl.classList.add('policy-rain');
            } else if (policy.condition === 'HIGH_HEAT_INDEX') {
                policyBadgeEl.textContent = policy.heatIndex?.label ? `PAGASA ${policy.heatIndex.label}` : 'HEAT ALERT';
                policyBadgeEl.classList.add('policy-heat');
            } else if (policy.heatIndex?.category === 'CAUTION') {
                policyBadgeEl.textContent = 'PAGASA CAUTION';
                policyBadgeEl.classList.add('policy-heat');
            } else {
                policyBadgeEl.textContent = 'NORMAL';
                policyBadgeEl.classList.add('policy-normal');
            }
        }
    }

    function getWeatherDescription(code) {
        if (code === null || code === undefined) return 'Loading...';
        if (code === 0) return 'Clear Sky';
        if (code <= 3) return 'Partly Cloudy';
        if (code <= 49) return 'Foggy';
        if (code <= 59) return 'Drizzle';
        if (code <= 69) return 'Rain';
        if (code <= 79) return 'Snow';
        if (code <= 82) return 'Rain Showers';
        if (code <= 86) return 'Snow Showers';
        if (code <= 99) return 'Thunderstorm';
        return 'Unknown';
    }

    function getWeatherIconHTML(code) {
        let iconClass = 'fa-solid fa-cloud-sun', color = '#60a5fa';
        if (code === 0) { iconClass = 'fa-solid fa-sun'; color = '#fcd34d'; }
        else if (code <= 3) { iconClass = 'fa-solid fa-cloud-sun'; color = '#94a3b8'; }
        else if (code <= 49) { iconClass = 'fa-solid fa-smog'; color = '#94a3b8'; }
        else if (code <= 59) { iconClass = 'fa-solid fa-cloud-drizzle'; color = '#60a5fa'; }
        else if (code <= 69) { iconClass = 'fa-solid fa-cloud-rain'; color = '#60a5fa'; }
        else if (code <= 82) { iconClass = 'fa-solid fa-cloud-showers-heavy'; color = '#3b82f6'; }
        else if (code <= 86) { iconClass = 'fa-solid fa-snowflake'; color = '#bfdbfe'; }
        else if (code <= 99) { iconClass = 'fa-solid fa-cloud-bolt'; color = '#fbbf24'; }
        return `<i class="${iconClass}" style="font-size:3rem;color:${color};"></i>`;
    }

    // === Helpers ===
    function getModeIcon(mode) {
        const icons = { DRIVE: '<i class="fa-solid fa-car"></i>', TRANSIT: '<i class="fa-solid fa-bus"></i>', WALK: '<i class="fa-solid fa-person-walking"></i>', BICYCLE: '<i class="fa-solid fa-bicycle"></i>', TWO_WHEELER: '<i class="fa-solid fa-motorcycle"></i>' };
        return icons[mode] || '<i class="fa-solid fa-route"></i>';
    }

    function getPolicyIcon(condition) {
        if (condition === 'HIGH_PRECIPITATION') return '<i class="fa-solid fa-cloud-showers-heavy"></i>';
        if (condition === 'HIGH_HEAT_INDEX') return '<i class="fa-solid fa-temperature-high"></i>';
        return '<i class="fa-solid fa-circle-check" style="color:#22c55e;"></i>';
    }

    function modeLabel(mode) {
        return (mode || '').toLowerCase().replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // === View Transition ===
    function enterAppView() {
        landingView.classList.add('hidden');
        appView.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        if (!mapInitialized) {
            initializeMap();
            mapInitialized = true;
        } else if (googleMap) {
            google.maps.event.trigger(googleMap, 'resize');
            googleMap.setCenter({ lat: 14.5995, lng: 120.9842 });
        }
    }

    // === Google Map Init ===
    function initializeMap() {
        if (!window.google?.maps) {
            document.getElementById('map').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:1rem;"><i class="fa-solid fa-map" style="margin-right:8px;"></i>Map unavailable — check API key</div>';
            return;
        }

        googleMap = new google.maps.Map(document.getElementById('map'), {
            center: { lat: 14.5995, lng: 120.9842 },
            zoom: 13,
            mapId: 'routecast_map',
            disableDefaultUI: false,
            zoomControl: true,
            zoomControlOptions: { position: google.maps.ControlPosition.LEFT_BOTTOM },
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            styles: [
                { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
                { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
                { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
                { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
                { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
                { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#475569' }] },
                { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
                { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
                { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
            ],
        });
    }

    // === Draw Route using Google Maps Polyline (decoded from backend) ===
    function drawRouteOnMap(encodedPolyline) {
        if (!googleMap || !window.google?.maps) return;

        // Clear previous route
        if (routePolyline) routePolyline.setMap(null);

        // Decode using Google's geometry library
        const path = google.maps.geometry.encoding.decodePath(encodedPolyline);

        routePolyline = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.9,
            strokeWeight: 6,
            map: googleMap,
        });

        // Add start/end markers
        const startPos = path[0];
        const endPos = path[path.length - 1];

        new google.maps.Marker({
            position: startPos,
            map: googleMap,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
            },
        });

        new google.maps.Marker({
            position: endPos,
            map: googleMap,
            icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            },
        });

        // Fit map to route bounds
        const bounds = new google.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        googleMap.fitBounds(bounds, { top: 80, right: 400, bottom: 40, left: 40 });
    }
}

// === Start ===
document.addEventListener('DOMContentLoaded', bootstrap);
