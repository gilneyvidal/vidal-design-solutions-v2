// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/admin.js
// OBJETIVO: Lógica do Painel Master com Motor de Variáveis e Edição
// ==============================================================================

let currentMasterUser = null;
let allOrders = [];
let allUsers = [];
let allProducts = [];
let globalSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
    await verifyMasterAccess();
    initTabNavigation();
    await loadDashboardData();
    initAdminEventListeners();
});

// Trava de Segurança
async function verifyMasterAccess() {
    if (!window.AuthController) return;

    currentMasterUser = await window.AuthController.getCurrentUser();
    if (!currentMasterUser) {
        alert('Acesso restrito. Faça login como administrador.');
        window.location.href = '../index.html';
        return;
    }

    const profile = await window.AuthController.getUserProfile(currentMasterUser.id);
    if (!profile || profile.role !== 'master') {
        alert('Acesso restrito para o Administrador Master.');
        window.location.href = '../index.html';
        return;
    }

    document.getElementById('admin-user-name').textContent = profile.full_name || 'Gilney Vidal';
}

function initTabNavigation() {
    const tabs = document.querySelectorAll('.admin-nav-item');
    const sections = document.querySelectorAll('.admin-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = tab.getAttribute('data-target');

            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(targetId)?.classList.add('active');
        });
    });
}

async function loadDashboardData() {
    await Promise.all([
        loadOrders(),
        loadUsersAndResellers(),
        loadProductsList(),
        loadSettings()
    ]);
}

// ==============================================================================
// 1. GESTÃO DE PEDIDOS
// ==============================================================================
async function loadOrders() {
    const tbody = document.getElementById('admin-orders-tbody');
    if (!tbody) return;

    try {
        const { data, error } = await window.supabaseClient
            .from('v2_orders')
            .select(`*, user:v2_profiles(full_name, email, phone)`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        allOrders = data || [];
        renderOrdersTable(allOrders);
    } catch (err) {
        console.error('Erro ao buscar pedidos:', err);
    }
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('admin-orders-tbody');
    if (!tbody) return;

    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Nenhum pedido registrado ainda.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    orders.forEach(order => {
        const clientName = order.user?.full_name || 'Cliente';
        const clientContact = order.user?.phone || order.user?.email || '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${order.order_code}</strong></td>
            <td>${new Date(order.created_at).toLocaleDateString('pt-BR')}</td>
            <td>
                <strong>${clientName}</strong><br>
                <small style="color:#64748b;">${clientContact}</small>
            </td>
            <td><span class="role-badge ${order.user_role}">${order.user_role.toUpperCase()}</span></td>
            <td><strong>${Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></td>
            <td>
                <select class="status-select" onchange="updateOrderStatus('${order.id}', this.value)">
                    <option value="recebido" ${order.status === 'recebido' ? 'selected' : ''}>Recebido</option>
                    <option value="aprovado" ${order.status === 'aprovado' ? 'selected' : ''}>Aprovado</option>
                    <option value="produzindo" ${order.status === 'produzindo' ? 'selected' : ''}>Produzindo</option>
                    <option value="transportando" ${order.status === 'transportando' ? 'selected' : ''}>Transportando</option>
                    <option value="finalizado" ${order.status === 'finalizado' ? 'selected' : ''}>Finalizado</option>
                    <option value="cancelado" ${order.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
            </td>
            <td>
                <button class="btn-edit" onclick="alert('ID: ${order.order_code}\\nValor: R$ ${order.total}\\nRecebimento: ${order.delivery_type.toUpperCase()}')">Ver</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        const { error } = await window.supabaseClient
            .from('v2_orders')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', orderId);

        if (error) throw error;
        alert(`Status alterado para ${newStatus.toUpperCase()}`);
    } catch (err) {
        alert('Erro ao atualizar status.');
    }
};

// ==============================================================================
// 2. TRIAGEM DE REVENDA E LGPD
// ==============================================================================
async function loadUsersAndResellers() {
    const resellerTbody = document.getElementById('admin-resellers-tbody');
    const usersTbody = document.getElementById('admin-users-tbody');

    try {
        const { data, error } = await window.supabaseClient
            .from('v2_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        allUsers = data || [];

        const pendingResellers = allUsers.filter(u => u.requested_role === 'revenda' && u.status === 'pendente');
        renderResellersTable(resellerTbody, pendingResellers);
        renderUsersTable(usersTbody, allUsers);
    } catch (err) {
        console.error('Erro ao carregar usuários:', err);
    }
}

function renderResellersTable(tbody, list) {
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#64748b;">Nenhuma solicitação de revenda pendente.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    list.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${user.full_name || 'Sem nome'}</strong></td>
            <td>${user.email}</td>
            <td>${user.phone || 'Não informado'}</td>
            <td><small>${user.notes || 'Comprovante anexado'}</small></td>
            <td>
                <button class="btn-approve" onclick="decisionReseller('${user.id}', true)">✓ Aprovar Revenda</button>
                <button class="btn-reject" onclick="decisionReseller('${user.id}', false)">✕ Converter em Cliente Final</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderUsersTable(tbody, list) {
