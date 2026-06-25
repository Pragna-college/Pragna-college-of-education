// Supabase Configuration
// Replace these with your actual values from Supabase Project Settings → API
const SUPABASE_URL = 'https://ruuyoqcdsuarmhghwlri.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1dXlvcWNkc3Vhcm1oZ2h3bHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTY0ODQsImV4cCI6MjA5Nzg5MjQ4NH0.ft9Bd_Jk1pMS-fpiKIWVYG00Gf4qUTe_Dfzp5lxwz2k';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const APP_CONFIG = {
  collegeName: 'Pragna College of Education',
  receiptPrefix: 'RCP',
  scholarshipUrl: '',
};
