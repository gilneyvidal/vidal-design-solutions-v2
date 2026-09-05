// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/auth.js
// OBJETIVO: Barra Superior com Rótulos Profissionais (Sem Exposição de Margens)
// ==============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    await initAuthUI();
});

let currentUserProfile = null;

async function initAuthUI() {
    const userContainer = document.getElementById('auth-user-container');
    if (!userContainer) return;

    try {
        if (!window.AuthController || !window.supabaseClient) {
            renderGuestUI(userContainer);
            return;
        }

        const user = await window.AuthController.getCurrentUser();
        if (!user) {
            renderGuestUI(userContainer);
            return;
        }

        currentUserProfile = await window.AuthController.getUserProfile(user.id);
        renderLoggedUI(userContainer, user, currentUserProfile);

    } catch (err) {
        renderGuestUI(userContainer);
    }
}

function renderGuestUI(container) {
    container.innerHTML = `
        <div class="auth-buttons-group">
            <span class="auth-status-pill badge-guest">🔒 Preços Ocultos</span>
            <button id="btn-login-google" class="btn-google-login" onclick="window.AuthController.loginWithGoogle()">
                <i class="fab fa-google" style="color: #ea4335; margin-right: 6px;"></i> Entrar com Google
            </button>
            <button class="btn-signup-direct" onclick="openRegisterModal()">
                <i class="fas fa-user-plus"></i> Cadastre-se
            </button>
        </div>
    `;
}

function renderLoggedUI(container, user, profile) {
    const role = profile ? profile.role : 'cliente_final';
    const status = profile ? profile.status : 'pendente';
    const userName = profile?.full_name || user.user_metadata?.full_name || 'Cliente';

    let badgeClass = 'badge-pending';
    let badgeText = '⏳ Em Triagem';

    if (role === 'master') {
        badgeClass = 'badge-master';
        badgeText = '👑 Painel Master';
    } else if (role === 'gerente') {
        badgeClass = 'badge-gerente';
        badgeText = '👔 Gerente';
    } else if (role === 'vendedor') {
        badgeClass = 'badge-vendedor';
        badgeText = '📦 Vendedor / Produção';
    } else if (status === 'aprovado') {
        if (role === 'revenda') {
            badgeClass = 'badge-revenda';
            badgeText = '⭐ Revenda Autorizada'; // SEM porcentagem
        } else {
            badgeClass = 'badge-cliente';
            badgeText = '✅ Cliente Final';     // SEM porcentagem
        }
    } else if (status === 'bloqueado') {
        badgeClass = 'badge-blocked';
        badgeText = '⛔ Bloqueado';
    }

    const isInPages = window.location.pathname.includes('/pages/');
    const accountUrl = isInPages ? 'minha-conta.html' : 'pages/minha-conta.html';
    const adminUrl = isInPages ? 'admin.html' : 'pages/admin.html';
    const canAccessAdmin = role === 'master' || role === 'gerente' || role === 'vendedor';

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span>Olá, <strong>${userName}</strong></span>
            <span class="auth-status-pill ${badgeClass}">${badgeText}</span>
            <a href="${accountUrl}" class="btn-account-pill">
                <i class="fas fa-user"></i> Minha Conta
            </a>
            ${canAccessAdmin ? `<a href="${adminUrl}" class="btn-admin-pill"><i class="fas fa-cog"></i> Gerenciar Loja</a>` : ''}
            <button id="btn-logout" class="btn-logout-pill" onclick="window.AuthController.logout()">Sair</button>
        </div>
    `;
}
