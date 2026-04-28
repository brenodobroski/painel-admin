// 1. Importação do Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 2. Configuração (Use suas chaves do painel Project Settings > API)
const SUPABASE_URL = 'https://ijkzolhxuuqmkuztdliv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqa3pvbGh4dXVxbWt1enRkbGl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjE1NTgsImV4cCI6MjA5Mjc5NzU1OH0.37ihEUrCAUHpzOymrPUTau164DXmvhhWal8uX4V0oI0'; // Cole aqui sua chave anon public
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const loginForm = document.getElementById('login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        let statusTentativa = "";

        try {
            // 3. Tentativa de Login no Supabase
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error; // Se houver erro de credenciais, pula para o catch

            const user = data.user;

            // 4. Verificação de Role na tabela 'usuarios'
            // Lembre-se: O Trigger que criamos garante que o ID aqui é o mesmo do Auth
            const { data: perfil, error: erroPerfil } = await supabase
                .from('usuarios')
                .select('role')
                .eq('id', user.id)
                .single();

            if (!erroPerfil && perfil?.role === "admin") {
                statusTentativa = "SUCESSO_ADMIN";
                await registrarLogAcesso(email, statusTentativa);
                window.location.href = "index.html";
            } else {
                statusTentativa = "BLOQUEADO_VENDEDOR";
                await registrarLogAcesso(email, statusTentativa);
                
                alert("Área restrita apenas para administradores!");
                
                // Desloga o usuário imediatamente para não manter sessão de vendedor no Admin
                await supabase.auth.signOut();
            }

        } catch (error) {
            console.error("Erro no login:", error.message);
            
            // Mapeamento de erros do Supabase (mais simples que o Firebase)
            if (error.message.includes('Invalid login credentials')) {
                statusTentativa = "CREDENCIAIS_INVALIDAS";
            } else if (error.message.includes('Email not confirmed')) {
                statusTentativa = "EMAIL_NAO_CONFIRMADO";
            } else {
                statusTentativa = "ERRO_SISTEMA: " + error.message;
            }

            await registrarLogAcesso(email, statusTentativa);
            alert("E-mail ou senha incorretos.");
        }
    });
}

/**
 * FUNÇÃO DE AUDITORIA DE ACESSO
 * Como estatístico, você sabe que esses dados são ouro para identificar padrões de ataque.
 */
async function registrarLogAcesso(email, status) {
    try {
        const { error } = await supabase
            .from('logs_acesso')
            .insert([{
                email_tentado: email,
                status: status,
                horario: new Date().toISOString(), // ISO 8601 é o padrão do PostgreSQL
                ip_referencia: navigator.userAgent 
            }]);
            
        if (error) throw error;
    } catch (e) {
        console.error("Erro ao gravar log de acesso:", e);
    }
}