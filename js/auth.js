// Authentication functions

// Login with email and password
async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// Logout
async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.href = 'login.html';
}

// Check session and update nav
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();

  const userEmailEl = document.getElementById('user-email');
  const logoutBtn = document.getElementById('logout-btn');

  if (session) {
    if (userEmailEl) userEmailEl.textContent = session.user.email;
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
  } else {
    window.location.href = 'login.html';
  }

  return session;
}

// Password reset email
async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset.html',
  });
  if (error) throw error;
}

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    window.location.href = 'login.html';
  }
});
