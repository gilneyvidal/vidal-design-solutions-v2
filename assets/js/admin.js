// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/admin.js
// OBJETIVO: Lógica do Painel Master Administrativo (Pedidos, Revenda, Produtos, Configs)
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

// Trava de Segurança: Apenas o Master acessa
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
        alert('Acesso negado. Apenas o Administrador Master tem permissão.');
        window.location.href = '../index.html';
        return;
    }

    document.getElementById('admin-user-name').textContent = profile.full_name || 'Gilney Vidal';
}

// Navegação entre Abas do Painel
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

// Carregamento de Todos os Dados
async function loadDashboardData() {
    await Promise.all([
        loadOrders(),
        loadUsersAndResellers(),
        loadProductsList(),
        loadSettings()
    ]);
}

// ==============================================================================
// 1. MÓDULO DE PEDIDOS
// ==============================================================================
async function loadOrders() {
    const tbody = document.getElementById('admin-orders-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Carregando pedidos...</td></tr>';

    try {
        const { data, error } = await window.supabaseClient
            .from('v2_orders')
            .select(`
                *,
                user:v2_profiles(full_name, email, phone)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        allOrders = data || [];
        renderOrdersTable(allOrders);
    } catch (err) {
        console.error('Erro ao buscar pedidos:', err.message);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Erro ao carregar pedidos.</td></tr>';
    }
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('admin-orders-tbody');
    if (!tbody) return;

    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum pedido registrado.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    orders.forEach(order => {
        const clientName = order.user?.full_name || 'Não identificado';
        const clientContact = order.user?.phone || order.user?.email || '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${order.order_code}</strong></td>
            <td>${new Date(order.created_at).toLocaleDateString('pt-BR')}</td>
            <td>
                <strong>${clientName}</strong><br>
                <small class="text-muted">${clientContact}</small>
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
                <button class="btn-action-view" onclick="viewOrderDetails('${order.id}')">Ver Detalhes</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Atualizar Status do Pedido
window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        const { error } = await window.supabaseClient
            .from('v2_orders')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', orderId);

        if (error) throw error;

        // Registrar no histórico de auditoria
        await window.supabaseClient.from('v2_order_history').insert({
            order_id: orderId,
            new_status: newStatus,
            changed_by: currentMasterUser.id,
            notes: `Status alterado no Painel Master para ${newStatus.toUpperCase()}`
        });

        alert(`Status do pedido atualizado para ${newStatus.toUpperCase()}`);
    } catch (err) {
        console.error('Erro ao atualizar status:', err.message);
        alert('Erro ao atualizar status.');
    }
};

// ==============================================================================
// 2. MÓDULO DE TRIAGEM DE REVENDA E USUÁRIOS (LGPD)
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

        // Filtrar pendentes de revenda
        const pendingResellers = allUsers.filter(u => u.requested_role === 'revenda' && u.status === 'pendente');
        renderResellersTable(resellerTbody, pendingResellers);
        renderUsersTable(usersTbody, allUsers);
    } catch (err) {
        console.error('Erro ao carregar usuários:', err.message);
    }
}

function renderResellersTable(tbody, list) {
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma solicitação de revenda pendente.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    list.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${user.full_name || 'Sem nome'}</strong></td>
            <td>${user.email}</td>
            <td>${user.phone || 'Não informado'}</td>
            <td><small>${user.notes || 'Comprovante submetido'}</small></td>
            <td>
                <button class="btn-approve" onclick="decisionReseller('${user.id}', true)">✓ Aprovar Revenda</button>
                <button class="btn-reject" onclick="decisionReseller('${user.id}', false)">✕ Converter em Cliente Final</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderUsersTable(tbody, list) {
    if (!tbody) return;
    tbody.innerHTML = '';
    list.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.full_name || 'Sem nome'}</td>
            <td>${u.email}</td>
            <td><span class="role-badge ${u.role}">${u.role.toUpperCase()}</span></td>
            <td><span class="status-badge ${u.status}">${u.status.toUpperCase()}</span></td>
            <td>
                ${u.role !== 'master' ? `
                    <button class="btn-sm" onclick="toggleUserBlock('${u.id}', '${u.status}')">
                        ${u.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                    </button>
                ` : '<em>Master Oficial</em>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Decisão de Revenda com Descarte Imediato do Documento (LGPD)
window.decisionReseller = async function(userId, approved) {
    const actionText = approved ? 'APROVAR como Revenda' : 'REPROVAR e converter para Cliente Final';
    if (!confirm(`Confirma a decisão de ${actionText}? O comprovante será descartado permanentemente conforme a LGPD.`)) return;

    try {
        const newRole = approved ? 'revenda' : 'cliente_final';
        
        // 1. Atualizar Perfil do Usuário
        const { error: updateError } = await window.supabaseClient
            .from('v2_profiles')
            .update({
                role: newRole,
                status: 'aprovado',
                requested_role: newRole,
                notes: `Triagem concluída em ${new Date().toLocaleDateString('pt-BR')}: ${approved ? 'Revenda Aprovada' : 'Convertido para Cliente Final'}`
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        // 2. Excluir Documento do Storage (Descarte Físico Obrigatório)
        try {
            const { data: files } = await window.supabaseClient.storage.from('v2_documents').list('solicitacoes');
            const userFile = files?.find(f => f.name.startsWith(userId));
            if (userFile) {
                await window.supabaseClient.storage.from('v2_documents').remove([`solicitacoes/${userFile.name}`]);
            }
        } catch (storageErr) {
            console.warn('Arquivo temporário já havia sido descartado ou não encontrado.');
        }

        alert('Decisão gravada com sucesso e documento comprobatório descartado.');
        await loadUsersAndResellers();
    } catch (err) {
        console.error('Erro na triagem:', err.message);
        alert('Erro ao processar decisão.');
    }
};

// ==============================================================================
// 3. MÓDULO DE PRODUTOS E PREÇOS DE CUSTO
// ==============================================================================
async function loadProductsList() {
    const tbody = document.getElementById('admin-products-tbody');
    if (!tbody) return;

    try {
        const { data, error } = await window.supabaseClient
            .from('v2_products')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        allProducts = data || [];
        renderProductsTable(allProducts);
    } catch (err) {
        console.error('Erro ao carregar produtos:', err.message);
    }
}

function renderProductsTable(products) {
    const tbody = document.getElementById('admin-products-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    products.forEach(p => {
        const cost = Number(p.base_cost) || 0;
        const revendaPrice = cost * 1.5; // Custo + 50%
        const finalPrice = cost * 2.0;   // Custo + 100% (o dobro)

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.name}</strong></td>
            <td>${p.calculation_type.toUpperCase()}</td>
            <td><strong>${cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></td>
            <td><span style="color: #2e7d32;">${revendaPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (+50%)</span></td>
            <td><span style="color: #d84315;">${finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (+100%)</span></td>
            <td>${p.is_active ? '✅ Ativo' : '❌ Inativo'}</td>
            <td>
                <button class="btn-sm" onclick="editProduct('${p.id}')">Editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Salvar / Criar Novo Produto
async function saveProduct(formData) {
    try {
        const cost = parseFloat(formData.get('base_cost')) || 0;
        const imagesList = [
            formData.get('img_1') || '',
            formData.get('img_2') || '',
            formData.get('img_3') || '',
            formData.get('img_4') || ''
        ].filter(Boolean);

        const payload = {
            name: formData.get('name'),
            slug: formData.get('name').toLowerCase().replace(/\s+/g, '-'),
            description: formData.get('description'),
            base_cost: cost,
            calculation_type: formData.get('calculation_type'),
            production_days: parseInt(formData.get('production_days')) || 2,
            images: imagesList,
            is_active: true
        };

        const { error } = await window.supabaseClient.from('v2_products').insert(payload);
        if (error) throw error;

        alert('Produto cadastrado com sucesso!');
        document.getElementById('form-new-product').reset();
        await loadProductsList();
    } catch (err) {
        console.error('Erro ao salvar produto:', err.message);
        alert('Erro ao salvar produto: ' + err.message);
    }
}

// ==============================================================================
// 4. MÓDULO DE CONFIGURAÇÕES GLOBAIS
// ==============================================================================
async function loadSettings() {
    try {
        const { data } = await window.supabaseClient
            .from('v2_settings')
            .select('*')
            .eq('id', 'global')
            .single();

        if (data) {
            globalSettings = data;
            document.getElementById('cfg-reseller-margin').value = data.reseller_margin * 100;
            document.getElementById('cfg-retail-margin').value = data.retail_margin * 100;
            document.getElementById('cfg-art-fee').value = data.art_fee;
            document.getElementById('cfg-min-area').value = data.min_area_sqm;
            document.getElementById('cfg-whatsapp').value = data.whatsapp_number;
        }
    } catch (e) {
        console.warn('Configurações não carregadas.');
    }
}

function initAdminEventListeners() {
    // Busca Rápida de Pedidos
    document.getElementById('admin-order-search')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allOrders.filter(o => 
            o.order_code.toLowerCase().includes(term) ||
            o.user?.full_name?.toLowerCase().includes(term) ||
            o.status.toLowerCase().includes(term)
        );
        renderOrdersTable(filtered);
    });

    // Submissão do Formulário de Produto
    document.getElementById('form-new-product')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveProduct(new FormData(e.target));
    });

    // Atualização das Margens em tempo real no formulário
    document.getElementById('new-prod-cost')?.addEventListener('input', (e) => {
        const c = parseFloat(e.target.value) || 0;
        document.getElementById('preview-revenda').textContent = (c * 1.5).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('preview-cliente').textContent = (c * 2.0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    });
}
