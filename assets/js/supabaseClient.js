// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/supabaseClient.js
// OBJETIVO: Conexão Segura com Supabase usando a chave pública (anon)
// ==============================================================================

// 1. Configurações Públicas do Projeto
// URL do seu projeto (conforme visto no seu painel)
const SUPABASE_URL = https://ibaavtapoqbvcbbqynxs.supabase.co/rest/v1/;

// ATENÇÃO: Cole aqui APENAS a chave "anon" "public" (Project Settings > API > anon public)
// NUNCA cole a service_role secret aqui!
const SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliYWF2dGFwb3FidmNiYnF5bnhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NzE3NjUsImV4cCI6MjEwMzM0Nzc2NX0.PhXhDc8bd5c2msSa_mQuLsTDfn5MY5cjNbjJS-7EHc0;

// 2. Inicialização do Cliente Supabase
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

if (!supabaseClient) {
    console.error('Biblioteca do Supabase não carregada. Verifique o script CDN no HTML.');
}

// 3. Objeto de Controle de Autenticação
const AuthController = {
    // Inicia login social com Google
    async loginWithGoogle() {
        if (!supabaseClient) return;
        try {
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + window.location.pathname
                }
            });
            if (error) throw error;
        } catch (err) {
            console.error('Erro ao autenticar com Google:', err.message);
            alert('Não foi possível iniciar o login com o Google. Tente novamente.');
        }
    },

    // Encerra a sessão
    async logout() {
        if (!supabaseClient) return;
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            window.location.reload();
        } catch (err) {
            console.error('Erro ao deslogar:', err.message);
        }
    },

    // Retorna usuário logado
    async getCurrentUser() {
        if (!supabaseClient) return null;
        const { data: { session } } = await supabaseClient.auth.getSession();
        return session ? session.user : null;
    },

    // Carrega o perfil da tabela v2_profiles
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
            console.error('Erro ao carregar perfil:', err.message);
            return null;
        }
    },

    // Envio de Comprovante de Revenda usando seu bucket "reseller-proofs"
    async submitResellerApplication(userId, file) {
        if (!supabaseClient || !userId || !file) return { success: false, error: 'Dados incompletos.' };

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}_comprovante_${Date.now()}.${fileExt}`;
            const filePath = `solicitacoes/${fileName}`;

            // Upload para o bucket existente "reseller-proofs"
            const { error: uploadError } = await supabaseClient.storage
                .from('reseller-proofs')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Atualiza status para pendente de triagem
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
            console.error('Erro ao enviar comprovação:', err.message);
            return { success: false, error: err.message };
        }
    }
};

window.supabaseClient = supabaseClient;
window.AuthController = AuthController;
