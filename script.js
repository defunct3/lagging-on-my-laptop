document.addEventListener('DOMContentLoaded', () => {
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
            toggleAuthModeBtn.click(); // Hacky but works for toggling back
        });
    });

    // Form Submit (Mock Authentication)
    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // Simulate auth success and enter app
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
        document.body.style.overflow = 'auto'; // Restore scroll
        window.scrollTo(0, 0); // Go back to top
    });

    // Routing Mock
    findRouteBtn.addEventListener('click', () => {
        if (!startLocationInput.value || !endLocationInput.value) return;

        // Show loading state
        const originalText = findRouteBtn.innerHTML;
        findRouteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Calculating...';
        
        setTimeout(() => {
            findRouteBtn.innerHTML = originalText;
            routeResult.classList.remove('hidden');
            drawMockRoute();
        }, 1500);
    });

    // === View Transition ===
    function enterAppView() {
        landingView.classList.add('hidden');
        appView.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent scroll on map
        
        if (!mapInitialized) {
            initializeMap();
            mapInitialized = true;
        } else {
            // Fix Leaflet container size issue when unhidden
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    }

    // === Map Logic ===
    function initializeMap() {
        // Manila coordinates
        const manilaLat = 14.5995;
        const manilaLng = 120.9842;

        map = L.map('map', {
            zoomControl: false // Move zoom control
        }).setView([manilaLat, manilaLng], 13);

        // Add standard OSM tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        // Add zoom control to bottom left
        L.control.zoom({
            position: 'bottomleft'
        }).addTo(map);

        routeLayerGroup = L.layerGroup().addTo(map);
    }

    function drawMockRoute() {
        if (!map) return;
        
        routeLayerGroup.clearLayers();

        // Quezon City to Makati rough coords
        const start = [14.6469, 121.0350]; // QC
        const end = [14.5547, 121.0244];   // Makati
        const mid = [14.6000, 121.0450];   // EDSA rough midpoint

        // Create markers
        const startIcon = L.divIcon({
            className: 'custom-marker',
            html: '<i class="fa-solid fa-circle-dot" style="color: #3b82f6; font-size: 20px; background: white; border-radius: 50%; padding: 2px;"></i>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const endIcon = L.divIcon({
            className: 'custom-marker',
            html: '<i class="fa-solid fa-location-dot" style="color: #ef4444; font-size: 24px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);"></i>',
            iconSize: [24, 24],
            iconAnchor: [12, 24]
        });

        L.marker(start, {icon: startIcon}).addTo(routeLayerGroup);
        L.marker(end, {icon: endIcon}).addTo(routeLayerGroup);

        // Draw line
        const latlngs = [start, mid, end];
        const polyline = L.polyline(latlngs, {
            color: '#3b82f6',
            weight: 6,
            opacity: 0.8,
            dashArray: '10, 10',
            lineJoin: 'round'
        }).addTo(routeLayerGroup);

        // Zoom map to fit route
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }
});
