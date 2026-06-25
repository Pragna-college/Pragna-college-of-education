// Supabase Configuration
// Replace these two values with your actual Supabase values
window.SUPABASE_URL = 'https://your-project-id.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-public-key-here';

// Convert Supabase library into app client
window.supabase = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

window.APP_CONFIG = {
  collegeName: 'Pragna College of Education',
  receiptPrefix: 'RCP',
  scholarshipUrl: '',
};
