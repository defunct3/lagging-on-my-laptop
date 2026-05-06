document.addEventListener('DOMContentLoaded', () => {
    // === Configuration ===
    // Empty string = relative URL; Vercel rewrites /api/* → AWS backend (avoids mixed-content block)
    const API_BASE_URL = '';

    // === DOM Elements ===

    // Views
    const landingView = document.getElementById('landing-view');
    const appView = document.getElementById('app-view');

    // Auth Modal
    const authModal = document.getElementById('auth-modal');
    const navSigninBtn = document.getElementById('nav-signin');
    const heroGetStartedBtn = document.getElementById('hero-get-started');
    const closeModalBtn = document.getElementById('close-modal');
    const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
    const modalTitle = document.getElementById('modal-title');
    const authForm = document.getElementById('auth-form');

    // App Navigation
    const calcBestRouteBtn = document.getElementById('calc-best-route');
    const menuToggleBtn = document.getElementById('menu-toggle');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const logoutBtn = document.getElementById('logout-btn');

    // Routing
    const findRouteBtn = document.getElementById('find-route-btn');
    const routeResult = document.getElementById('route-result');
    const startLocationInput = document.getElementById('start-location');
    const endLocationInput = document.getElementById('end-location');

    // Weather widget
    const weatherIconEl = document.getElementById('weather-icon');
    const currentTempEl = document.getElementById('current-temp');
    const currentDescEl = document.getElementById('current-desc');
    const feelsLikeEl = document.getElementById('feels-like');
    const rainChanceEl = document.getElementById('rain-chance');
    const precipMmEl = document.getElementById('precip-mm');
    const policyBadgeEl = document.getElementById('policy-badge');

    // Route result elements
    const routeModeIconEl = document.getElementById('route-mode-icon');
    const routeDurationEl = document.getElementById('route-duration');
    const routeDistanceEl = document.getElementById('route-distance');
    const routeSummaryEl = document.getElementById('route-summary');
    const routeReasonEl = document.getElementById('route-reason');
    const routeWarningEl = document.getElementById('route-warning');
    const alternativesPanel = document.getElementById('alternatives-panel');
    const alternativesList = document.getElementById('alternatives-list');

    // Mode selector
    const modeSelector = document.getElementById('mode-selector');

    // Nav links
    const navLinks = document.querySelectorAll('.nav-link');

    // === State ===
    let mapInitialized = false;
    let map;
    let routeLayerGroup;
    let isSignUpMode = false;
    let isMenuOpen = false;
    let lastApiResponse = null; // Store last response to allow alt-route switching

    // === Nav / Scroll ===
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
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
        // Ensure at least one mode is always selected
        const activeCount = modeSelector.querySelectorAll('.mode-btn.active').length;
        if (activeCount === 0) btn.classList.add('active');
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

        // Determine which route to display (best or a selected alternative)
        const displayRoute = selectedAltIndex !== null && alternatives?.[selectedAltIndex]
            ? alternatives[selectedAltIndex]
            : recommendation;

        // Populate route result
        routeModeIconEl.innerHTML = getModeIcon(displayRoute.mode);
        routeDurationEl.textContent = `${displayRoute.durationMinutes} mins`;
        routeDistanceEl.textContent = displayRoute.distanceKm ? `· ${displayRoute.distanceKm} km` : '';
        routeSummaryEl.textContent = displayRoute.summary || '';
        routeReasonEl.textContent = displayRoute.recommendationReason || '';

        // Policy warning
        if (policy?.message) {
            routeWarningEl.innerHTML = `${getPolicyIcon(policy.condition)} <span>${policy.message}</span>`;
            routeWarningEl.style.display = 'flex';
        } else {
            routeWarningEl.style.display = 'none';
        }

        routeResult.classList.remove('hidden');

        // Draw this route's polyline
        if (displayRoute.encodedPolyline) {
            drawRealRoute(displayRoute.encodedPolyline);
        }

        // Render alternatives
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

        // Include best recommendation as first "selectable" option too
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
        if (currentTempEl) {
            currentTempEl.textContent = weather.temperatureC !== null
                ? `${Math.round(weather.temperatureC)}°C` : '--°C';
        }
        if (currentDescEl) {
            currentDescEl.textContent = getWeatherDescription(weather.weatherCode);
        }
        if (feelsLikeEl) {
            feelsLikeEl.textContent = weather.apparentTemperatureC !== null
                ? `Feels like ${Math.round(weather.apparentTemperatureC)}°C` : 'Feels like --°C';
        }
        if (rainChanceEl) {
            rainChanceEl.textContent = weather.precipitationProbability !== undefined
                ? `${weather.precipitationProbability}%` : '--%';
        }
        if (precipMmEl) {
            precipMmEl.textContent = weather.precipitationMm !== undefined
                ? `${weather.precipitationMm} mm` : '-- mm';
        }
        if (weatherIconEl) {
            weatherIconEl.innerHTML = getWeatherIconHTML(weather.weatherCode);
        }
        if (policyBadgeEl && policy) {
            policyBadgeEl.className = 'policy-badge';
            if (policy.condition === 'HIGH_PRECIPITATION') {
                policyBadgeEl.textContent = 'RAIN ALERT';
                policyBadgeEl.classList.add('policy-rain');
            } else if (policy.condition === 'HIGH_HEAT_INDEX') {
                policyBadgeEl.textContent = 'HEAT ALERT';
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
        let iconClass = 'fa-solid fa-sun';
        let color = '#fcd34d';
        if (code === null || code === undefined) { iconClass = 'fa-solid fa-cloud-sun'; color = '#60a5fa'; }
        else if (code === 0) { iconClass = 'fa-solid fa-sun'; color = '#fcd34d'; }
        else if (code <= 3) { iconClass = 'fa-solid fa-cloud-sun'; color = '#94a3b8'; }
        else if (code <= 49) { iconClass = 'fa-solid fa-smog'; color = '#94a3b8'; }
        else if (code <= 59) { iconClass = 'fa-solid fa-cloud-drizzle'; color = '#60a5fa'; }
        else if (code <= 69) { iconClass = 'fa-solid fa-cloud-rain'; color = '#60a5fa'; }
        else if (code <= 82) { iconClass = 'fa-solid fa-cloud-showers-heavy'; color = '#3b82f6'; }
        else if (code <= 86) { iconClass = 'fa-solid fa-snowflake'; color = '#bfdbfe'; }
        else if (code <= 99) { iconClass = 'fa-solid fa-cloud-bolt'; color = '#fbbf24'; }
        return `<i class="${iconClass}" style="font-size:3rem;color:${color};"></i>`;
    }

    // === Icon Helpers ===
    function getModeIcon(mode) {
        const icons = {
            DRIVE: '<i class="fa-solid fa-car"></i>',
            TRANSIT: '<i class="fa-solid fa-bus"></i>',
            WALK: '<i class="fa-solid fa-person-walking"></i>',
            BICYCLE: '<i class="fa-solid fa-bicycle"></i>',
            TWO_WHEELER: '<i class="fa-solid fa-motorcycle"></i>',
        };
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
        } else {
            setTimeout(() => map.invalidateSize(), 100);
        }
    }

    // === Map ===
    function initializeMap() {
        map = L.map('map', { zoomControl: false }).setView([14.5995, 120.9842], 13);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        L.control.zoom({ position: 'bottomleft' }).addTo(map);
        routeLayerGroup = L.layerGroup().addTo(map);
    }

    function drawRealRoute(encodedPolyline) {
        if (!map) return;
        routeLayerGroup.clearLayers();

        const latlngs = decodePolyline(encodedPolyline);
        if (latlngs.length === 0) return;

        const polyline = L.polyline(latlngs, {
            color: '#3b82f6', weight: 6, opacity: 0.85, lineJoin: 'round'
        }).addTo(routeLayerGroup);

        const startIcon = L.divIcon({
            className: 'custom-marker',
            html: '<i class="fa-solid fa-circle-dot" style="color:#3b82f6;font-size:20px;background:white;border-radius:50%;padding:2px;"></i>',
            iconSize: [24, 24], iconAnchor: [12, 12]
        });
        const endIcon = L.divIcon({
            className: 'custom-marker',
            html: '<i class="fa-solid fa-location-dot" style="color:#ef4444;font-size:24px;text-shadow:0 2px 4px rgba(0,0,0,0.5);"></i>',
            iconSize: [24, 24], iconAnchor: [12, 24]
        });

        L.marker(latlngs[0], { icon: startIcon }).addTo(routeLayerGroup);
        L.marker(latlngs[latlngs.length - 1], { icon: endIcon }).addTo(routeLayerGroup);
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }

    // === Google Encoded Polyline Decoder ===
    function decodePolyline(encoded) {
        const latlngs = [];
        let index = 0, lat = 0, lng = 0;

        while (index < encoded.length) {
            let b, shift = 0, result = 0;
            do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lat += (result & 1) ? ~(result >> 1) : (result >> 1);

            shift = 0; result = 0;
            do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lng += (result & 1) ? ~(result >> 1) : (result >> 1);

            latlngs.push([lat / 1e5, lng / 1e5]);
        }
        return latlngs;
    }
});
