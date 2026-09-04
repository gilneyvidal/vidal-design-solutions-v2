// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/auth.js
// OBJETIVO: Interface Visual de Autenticação, Status do Usuário e Modais LGPD
// ==============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    await initAuthUI();
});

let currentUserProfile = null;

async function initAuthUI() {
    const userContainer = document.getElementById('auth-user-container');
    if (!userContainer) return;

    // Verificar se há usuário logado
    const user = await window.AuthController.getCurrentUser();

    if (!user) {
        renderGuestUI(userContainer);
        return;
    }

    // Carregar informações de perfil da v2_profiles
    currentUserProfile = await window.AuthController.getUserProfile(user.id);
    renderLoggedUI(userContainer, user, currentUserProfile);
}

// Interface quando não há usuário logado (Visitante)
function renderGuestUI(container) {
    container.innerHTML = `
        <div class="auth-guest-box">
            <span class="auth-badge guest">🔒 Preços Ocultos</span>
            <button id="btn-login-google" class="btn-google-login">
                <svg width="18" height="18" viewBox="0 0 24 24">
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
    let badgeText = '⏳ Cadastro em Triagem';

    if (role === 'master') {
        badgeClass = 'badge-master';
        badgeText = '👑 Painel Master';
    } else if (status === 'aprovado') {
        if (role === 'revenda') {
            badgeClass = 'badge-revenda';
            badgeText = '⭐ Revenda Aprovada (Margem 50%)';
        } else {
            badgeClass = 'badge-cliente';
            badgeText = '✅ Cliente Final (Margem 100%)';
        }
    } else if (status === 'bloqueado') {
        badgeClass = 'badge-blocked';
        badgeText = '⛔ Acesso Bloqueado';
    }

    container.innerHTML = `
        <div class="auth-user-box">
            <div class="user-meta">
                <span class="user-name">Olá, <strong>${userName}</strong></span>
                <span class="auth-status-pill ${badgeClass}">${badgeText}</span>
            </div>
            <div class="user-actions">
                ${role === 'master' ? '<a href="#painel-master" class="btn-admin-link">Gerenciar Loja</a>' : ''}
                ${role !== 'master' && role !== 'revenda' ? '<button id="btn-solicitar-revenda" class="btn-solicitar-revenda">Quero ser Revenda</button>' : ''}
                <button id="btn-logout" class="btn-logout">Sair</button>
            </div>
        </div>
    `;

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        window.AuthController.logout();
    });

    document.getElementById('btn-solicitar-revenda')?.addEventListener('click', () => {
        openResellerModal(user.id);
    });
}

// Modal de Comprovação de Revenda com LGPD
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
            <p>Para obter a tabela de preços exclusiva de revenda, você deve demonstrar sua atuação profissional no mercado gráfico.</p>
            
            <div class="requirements-box">
                <strong>Critério obrigatório:</strong> Envie uma foto ou arquivo PDF comprovando o atendimento a pelo menos <strong>3 clientes ativos</strong>.
            </div>

            <form id="form-revenda">
                <label for="revenda-doc">Comprovante (Foto ou PDF):</label>
                <input type="file" id="revenda-doc" accept="image/*,.pdf" required />
                
                <div class="lgpd-notice">
                    🔒 <strong>Aviso de Privacidade & LGPD:</strong> Seu documento será utilizado unicamente para análise cadastral manual pelo administrador. Após a decisão, o arquivo será <strong>permanentemente descartado</strong> de nossos servidores.
                </div>

                <div class="modal-buttons">
                    <button type="button" id="btn-cancel-modal" class="btn-secondary">Cancelar</button>
                    <button type="submit" class="btn-primary">Enviar para Triagem</button>
                </div>
            </form>
        </div>
    `;

    modal.style.display = 'flex';

    document.getElementById('btn-cancel-modal').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    document.getElementById('form-revenda').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('revenda-doc');
        if (!fileInput.files.length) return;

        const btnSubmit = e.target.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Enviando...';

        const result = await window.AuthController.submitResellerApplication(userId, fileInput.files[0]);

        if (result.success) {
            alert('Sua solicitação de revenda foi enviada com sucesso! Ela passará por triagem do administrador.');
            modal.style.display = 'none';
            window.location.reload();
        } else {
            alert('Ocorreu um erro no envio: ' + result.error);
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Enviar para Triagem';
        }
    });
}
