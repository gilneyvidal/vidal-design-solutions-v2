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

    try {
        if (!window.AuthController || !window.supabaseClient) {
            console.warn('Supabase não inicializado. Renderizando botão de login.');
            renderGuestUI(userContainer);
            return;
        }

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
        console.error('Erro na autenticação:', err);
        renderGuestUI(userContainer);
    }
}

// Interface quando não há usuário logado (Visitante)
function renderGuestUI(container) {
    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span class="auth-status-pill badge-guest">🔒 Preços Ocultos</span>
            <button id="btn-login-google" class="btn-google-login" onclick="window.AuthController.loginWithGoogle()">
                <i class="fab fa-google" style="color: #ea4335; margin-right: 6px;"></i> Entrar com Google
            </button>
        </div>
    `;
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
            ${role !== 'master' && role !== 'revenda' ? '<button id="btn-solicitar-revenda" class="btn-revenda-pill" onclick="openResellerModal(\'' + user.id + '\')">Quero ser Revenda</button>' : ''}
            <button id="btn-logout" class="btn-logout-pill" onclick="window.AuthController.logout()">Sair</button>
        </div>
    `;
}

// Modal de Comprovação de Revenda (LGPD)
function openResellerModal(userId) {
    let modal = document.getElementById('modal-revenda');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-revenda';
        modal.className = 'custom-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content-revenda">
            <h3 style="margin-bottom: 10px; color: #111;">Solicitação de Perfil de Revenda</h3>
            <p style="font-size: 13px; color: #555; margin-bottom: 15px;">Para liberar a tabela exclusiva de revenda (+50%), envie uma foto ou PDF demonstrando no mínimo <strong>3 clientes ativos</strong>.</p>
            <form id="form-revenda">
                <input type="file" id="revenda-doc" accept="image/*,.pdf" required style="width: 100%; margin-bottom: 15px;" />
                <div style="font-size: 11px; color: #666; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 15px;">
                    🔒 <strong>Aviso LGPD:</strong> Seu documento é exclusivo para triagem manual do administrador. Após a decisão, ele é <strong>descartado permanentemente</strong> do servidor.
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" onclick="document.getElementById('modal-revenda').style.display='none'" style="background: #e2e8f0; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Cancelar</button>
                    <button type="submit" style="background: #16a34a; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">Enviar para Triagem</button>
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
            alert('Erro no envio: ' + res.error);
            btn.disabled = false;
            btn.textContent = 'Enviar para Triagem';
        }
    });
}
