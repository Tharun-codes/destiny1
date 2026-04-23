const API_BASE = "http://127.0.0.1:3000";

// Tab switching functionality
function switchTab(tabName) {
  // Hide all tab contents
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => content.classList.remove('active'));
  
  // Remove active class from all tabs
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => tab.classList.remove('active'));
  
  // Show selected tab content
  document.getElementById(tabName).classList.add('active');
  
  // Add active class to clicked tab
  event.target.classList.add('active');
  
  // Load requests when switching to My Requests tab
  if (tabName === 'my-requests') {
    loadUserRequests();
  }
}

// Submit package request
async function submitPackage(event) {
  event.preventDefault();
  
  const form = event.target;
  const data = {
    type: 'package',
    pickup_location: form.querySelector('input[placeholder="Enter pickup location"]').value,
    drop_location: form.querySelector('input[placeholder="Enter drop location"]').value,
    date: form.querySelector('input[type="date"]').value,
    time: form.querySelector('input[type="time"]').value,
    package_size: form.querySelector('select').value,
    package_details: form.querySelector('textarea').value,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  try {
    const res = await fetch(`${API_BASE}/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    console.log("Package request created:", result);
    
    // Show success message
    showSuccessMessage('Package request submitted successfully!');
    
    // Reset form
    form.reset();
    
    // Switch to My Requests tab to show the new request
    setTimeout(() => {
      document.querySelector('.tab:nth-child(3)').click();
    }, 1500);

  } catch (err) {
    console.error(err);
    showErrorMessage('Error submitting package request. Please try again.');
  }
}

// Submit ride request
async function submitRide(event) {
  event.preventDefault();
  
  const form = event.target;
  const data = {
    type: 'ride',
    pickup_location: form.querySelector('input[placeholder="Enter pickup location"]').value,
    drop_location: form.querySelector('input[placeholder="Enter drop location"]').value,
    date: form.querySelector('input[type="date"]').value,
    time: form.querySelector('input[type="time"]').value,
    passengers: form.querySelector('select').value,
    special_requirements: form.querySelector('textarea').value,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  try {
    const res = await fetch(`${API_BASE}/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    console.log("Ride request created:", result);
    
    // Show success message
    showSuccessMessage('Ride request submitted successfully!');
    
    // Reset form
    form.reset();
    
    // Switch to My Requests tab to show the new request
    setTimeout(() => {
      document.querySelector('.tab:nth-child(3)').click();
    }, 1500);

  } catch (err) {
    console.error(err);
    showErrorMessage('Error submitting ride request. Please try again.');
  }
}

// Load user requests
async function loadUserRequests() {
  try {
    const res = await fetch(`${API_BASE}/requests`);
    const requests = await res.json();
    
    const requestList = document.querySelector('.request-list');
    requestList.innerHTML = '';
    
    if (requests.length === 0) {
      requestList.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 40px;">No requests found. Create your first request!</p>';
      return;
    }
    
    // Sort requests by date (newest first)
    requests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    requests.forEach(request => {
      const requestItem = createRequestItem(request);
      requestList.appendChild(requestItem);
    });
    
  } catch (err) {
    console.error('Error loading requests:', err);
    const requestList = document.querySelector('.request-list');
    requestList.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 40px;">Error loading requests. Please try again later.</p>';
  }
}

// Create request item element
function createRequestItem(request) {
  const li = document.createElement('li');
  li.className = 'request-item';
  
  const statusClass = getStatusClass(request.status);
  const formattedDate = formatDate(request.created_at);
  
  li.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <strong>${request.type === 'package' ? 'Package Delivery' : 'Ride Sharing'}</strong>
        <span class="request-status ${statusClass}">${request.status}</span>
        <p style="margin: 5px 0; color: #6c757d;">From: ${request.pickup_location} to ${request.drop_location}</p>
        <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Date: ${request.date} | Time: ${request.time}</p>
        ${request.package_size ? `<p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Package Size: ${request.package_size}</p>` : ''}
        ${request.passengers ? `<p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Passengers: ${request.passengers}</p>` : ''}
        ${request.package_details || request.special_requirements ? `<p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Details: ${request.package_details || request.special_requirements}</p>` : ''}
      </div>
      <button onclick="cancelRequest(${request.id})" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">Cancel</button>
    </div>
  `;
  
  return li;
}

// Get status class for styling
function getStatusClass(status) {
  switch(status.toLowerCase()) {
    case 'pending': return 'status-pending';
    case 'confirmed': return 'status-confirmed';
    case 'completed': return 'status-completed';
    case 'cancelled': return 'status-cancelled';
    default: return 'status-pending';
  }
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Cancel request
async function cancelRequest(requestId) {
  if (!confirm('Are you sure you want to cancel this request?')) {
    return;
  }
  
  try {
    // Note: This would need a DELETE endpoint in the backend
    // For now, we'll just show a message
    showErrorMessage('Cancel functionality not yet implemented in backend');
    
  } catch (err) {
    console.error('Error cancelling request:', err);
    showErrorMessage('Error cancelling request. Please try again.');
  }
}

// Show success message
function showSuccessMessage(message) {
  const successDiv = document.createElement('div');
  successDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
    color: #155724;
    padding: 16px 20px;
    border-radius: 12px;
    border-left: 4px solid #28a745;
    box-shadow: 0 4px 15px rgba(40, 167, 69, 0.2);
    font-weight: 500;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  successDiv.textContent = message;
  
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    successDiv.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(successDiv);
    }, 300);
  }, 3000);
}

// Show error message
function showErrorMessage(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
    color: #721c24;
    padding: 16px 20px;
    border-radius: 12px;
    border-left: 4px solid #dc3545;
    box-shadow: 0 4px 15px rgba(220, 53, 69, 0.2);
    font-weight: 500;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  errorDiv.textContent = message;
  
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(errorDiv);
    }, 300);
  }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .status-cancelled {
    background: #f8d7da;
    color: #721c24;
  }
`;
document.head.appendChild(style);

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  // Set today's date as default for date inputs
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(input => {
    input.value = today;
    input.min = today; // Prevent selecting past dates
  });
  
  // Set current time as default for time inputs
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  document.querySelectorAll('input[type="time"]').forEach(input => {
    input.value = currentTime;
  });
});
