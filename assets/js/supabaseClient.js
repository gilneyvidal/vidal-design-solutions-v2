// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/supabaseClient.js
// OBJETIVO: Conexão Oficial com Supabase e Redirecionamento Correto para GitHub Pages
// ==============================================================================

const SUPABASE_URL = 'https://ibaavtapoqbvcbbqynxs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliYWF2dGFwb3FidmNiYnF5bnhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NzE3NjUsImV4cCI6MjEwMzM0Nzc2NX0.PhXhDc8bd5c2msSa_mQuLsTDfn5MY5cjNbjJS-7EHc0';

// URL Oficial de Retorno após o Login
const OFFICIAL_REDIRECT_URL = 'https://gilneyvidal.github.io/vidal-design-solutions-v2/';

let supabaseClient = null;

try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase conectado com sucesso.');
    } else {
        console.error('❌ Biblioteca Supabase CDN não encontrada no HTML.');
    }
} catch (e) {
    console.error('❌ Erro na inicialização do cliente Supabase:', e);
}

const AuthController = {
    // Inicia login social com Google apontando para o GitHub Pages
    async loginWithGoogle() {
        if (!supabaseClient) {
            alert('Atenção: O cliente Supabase não está inicializado.');
            return;
        }

        try {
            console.log('Redirecionando para login com Google...');
            const { data, error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: OFFICIAL_REDIRECT_URL
                }
            });

            if (error) throw error;
        } catch (err) {
            console.error('Erro ao conectar com Google:', err);
            alert('Aviso do Supabase: ' + err.message);
        }
    },

    // Encerra a sessão atual
    async logout() {
        if (!supabaseClient) return;
        try {
            await supabaseClient.auth.signOut();
            window.location.href = OFFICIAL_REDIRECT_URL;
        } catch (err) {
            console.error('Erro ao encerrar sessão:', err);
        }
    },

    // Retorna os dados da sessão do usuário
    async getCurrentUser() {
        if (!supabaseClient) return null;
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            return session ? session.user : null;
        } catch (e) {
            return null;
        }
    },

    // Carrega os dados de perfil da tabela v2_profiles
    async getUserProfile(userId) {
        if (!supabaseClient || !userId) return null;
        try {
            const { data, error } = await supabaseClient
                .from('v2_profiles')
                .select('*')
                .eq('id', userId)
                .single();
            if (error) throw error;
            return data;
        } catch (err) {
            console.warn('Perfil ainda não localizado ou em triagem:', err.message);
            return null;
        }
    },

    // Envia comprovante de revenda para o bucket "reseller-proofs"
    async submitResellerApplication(userId, file) {
        if (!supabaseClient || !userId || !file) return { success: false, error: 'Dados incompletos.' };

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}_comprovante_${Date.now()}.${fileExt}`;
            const filePath = `solicitacoes/${fileName}`;

            // Upload para o bucket existente
            const { error: uploadError } = await supabaseClient.storage
                .from('reseller-proofs')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Atualiza status do perfil para pendente de análise
            const { error: updateError } = await supabaseClient
                .from('v2_profiles')
                .update({
                    requested_role: 'revenda',
                    status: 'pendente',
                    notes: `Comprovante enviado: ${fileName} em ${new Date().toLocaleString('pt-BR')}`
                })
                .eq('id', userId);

            if (updateError) throw updateError;

            return { success: true };
        } catch (err) {
            console.error('Erro no envio de comprovação:', err);
            return { success: false, error: err.message };
        }
    }
};

window.supabaseClient = supabaseClient;
window.AuthController = AuthController;
