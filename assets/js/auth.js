// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/auth.js
// OBJETIVO: Interface Visual de Autenticação com Fallback Imediato
// ==============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    await initAuthUI();
});

let currentUserProfile = null;

async function initAuthUI() {
    const userContainer = document.getElementById('auth-user-container');
    if (!userContainer) return;

    try {
        // Se o Supabase ou AuthController não estiverem prontos, renderiza imediatamente como visitante
        if (!window.AuthController || !window.supabaseClient) {
            console.warn('Supabase não inicializado. Renderizando botão de login.');
            renderGuestUI(userContainer);
            return;
        }

        // Tentar obter sessão com timeout de segurança
        const userPromise = window.AuthController.getCurrentUser();
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 2500));
        const user = await Promise.race([userPromise, timeoutPromise]);

        if (!user) {
            renderGuestUI(userContainer);
            return;
        }

        currentUserProfile = await window.AuthController.getUserProfile(user.id);
        renderLoggedUI(userContainer, user, currentUserProfile);

    } catch (err) {
        console.error('Erro ao verificar autenticação:', err);
        renderGuestUI(userContainer);
    }
}

// Interface quando não há usuário logado (Visitante)
function renderGuestUI(container) {
    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span class="auth-status-pill badge-guest">🔒 Preços Ocultos</span>
            <button id="btn-login-google" class="btn-google-login">
                <svg width="16" height="16" viewBox="0 0 24 24" style="margin-right: 6px;">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Entrar com Google
            </button>
        </div>
    `;

    document.getElementById('btn-login-google')?.addEventListener('click', () => {
        window.AuthController.loginWithGoogle();
    });
}

// Interface quando há usuário logado
function renderLoggedUI(container, user, profile) {
    const role = profile ? profile.role : 'cliente_final';
    const status = profile ? profile.status : 'pendente';
    const userName = profile?.full_name || user.user_metadata?.full_name || 'Cliente';

    let badgeClass = 'badge-pending';
    let badgeText = '⏳ Em Triagem';

    if (role === 'master') {
        badgeClass = 'badge-master';
        badgeText = '👑 Painel Master';
    } else if (status === 'aprovado') {
        if (role === 'revenda') {
            badgeClass = 'badge-revenda';
            badgeText = '⭐ Revenda (50%)';
        } else {
            badgeClass = 'badge-cliente';
            badgeText = '✅ Cliente Final (100%)';
        }
    } else if (status === 'bloqueado') {
        badgeClass = 'badge-blocked';
        badgeText = '⛔ Bloqueado';
    }

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span>Olá, <strong>${userName}</strong></span>
            <span class="auth-status-pill ${badgeClass}">${badgeText}</span>
            ${role === 'master' ? '<a href="pages/admin.html" class="btn-admin-pill">Gerenciar Loja</a>' : ''}
            ${role !== 'master' && role !== 'revenda' ? '<button id="btn-solicitar-revenda" class="btn-revenda-pill">Quero ser Revenda</button>' : ''}
            <button id="btn-logout" class="btn-logout-pill">Sair</button>
        </div>
    `;

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        window.AuthController.logout();
    });

    document.getElementById('btn-solicitar-revenda')?.addEventListener('click', () => {
        openResellerModal(user.id);
    });
}

function openResellerModal(userId) {
    let modal = document.getElementById('modal-revenda');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-revenda';
        modal.className = 'custom-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content">
            <h3>Solicitação de Perfil de Revenda</h3>
            <p>Envie uma foto ou PDF comprovando atendimento a no mínimo <strong>3 clientes ativos</strong>.</p>
            <form id="form-revenda">
                <input type="file" id="revenda-doc" accept="image/*,.pdf" required style="margin: 15px 0;" />
                <div style="font-size: 11px; color: #666; background: #f5f5f5; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                    🔒 <strong>LGPD:</strong> Documento exclusivo para análise do administrador. Descarte permanente após a decisão.
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" onclick="document.getElementById('modal-revenda').style.display='none'" class="btn-secondary">Cancelar</button>
                    <button type="submit" class="btn-primary">Enviar</button>
                </div>
            </form>
        </div>
    `;

    modal.style.display = 'flex';

    document.getElementById('form-revenda').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('revenda-doc');
        if (!fileInput.files.length) return;

        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        const res = await window.AuthController.submitResellerApplication(userId, fileInput.files[0]);
        if (res.success) {
            alert('Comprovante enviado com sucesso para triagem manual!');
            modal.style.display = 'none';
            window.location.reload();
        } else {
            alert('Erro: ' + res.error);
            btn.disabled = false;
            btn.textContent = 'Enviar';
        }
    });
}
