// Destiny App JavaScript
class DestinyApp {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('destiny_token');
        this.apiBase = '/api';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.animateStats();
        this.setupSmoothScrolling();
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
        
        // Service buttons
        this.setupServiceButtons();
    }

    setupModalControls() {
        const modals = {
            login: document.getElementById('loginModal'),
            signup: document.getElementById('signupModal'),
            delivery: document.getElementById('deliveryModal'),
            ride: document.getElementById('rideModal')
        };

        const buttons = {
            login: document.getElementById('loginBtn'),
            signup: document.getElementById('signupBtn'),
            sendItem: document.getElementById('sendItemBtn'),
            requestRide: document.getElementById('requestRideBtn'),
            deliveryService: document.getElementById('deliveryServiceBtn'),
            rideService: document.getElementById('rideServiceBtn')
        };

        // Open modals
        buttons.login?.addEventListener('click', () => this.openModal('login'));
        buttons.signup?.addEventListener('click', () => this.openModal('signup'));
        buttons.sendItem?.addEventListener('click', () => this.openModal('delivery'));
        buttons.requestRide?.addEventListener('click', () => this.openModal('ride'));
        buttons.deliveryService?.addEventListener('click', () => this.openModal('delivery'));
        buttons.rideService?.addEventListener('click', () => this.openModal('ride'));

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

        // Switch between login/signup
        document.getElementById('showSignup')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal(modals.login);
            this.openModal('signup');
        });

        document.getElementById('showLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal(modals.signup);
            this.openModal('login');
        });
    }

    setupFormHandlers() {
        // Login form
        document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin(e.target);
        });

        // Signup form
        document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSignup(e.target);
        });

        // Delivery form
        document.getElementById('deliveryForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleDeliveryRequest(e.target);
        });

        // Ride form
        document.getElementById('rideForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRideRequest(e.target);
        });
    }

    setupServiceButtons() {
        // Additional service button handlers can be added here
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
                    this.updateUIForAuthenticatedUser();
                } else {
                    this.logout();
                }
            } catch (error) {
                this.logout();
            }
        }
    }

    updateUIForAuthenticatedUser() {
        const loginBtn = document.getElementById('loginBtn');
        const signupBtn = document.getElementById('signupBtn');
        
        if (this.currentUser) {
            loginBtn.textContent = `Welcome, ${this.currentUser.full_name}`;
            loginBtn.onclick = () => this.showUserMenu();
            signupBtn.textContent = 'Logout';
            signupBtn.onclick = () => this.logout();
        }
    }

    showUserMenu() {
        // Implement user menu/ dashboard
        alert('User dashboard coming soon!');
    }

    async handleLogin(form) {
        const formData = new FormData(form);
        const loginData = {
            username: formData.get('username') || document.getElementById('loginUsername').value,
            password: formData.get('password') || document.getElementById('loginPassword').value
        };

        try {
            this.showLoading(form);
            const response = await this.apiCall('/auth/login', 'POST', loginData);
            
            if (response.success) {
                this.token = response.data.token;
                this.currentUser = response.data.user;
                localStorage.setItem('destiny_token', this.token);
                
                this.closeModal(document.getElementById('loginModal'));
                this.updateUIForAuthenticatedUser();
                this.showNotification('Login successful!', 'success');
            } else {
                this.showNotification(response.message || 'Login failed', 'error');
            }
        } catch (error) {
            this.showNotification('Login failed. Please try again.', 'error');
        } finally {
            this.hideLoading(form);
        }
    }

    async handleSignup(form) {
        const formData = new FormData(form);
        const signupData = {
            username: formData.get('username') || document.getElementById('signupUsername').value,
            email: formData.get('email') || document.getElementById('signupEmail').value,
            full_name: formData.get('full_name') || document.getElementById('signupFullName').value,
            phone: formData.get('phone') || document.getElementById('signupPhone').value,
            password: formData.get('password') || document.getElementById('signupPassword').value
        };

        try {
            this.showLoading(form);
            const response = await this.apiCall('/auth/register', 'POST', signupData);
            
            if (response.success) {
                this.token = response.data.token;
                this.currentUser = response.data.user;
                localStorage.setItem('destiny_token', this.token);
                
                this.closeModal(document.getElementById('signupModal'));
                this.updateUIForAuthenticatedUser();
                this.showNotification('Registration successful!', 'success');
            } else {
                this.showNotification(response.message || 'Registration failed', 'error');
            }
        } catch (error) {
            this.showNotification('Registration failed. Please try again.', 'error');
        } finally {
            this.hideLoading(form);
        }
    }

    async handleDeliveryRequest(form) {
        if (!this.currentUser) {
            this.showNotification('Please login to request delivery', 'error');
            this.closeModal(document.getElementById('deliveryModal'));
            this.openModal('login');
            return;
        }

        const formData = new FormData(form);
        const deliveryData = {
            user_id: this.currentUser.id,
            pickup_address: document.getElementById('pickupAddress').value,
            delivery_address: document.getElementById('deliveryAddress').value,
            item_description: document.getElementById('itemDescription').value,
            item_weight: parseFloat(document.getElementById('itemWeight').value) || 0,
            item_value: 0,
            package_type: document.getElementById('packageType').value,
            urgent: document.getElementById('urgentDelivery').checked,
            max_price: parseFloat(document.getElementById('maxPrice').value) || 0,
            notes: document.getElementById('deliveryNotes').value
        };

        try {
            this.showLoading(form);
            const response = await this.apiCall('/deliveries', 'POST', deliveryData);
            
            if (response.success) {
                this.closeModal(document.getElementById('deliveryModal'));
                form.reset();
                this.showNotification(`Delivery request created! Tracking ID: ${response.data.tracking_id}`, 'success');
                // Redirect to tracking page
                setTimeout(() => {
                    this.showTrackingPage(response.data.tracking_id);
                }, 2000);
            } else {
                this.showNotification(response.message || 'Failed to create delivery request', 'error');
            }
        } catch (error) {
            this.showNotification('Failed to create delivery request. Please try again.', 'error');
        } finally {
            this.hideLoading(form);
        }
    }

    async handleRideRequest(form) {
        if (!this.currentUser) {
            this.showNotification('Please login to request ride', 'error');
            this.closeModal(document.getElementById('rideModal'));
            this.openModal('login');
            return;
        }

        const formData = new FormData(form);
        const rideData = {
            user_id: this.currentUser.id,
            pickup_address: document.getElementById('pickupRideAddress').value,
            destination_address: document.getElementById('destinationAddress').value,
            passengers: parseInt(document.getElementById('passengers').value),
            preferred_time: document.getElementById('preferredTime').value,
            max_price: parseFloat(document.getElementById('maxRidePrice').value) || 0,
            notes: document.getElementById('rideNotes').value
        };

        try {
            this.showLoading(form);
            const response = await this.apiCall('/rides', 'POST', rideData);
            
            if (response.success) {
                this.closeModal(document.getElementById('rideModal'));
                form.reset();
                this.showNotification(`Ride request created! Tracking ID: ${response.data.tracking_id}`, 'success');
                // Redirect to tracking page
                setTimeout(() => {
                    this.showTrackingPage(response.data.tracking_id);
                }, 2000);
            } else {
                this.showNotification(response.message || 'Failed to create ride request', 'error');
            }
        } catch (error) {
            this.showNotification('Failed to create ride request. Please try again.', 'error');
        } finally {
            this.hideLoading(form);
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
        this.token = null;
        localStorage.removeItem('destiny_token');
        
        // Update UI
        const loginBtn = document.getElementById('loginBtn');
        const signupBtn = document.getElementById('signupBtn');
        
        loginBtn.textContent = 'Login';
        loginBtn.onclick = () => this.openModal('login');
        signupBtn.textContent = 'Sign Up';
        signupBtn.onclick = () => this.openModal('signup');
        
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
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }
    }

    hideLoading(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = submitBtn.getAttribute('data-original-text') || submitBtn.textContent;
        }
    }

    showTrackingPage(trackingId) {
        // Implement tracking page navigation
        this.showNotification(`Tracking your request: ${trackingId}`, 'info');
        // You can redirect to a tracking page here
        // window.location.href = `/track/${trackingId}`;
    }

    animateStats() {
        const statNumbers = document.querySelectorAll('.stat-number');
        
        const animateNumber = (element) => {
            const target = parseInt(element.getAttribute('data-target'));
            const duration = 2000;
            const step = target / (duration / 16);
            let current = 0;
            
            const timer = setInterval(() => {
                current += step;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                element.textContent = Math.floor(current).toLocaleString();
            }, 16);
        };

        // Intersection Observer for animation trigger
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateNumber(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        });

        statNumbers.forEach(stat => observer.observe(stat));
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
    new DestinyApp();
});

// Export for potential use in other modules
window.DestinyApp = DestinyApp;
