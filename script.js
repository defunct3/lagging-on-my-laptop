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
    
    // Routing functionality
    const findRouteBtn = document.getElementById('find-route-btn');
    const routeResult = document.getElementById('route-result');
    const startLocationInput = document.getElementById('start-location');
    const endLocationInput = document.getElementById('end-location');

    // Weather widget
    const currentTempEl = document.getElementById('current-temp');
    const currentDescEl = document.getElementById('current-desc');
    
    // Header links
    const navLinks = document.querySelectorAll('.nav-link');

    // State
    let mapInitialized = false;
    let map;
    let routeLayerGroup;
    let isSignUpMode = false;
    let isMenuOpen = false;

    // === Event Listeners ===

    // Smooth Scrolling & Active State for Nav Links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            const targetId = this.getAttribute('href');
            document.querySelector(targetId).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Modal Logic
    const openModal = () => {
        authModal.classList.remove('hidden');
    };

    const closeModal = () => {
        authModal.classList.add('hidden');
    };

    navSigninBtn.addEventListener('click', openModal);
    heroGetStartedBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);

    // Close modal on outside click
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
            closeModal();
        }
    });

    // Toggle Sign In / Sign Up
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
        
        // Re-attach event listener since innerHTML replaced the button
        document.getElementById('toggle-auth-mode').addEventListener('click', () => {
            toggleAuthModeBtn.click();
        });
    });

    // Form Submit (Mock Authentication)
    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        closeModal();
        enterAppView();
    });

    // Enter App View from Landing 2 CTA
    calcBestRouteBtn.addEventListener('click', () => {
        enterAppView();
    });

    // Hamburger Menu
    menuToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isMenuOpen = !isMenuOpen;
        dropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        if (isMenuOpen) {
            dropdownMenu.classList.add('hidden');
            isMenuOpen = false;
        }
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        appView.classList.add('hidden');
        landingView.classList.remove('hidden');
        document.body.style.overflow = 'auto';
        window.scrollTo(0, 0);
    });

    // === Route Finding (Real API) ===
    findRouteBtn.addEventListener('click', async () => {
        const origin = startLocationInput.value.trim();
        const destination = endLocationInput.value.trim();
        if (!origin || !destination) return;

        // Show loading state
        const originalHTML = findRouteBtn.innerHTML;
        findRouteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Calculating...';
        findRouteBtn.disabled = true;
        routeResult.classList.add('hidden');

        try {
            const response = await fetch(`${API_BASE_URL}/api/commute-routes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin, destination }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown server error.' }));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const data = await response.json();
            handleRouteResponse(data);

        } catch (err) {
            console.error('Route fetch failed:', err);
            showRouteError(err.message);
        } finally {
            findRouteBtn.innerHTML = originalHTML;
            findRouteBtn.disabled = false;
        }
    });

    // === Handle API Response ===
    function handleRouteResponse(data) {
        const { recommendation, weather, policy } = data;

        // Update weather widget with live data
        if (weather) {
            updateWeatherWidget(weather);
        }

        if (!recommendation) {
            showRouteError('No route could be found for this trip.');
            return;
        }

        // Update route result card
        const modeIcon = getModeIcon(recommendation.mode);
        const durationText = `${recommendation.durationMinutes} mins`;
        const distanceText = recommendation.distanceKm ? ` · ${recommendation.distanceKm} km` : '';
        const policyMsg = policy?.message ?? '';

        routeResult.classList.remove('hidden');
        routeResult.querySelector('.route-time').innerHTML =
            `${modeIcon} <span>${durationText}${distanceText}</span>`;
        routeResult.querySelector('.route-warning').innerHTML =
            `${getPolicyIcon(policy?.condition)} <span>${policyMsg}</span>`;

        // Draw the real route on the map
        if (recommendation.encodedPolyline) {
            drawRealRoute(recommendation.encodedPolyline);
        }
    }

    function showRouteError(message) {
        routeResult.classList.remove('hidden');
        routeResult.querySelector('.route-time').innerHTML =
            `<i class="fa-solid fa-circle-exclamation" style="color:#ef4444;"></i> <span>Error</span>`;
        routeResult.querySelector('.route-warning').innerHTML =
            `<i class="fa-solid fa-triangle-exclamation"></i> <span>${message}</span>`;
    }

    // === Weather Widget ===
    function updateWeatherWidget(weather) {
        if (currentTempEl) {
            currentTempEl.textContent = weather.temperatureC !== null
                ? `${Math.round(weather.temperatureC)}°C`
                : '--°C';
        }
        if (currentDescEl) {
            currentDescEl.textContent = getWeatherDescription(weather.weatherCode);
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

    // === View Transition ===
    function enterAppView() {
        landingView.classList.add('hidden');
        appView.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        if (!mapInitialized) {
            initializeMap();
            mapInitialized = true;
        } else {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    }

    // === Map Logic ===
    function initializeMap() {
        const manilaLat = 14.5995;
        const manilaLng = 120.9842;

        map = L.map('map', {
            zoomControl: false
        }).setView([manilaLat, manilaLng], 13);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        L.control.zoom({
            position: 'bottomleft'
        }).addTo(map);

        routeLayerGroup = L.layerGroup().addTo(map);
    }

    // === Draw Real Route from Encoded Polyline ===
    function drawRealRoute(encodedPolyline) {
        if (!map) return;
        routeLayerGroup.clearLayers();

        const latlngs = decodePolyline(encodedPolyline);
        if (latlngs.length === 0) return;

        const start = latlngs[0];
        const end = latlngs[latlngs.length - 1];

        // Draw route polyline
        const polyline = L.polyline(latlngs, {
            color: '#3b82f6',
            weight: 6,
            opacity: 0.85,
            lineJoin: 'round'
        }).addTo(routeLayerGroup);

        // Start marker
        const startIcon = L.divIcon({
            className: 'custom-marker',
            html: '<i class="fa-solid fa-circle-dot" style="color: #3b82f6; font-size: 20px; background: white; border-radius: 50%; padding: 2px;"></i>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        // End marker
        const endIcon = L.divIcon({
            className: 'custom-marker',
            html: '<i class="fa-solid fa-location-dot" style="color: #ef4444; font-size: 24px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);"></i>',
            iconSize: [24, 24],
            iconAnchor: [12, 24]
        });

        L.marker(start, { icon: startIcon }).addTo(routeLayerGroup);
        L.marker(end, { icon: endIcon }).addTo(routeLayerGroup);

        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }

    // === Google Encoded Polyline Decoder ===
    function decodePolyline(encoded) {
        const latlngs = [];
        let index = 0;
        let lat = 0;
        let lng = 0;

        while (index < encoded.length) {
            let b, shift = 0, result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
            lat += dlat;

            shift = 0;
            result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
            lng += dlng;

            latlngs.push([lat / 1e5, lng / 1e5]);
        }

        return latlngs;
    }
});
