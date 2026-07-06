// Authentication & Role Management

// Cache role in memory for the session
let _userRole = null;

// Login
async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Logout
async function logout() {
  _userRole = null;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.href = 'login.html';
}

// Get current user
async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

// Fetch role from profiles table
async function getUserRole() {
  if (_userRole) return _userRole;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (error || !data) {
    // Default to staff if no profile found
    _userRole = 'staff';
    return 'staff';
  }

  _userRole = data.role;
  return data.role;
}

// Apply role-based UI restrictions
async function applyRoleRestrictions(role) {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  // Pages only admin can access
  const adminOnlyPages = ['index.html', '', 'audit.html'];

  if (role === 'staff') {
    // Redirect staff away from admin-only pages
    if (adminOnlyPages.includes(currentPage)) {
      window.location.href = 'students.html';
      return;
    }

    // Hide Dashboard and Audit Log from navbar
    document.querySelectorAll('.nav-admin-only').forEach(el => {
      el.style.display = 'none';
    });

    // Show staff badge in navbar
    const userEmailEl = document.getElementById('user-email');
    if (userEmailEl) {
      userEmailEl.innerHTML = `${userEmailEl.textContent} <span class="badge badge-muted" style="font-size:0.7rem;margin-left:4px;">Staff</span>`;
    }
  }

  if (role === 'admin') {
    // Show admin badge
    const userEmailEl = document.getElementById('user-email');
    if (userEmailEl) {
      userEmailEl.innerHTML = `${userEmailEl.textContent} <span class="badge badge-success" style="font-size:0.7rem;margin-left:4px;">Admin</span>`;
    }
  }
}

// Main auth init — called on every protected page
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();

  const userEmailEl = document.getElementById('user-email');
  const logoutBtn   = document.getElementById('logout-btn');

  if (!session) {
    window.location.href = 'login.html';
    return null;
  }

  if (userEmailEl) userEmailEl.textContent = session.user.email;
  if (logoutBtn)   logoutBtn.addEventListener('click', logout);

  // Fetch role and apply restrictions
  const role = await getUserRole();
  await applyRoleRestrictions(role);

  return session;
}

// Password reset
async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset.html',
  });
  if (error) throw error;
}

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    _userRole = null;
    window.location.href = 'login.html';
  }
});
