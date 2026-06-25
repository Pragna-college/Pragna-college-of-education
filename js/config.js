// Supabase Configuration
// Replace these two values with your actual Supabase values
window.SUPABASE_URL = 'https://ruuyoqcdsuarmhghwlri.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1dXlvcWNkc3Vhcm1oZ2h3bHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTY0ODQsImV4cCI6MjA5Nzg5MjQ4NH0.ft9Bd_Jk1pMS-fpiKIWVYG00Gf4qUTe_Dfzp5lxwz2k';

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
