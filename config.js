// Configuração do Supabase — preencha após criar o projeto
const SUPABASE_URL = 'https://fmudggjeekfozwokgctg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtdWRnZ2plZWtmb3p3b2tnY3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMzk4NzAsImV4cCI6MjA5NzYxNTg3MH0.-p76AYwUKwxNUYJL-CX5Vru1774pr7fI4XPHY_vLnDs';

window.db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// PIN de acesso da administradora (pode trocar para o que quiser)
window.ADMIN_PIN = '3004';

// Chave PIX para recebimento
window.PIX_KEY = 'sejaeter@gmail.com';
