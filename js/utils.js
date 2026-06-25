// Shared utility functions

// Format currency in Indian Rupees
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount || 0);
}

// Format date to DD-MM-YYYY
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Format datetime
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Show toast notification
function showToast(message, type = 'success') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Show loading spinner
function showLoading(containerId, message = 'Loading...') {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="loading"><div class="spinner"></div><p>${message}</p></div>`;
}

// Show error message
function showError(containerId, message) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="error-msg">⚠️ ${message}</div>`;
}

// Write audit log
async function writeAudit(tableName, action, oldData, newData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('audit_logs').insert({
      table_name: tableName,
      action: action,
      old_data: oldData || null,
      new_data: newData || null,
      done_by: user?.email || 'unknown',
    });
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}

// Calculate fee summary for a student
function calcFeeSummary(student, payments) {
  const netPayable = student.net_payable || 0;
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const balance = netPayable - totalPaid;
  const percent = netPayable > 0 ? Math.min(100, Math.round((totalPaid / netPayable) * 100)) : 0;
  return { netPayable, totalPaid, balance, percent };
}

// Check if user is logged in, redirect if not
async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
  }
  return session;
}

// Get current logged in user email
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Debounce function for search inputs
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Generate WhatsApp message link
function whatsappLink(phone, message) {
  const clean = phone?.replace(/\D/g, '');
  if (!clean) return '#';
  return `https://wa.me/91${clean}?text=${encodeURIComponent(message)}`;
}
