// Destiny Partners JavaScript
class DestinyPartners {
    constructor() {
        this.currentUser = null;
        this.currentRider = null;
        this.token = localStorage.getItem('destiny_token');
        this.apiBase = '/api';
        this.isOnline = false;
        this.refreshInterval = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.setupEarningsCalculator();
        this.setupSmoothScrolling();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Navigation
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        
        hamburger?.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Modal controls
        this.setupModalControls();
        
        // Form submissions
        this.setupFormHandlers();
        
        // Dashboard controls
        this.setupDashboardControls();
    }

    setupModalControls() {
        const modals = {
            login: document.getElementById('loginModal'),
            register: document.getElementById('registerModal')
        };

        const buttons = {
            login: document.getElementById('loginBtn'),
            register: document.getElementById('registerBtn'),
            becomeRider: document.getElementById('becomeRiderBtn')
        };

        // Open modals
        buttons.login?.addEventListener('click', () => this.openModal('login'));
        buttons.register?.addEventListener('click', () => this.openModal('register'));
        buttons.becomeRider?.addEventListener('click', () => this.openModal('register'));

        // Close modals
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });

        // Close on outside click
        Object.values(modals).forEach(modal => {
            modal?.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });

        // Switch between login/register
        document.getElementById('showRegister')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal(modals.login);
            this.openModal('register');
        });

        document.getElementById('showLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal(modals.register);
            this.openModal('login');
        });
    }

    setupFormHandlers() {
        // Login form
        document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin(e.target);
        });

        // Register form
        document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRegistration(e.target);
        });
    }

    setupDashboardControls() {
        // Toggle availability
        document.getElementById('toggleAvailabilityBtn')?.addEventListener('click', () => {
            this.toggleAvailability();
        });

        // Refresh button
        document.getElementById('refreshBtn')?.addEventListener('click', () => {
            this.refreshDashboard();
        });
    }

    setupEarningsCalculator() {
        const sliders = {
            dailyDeliveries: document.getElementById('dailyDeliveries'),
            dailyRides: document.getElementById('dailyRides'),
            workingDays: document.getElementById('workingDays')
        };

        Object.entries(sliders).forEach(([key, slider]) => {
            if (slider) {
                slider.addEventListener('input', (e) => {
                    const valueSpan = e.target.nextElementSibling;
                    if (valueSpan && valueSpan.classList.contains('range-value')) {
                        valueSpan.textContent = e.target.value;
                    }
                    this.calculateEarnings();
                });
            }
        });

        // Initial calculation
        this.calculateEarnings();
    }

    setupSmoothScrolling() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    calculateEarnings() {
        const dailyDeliveries = parseInt(document.getElementById('dailyDeliveries')?.value || 5);
        const dailyRides = parseInt(document.getElementById('dailyRides')?.value || 2);
        const workingDays = parseInt(document.getElementById('workingDays')?.value || 25);

        // Average earnings per delivery/ride
        const avgDeliveryEarning = 60; // ₹60 per delivery
        const avgRideEarning = 50; // ₹50 per ride

        const deliveryEarnings = dailyDeliveries * avgDeliveryEarning * workingDays;
        const rideEarnings = dailyRides * avgRideEarning * workingDays;
        const totalEarnings = deliveryEarnings + rideEarnings;

        // Update display
        document.getElementById('totalEarnings').textContent = totalEarnings.toLocaleString();
        document.getElementById('deliveryEarnings').textContent = deliveryEarnings.toLocaleString();
        document.getElementById('rideEarnings').textContent = rideEarnings.toLocaleString();

        // Update breakdown bars
        const deliveryFill = document.querySelector('.delivery-fill');
        const rideFill = document.querySelector('.ride-fill');
        
        if (deliveryFill && rideFill) {
            const deliveryPercent = (deliveryEarnings / totalEarnings) * 100;
            const ridePercent = (rideEarnings / totalEarnings) * 100;
            
            deliveryFill.style.width = deliveryPercent + '%';
            rideFill.style.width = ridePercent + '%';
        }
    }

    openModal(modalName) {
        const modal = document.getElementById(modalName + 'Modal');
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modal) {
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    async checkAuthStatus() {
        if (this.token) {
            try {
                const response = await this.apiCall('/auth/verify', 'GET');
                if (response.success) {
                    this.currentUser = response.data.user;
                    await this.loadRiderProfile();
                    this.updateUIForAuthenticatedUser();
                    this.showDashboard();
                } else {
                    this.logout();
                }
            } catch (error) {
                this.logout();
            }
        }
    }

    async loadRiderProfile() {
        if (!this.currentUser) return;

        try {
            // Try to get rider profile
            const response = await this.apiCall(`/riders/user/${this.currentUser.id}`, 'GET');
            if (response.success) {
                this.currentRider = response.data;
                this.isOnline = this.currentRider.is_available;
            }
        } catch (error) {
            // User is not a rider yet
            this.currentRider = null;
        }
    }

    updateUIForAuthenticatedUser() {
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        
        if (this.currentUser) {
            loginBtn.textContent = `Welcome, ${this.currentUser.full_name}`;
            loginBtn.onclick = () => this.showDashboard();
            registerBtn.textContent = 'Logout';
            registerBtn.onclick = () => this.logout();
        }
    }

    showDashboard() {
        const dashboard = document.getElementById('dashboard');
        if (dashboard && this.currentRider) {
            dashboard.style.display = 'block';
            this.refreshDashboard();
            
            // Smooth scroll to dashboard
            dashboard.scrollIntoView({ behavior: 'smooth' });
        } else if (this.currentUser && !this.currentRider) {
            this.showNotification('Please complete rider registration first', 'warning');
            this.openModal('register');
        }
    }

    async handleLogin(form) {
        const formData = new FormData(form);
        const loginData = {
            email: document.getElementById('loginEmail').value,
            password: document.getElementById('loginPassword').value
        };

        try {
            this.showLoading(form);
            const response = await this.apiCall('/auth/login', 'POST', loginData);
            
            if (response.success) {
                this.token = response.data.token;
                this.currentUser = response.data.user;
                localStorage.setItem('destiny_token', this.token);
                
                await this.loadRiderProfile();
                this.closeModal(document.getElementById('loginModal'));
                this.updateUIForAuthenticatedUser();
                this.showNotification('Login successful!', 'success');
                
                if (this.currentRider) {
                    this.showDashboard();
                } else {
                    this.showNotification('Complete your rider registration to start earning', 'info');
                }
            } else {
                this.showNotification(response.message || 'Login failed', 'error');
            }
        } catch (error) {
            this.showNotification('Login failed. Please try again.', 'error');
        } finally {
            this.hideLoading(form);
        }
    }

    async handleRegistration(form) {
        const userData = {
            username: document.getElementById('regUsername').value,
            email: document.getElementById('regEmail').value,
            full_name: document.getElementById('regFullName').value,
            phone: document.getElementById('regPhone').value,
            password: document.getElementById('regPassword').value
        };

        const riderData = {
            vehicle_type: document.getElementById('vehicleType').value,
            vehicle_number: document.getElementById('vehicleNumber').value,
            license_number: document.getElementById('licenseNumber').value
        };

        try {
            this.showLoading(form);
            
            // First register user
            const userResponse = await this.apiCall('/auth/register', 'POST', userData);
            
            if (userResponse.success) {
                this.token = userResponse.data.token;
                this.currentUser = userResponse.data.user;
                localStorage.setItem('destiny_token', this.token);
                
                // Then register as rider
                riderData.user_id = this.currentUser.id;
                const riderResponse = await this.apiCall('/riders/register', 'POST', riderData);
                
                if (riderResponse.success) {
                    this.currentRider = riderResponse.data;
                    this.closeModal(document.getElementById('registerModal'));
                    this.updateUIForAuthenticatedUser();
                    this.showNotification('Registration successful! You can now start accepting requests', 'success');
                    this.showDashboard();
                } else {
                    this.showNotification(riderResponse.message || 'Rider registration failed', 'error');
                }
            } else {
                this.showNotification(userResponse.message || 'User registration failed', 'error');
            }
        } catch (error) {
            this.showNotification('Registration failed. Please try again.', 'error');
        } finally {
            this.hideLoading(form);
        }
    }

    async toggleAvailability() {
        if (!this.currentRider) {
            this.showNotification('Please register as a rider first', 'warning');
            return;
        }

        try {
            const newStatus = !this.isOnline;
            const response = await this.apiCall(`/riders/${this.currentRider.id}/availability`, 'PATCH', {
                is_available: newStatus
            });

            if (response.success) {
                this.isOnline = newStatus;
                this.currentRider = response.data;
                
                const btn = document.getElementById('toggleAvailabilityBtn');
                if (this.isOnline) {
                    btn.innerHTML = '<i class="fas fa-toggle-on"></i> Go Offline';
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                    this.showNotification('You are now online and available for requests', 'success');
                } else {
                    btn.innerHTML = '<i class="fas fa-toggle-off"></i> Go Online';
                    btn.classList.remove('btn-secondary');
                    btn.classList.add('btn-primary');
                    this.showNotification('You are now offline', 'info');
                }
            }
        } catch (error) {
            this.showNotification('Failed to update availability', 'error');
        }
    }

    async refreshDashboard() {
        if (!this.currentRider) return;

        try {
            // Load today's stats
            await this.loadTodayStats();
            
            // Load available requests
            await this.loadAvailableRequests();
            
            // Load recent activity
            await this.loadRecentActivity();
            
        } catch (error) {
            console.error('Failed to refresh dashboard:', error);
        }
    }

    async loadTodayStats() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await this.apiCall(`/deliveries?rider_id=${this.currentRider.id}&status=delivered&limit=100`, 'GET');
            
            let todayDeliveries = 0;
            let todayEarnings = 0;
            
            if (response.success && response.data) {
                response.data.forEach(delivery => {
                    const deliveryDate = new Date(delivery.delivered_at).toISOString().split('T')[0];
                    if (deliveryDate === today) {
                        todayDeliveries++;
                        todayEarnings += delivery.rider_earnings || 0;
                    }
                });
            }
            
            document.getElementById('todayDeliveries').textContent = todayDeliveries;
            document.getElementById('todayEarnings').textContent = todayEarnings;
            
            // Load rides stats
            const ridesResponse = await this.apiCall(`/rides?rider_id=${this.currentRider.id}&status=dropped&limit=100`, 'GET');
            let todayRides = 0;
            
            if (ridesResponse.success && ridesResponse.data) {
                ridesResponse.data.forEach(ride => {
                    const rideDate = new Date(ride.dropped_at).toISOString().split('T')[0];
                    if (rideDate === today) {
                        todayRides++;
                        todayEarnings += ride.rider_earnings || 0;
                    }
                });
            }
            
            document.getElementById('todayRides').textContent = todayRides;
            document.getElementById('todayEarnings').textContent = todayEarnings;
            
        } catch (error) {
            console.error('Failed to load today stats:', error);
        }
    }

    async loadAvailableRequests() {
        try {
            const [deliveriesResponse, ridesResponse] = await Promise.all([
                this.apiCall('/deliveries/available/for-riders', 'GET'),
                this.apiCall('/rides/available/for-riders', 'GET')
            ]);
            
            const requestsList = document.getElementById('requestsList');
            const allRequests = [];
            
            if (deliveriesResponse.success && deliveriesResponse.data) {
                deliveriesResponse.data.forEach(delivery => {
                    allRequests.push({
                        type: 'delivery',
                        id: delivery.id,
                        description: delivery.item_description,
                        pickup: delivery.pickup_address,
                        delivery: delivery.delivery_address,
                        price: delivery.max_price || 0,
                        tracking_id: delivery.tracking_id
                    });
                });
            }
            
            if (ridesResponse.success && ridesResponse.data) {
                ridesResponse.data.forEach(ride => {
                    allRequests.push({
                        type: 'ride',
                        id: ride.id,
                        description: `Ride for ${ride.passengers} passenger(s)`,
                        pickup: ride.pickup_address,
                        delivery: ride.destination_address,
                        price: ride.max_price || 0,
                        tracking_id: ride.tracking_id
                    });
                });
            }
            
            if (allRequests.length > 0) {
                requestsList.innerHTML = allRequests.map(request => `
                    <div class="request-item">
                        <div class="request-header">
                            <span class="request-type">${request.type === 'delivery' ? '📦 Delivery' : '🚗 Ride'}</span>
                            <span class="request-price">₹${request.price}</span>
                        </div>
                        <div class="request-details">
                            <strong>From:</strong> ${request.pickup}<br>
                            <strong>To:</strong> ${request.delivery}<br>
                            <strong>ID:</strong> ${request.tracking_id}
                        </div>
                        <div class="request-actions">
                            <button class="btn btn-primary btn-small" onclick="destinyPartners.acceptRequest('${request.type}', ${request.id})">
                                Accept
                            </button>
                            <button class="btn btn-outline btn-small" onclick="destinyPartners.viewDetails('${request.type}', ${request.id})">
                                Details
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                requestsList.innerHTML = '<div class="no-requests">No available requests</div>';
            }
            
        } catch (error) {
            console.error('Failed to load available requests:', error);
            document.getElementById('requestsList').innerHTML = '<div class="no-requests">Failed to load requests</div>';
        }
    }

    async loadRecentActivity() {
        try {
            const [deliveriesResponse, ridesResponse] = await Promise.all([
                this.apiCall(`/deliveries?rider_id=${this.currentRider.id}&limit=5`, 'GET'),
                this.apiCall(`/rides?rider_id=${this.currentRider.id}&limit=5`, 'GET')
            ]);
            
            const activityList = document.getElementById('activityList');
            const allActivity = [];
            
            if (deliveriesResponse.success && deliveriesResponse.data) {
                deliveriesResponse.data.forEach(delivery => {
                    allActivity.push({
                        type: 'delivery',
                        status: delivery.status,
                        description: delivery.item_description,
                        tracking_id: delivery.tracking_id,
                        created_at: delivery.created_at,
                        earnings: delivery.rider_earnings || 0
                    });
                });
            }
            
            if (ridesResponse.success && ridesResponse.data) {
                ridesResponse.data.forEach(ride => {
                    allActivity.push({
                        type: 'ride',
                        status: ride.status,
                        description: `Ride for ${ride.passengers} passenger(s)`,
                        tracking_id: ride.tracking_id,
                        created_at: ride.created_at,
                        earnings: ride.rider_earnings || 0
                    });
                });
            }
            
            // Sort by date
            allActivity.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            if (allActivity.length > 0) {
                activityList.innerHTML = allActivity.slice(0, 5).map(activity => `
                    <div class="activity-item">
                        <div class="activity-header">
                            <span class="activity-type">${activity.type === 'delivery' ? '📦' : '🚗'} ${activity.tracking_id}</span>
                            <span class="activity-earnings">₹${activity.earnings}</span>
                        </div>
                        <div class="activity-details">
                            ${activity.description}<br>
                            <strong>Status:</strong> ${activity.status}<br>
                            <strong>Time:</strong> ${new Date(activity.created_at).toLocaleString()}
                        </div>
                    </div>
                `).join('');
            } else {
                activityList.innerHTML = '<div class="no-activity">No recent activity</div>';
            }
            
        } catch (error) {
            console.error('Failed to load recent activity:', error);
            document.getElementById('activityList').innerHTML = '<div class="no-activity">Failed to load activity</div>';
        }
    }

    async acceptRequest(type, requestId) {
        if (!this.isOnline) {
            this.showNotification('Please go online to accept requests', 'warning');
            return;
        }

        try {
            const endpoint = type === 'delivery' ? '/deliveries' : '/rides';
            const response = await this.apiCall(`${endpoint}/${requestId}/status`, 'PATCH', {
                status: type === 'delivery' ? 'accepted' : 'accepted',
                rider_id: this.currentRider.id
            });

            if (response.success) {
                this.showNotification(`Request ${response.data.tracking_id} accepted!`, 'success');
                this.refreshDashboard();
            } else {
                this.showNotification(response.message || 'Failed to accept request', 'error');
            }
        } catch (error) {
            this.showNotification('Failed to accept request', 'error');
        }
    }

    viewDetails(type, requestId) {
        // Implement details view
        this.showNotification(`Viewing details for ${type} request ${requestId}`, 'info');
    }

    startAutoRefresh() {
        // Refresh dashboard every 30 seconds when online
        this.refreshInterval = setInterval(() => {
            if (this.isOnline && this.currentRider) {
                this.refreshDashboard();
            }
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    async apiCall(endpoint, method = 'GET', data = null) {
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        const response = await fetch(this.apiBase + endpoint, config);
        return await response.json();
    }

    logout() {
        this.currentUser = null;
        this.currentRider = null;
        this.token = null;
        this.isOnline = false;
        this.stopAutoRefresh();
        localStorage.removeItem('destiny_token');
        
        // Update UI
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        
        loginBtn.textContent = 'Login';
        loginBtn.onclick = () => this.openModal('login');
        registerBtn.textContent = 'Register';
        registerBtn.onclick = () => this.openModal('register');
        
        // Hide dashboard
        document.getElementById('dashboard').style.display = 'none';
        
        this.showNotification('Logged out successfully', 'success');
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add styles
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem',
            color: 'white',
            fontWeight: '500',
            zIndex: '3000',
            maxWidth: '300px',
            wordWrap: 'break-word',
            animation: 'slideInRight 0.3s ease'
        });

        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showLoading(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.setAttribute('data-original-text', submitBtn.innerHTML);
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }
    }

    hideLoading(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            const originalText = submitBtn.getAttribute('data-original-text');
            if (originalText) {
                submitBtn.innerHTML = originalText;
            }
        }
    }
}

// Add custom animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.destinyPartners = new DestinyPartners();
});

// Export for potential use in other modules
window.DestinyPartners = DestinyPartners;
