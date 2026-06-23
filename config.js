// Configuração do Supabase — preencha após criar o projeto
const SUPABASE_URL = 'https://zwqroxtthlamiafcavxc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cXJveHR0aGxhbWlhZmNhdnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjUwNzgsImV4cCI6MjA5NzgwMTA3OH0.HYtbcquWtkMoAZwb8QYSlsOr2blD08o1Mnh3Fyz0mI8';

window.db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// PIN de acesso da administradora (pode trocar para o que quiser)
window.ADMIN_PIN = '3004';

// Chave PIX para recebimento
window.PIX_KEY = 'sejaeter@gmail.com';
