// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/supabaseClient.js
// OBJETIVO: Cliente Central de Conexão com o Supabase e Métodos de Autenticação
// ==============================================================================

// 1. Configurações Públicas do Projeto Supabase
// (Obtenha em: Supabase Dashboard > Project Settings > API)
const SUPABASE_URL = https://ibaavtapoqbvcbbqynxs.supabase.co/rest/v1/;
const SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliYWF2dGFwb3FidmNiYnF5bnhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NzE3NjUsImV4cCI6MjEwMzM0Nzc2NX0.PhXhDc8bd5c2msSa_mQuLsTDfn5MY5cjNbjJS-7EHc0;

// 2. Inicialização do Cliente Supabase via biblioteca CDN
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

if (!supabaseClient) {
    console.error('Biblioteca do Supabase não carregada. Verifique se o script CDN está presente no HTML.');
}

// 3. Objeto de Controle de Autenticação
const AuthController = {
    // Inicia login social com o Google
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

    // Encerra a sessão do usuário
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

    // Obtém o usuário atualmente autenticado
    async getCurrentUser() {
        if (!supabaseClient) return null;
        const { data: { session } } = await supabaseClient.auth.getSession();
        return session ? session.user : null;
    },

    // Carrega o perfil e a situação de triagem do usuário da tabela v2_profiles
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

    // Solicita enquadramento como Revenda com upload de comprovação
    async submitResellerApplication(userId, file) {
        if (!supabaseClient || !userId || !file) return { success: false, error: 'Dados incompletos.' };

        try {
            // Upload do documento de comprovação para o bucket restrito
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}_revenda_${Date.now()}.${fileExt}`;
            const filePath = `solicitacoes/${fileName}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('v2_documents')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Atualiza a solicitação no perfil do usuário
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
            console.error('Erro ao enviar comprovação de revenda:', err.message);
            return { success: false, error: err.message };
        }
    }
};

window.supabaseClient = supabaseClient;
window.AuthController = AuthController;
