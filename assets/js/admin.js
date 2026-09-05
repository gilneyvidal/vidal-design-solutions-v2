// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/admin.js
// OBJETIVO: Gestão Master: Exclusões, Ficha do Pedido, Edição de Usuários e Regras
// ==============================================================================

let currentMasterUser = null;
let allOrders = [];
let allUsers = [];
let allProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
    await verifyMasterAccess();
    initTabNavigation();
    await loadDashboardData();
    initAdminEventListeners();
});

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
// 1. GESTÃO DE PEDIDOS & EXCLUSÃO
// ==============================================================================
async function loadOrders() {
    const tbody = document.getElementById('admin-orders-tbody');
    if (!tbody) return;
    try {
        const { data, error } = await window.supabaseClient
            .from('v2_orders')
            .select(`
                *,
                user:v2_profiles(full_name, email, phone, address),
                items:v2_order_items(*)
            `)
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
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Nenhum pedido registrado.</td></tr>';
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
            <td><strong>${clientName}</strong><br><small style="color:#64748b;">${clientContact}</small></td>
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
                <button class="btn-action-delete" onclick="deleteOrder('${order.id}', '${order.order_code}')" title="Excluir Pedido">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Excluir Pedido
window.deleteOrder = async function(orderId, orderCode) {
    if (!confirm(`Tem certeza que deseja EXCLUIR permanentemente o pedido ${orderCode}?`)) return;
    try {
        const { error } = await window.supabaseClient.from('v2_orders').delete().eq('id', orderId);
        if (error) throw error;
        alert(`Pedido ${orderCode} excluído!`);
        await loadOrders();
    } catch (err) {
        alert('Erro ao excluir pedido: ' + err.message);
    }
};

// Modal Ficha Completa
window.viewOrderDetails = function(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const modal = document.getElementById('modal-order-inspect');
    const container = document.getElementById('modal-order-inspect-body');
    if (!modal || !container) return;

    const clientName = order.user?.full_name || 'Cliente';
    const clientEmail = order.user?.email || '-';
    const clientPhone = order.user?.phone || '-';

    const items = order.items && order.items.length > 0 ? order.items : [
        { product_name: 'Material de Comunicação Visual', quantity: 1, unit_price: order.subtotal || order.total, item_total: order.total }
    ];

    let itemsRows = '';
    items.forEach((it, idx) => {
        itemsRows += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px;">${idx + 1}</td>
                <td style="padding: 10px;"><strong>${it.product_name}</strong></td>
                <td style="padding: 10px; text-align: center;">${it.quantity}</td>
                <td style="padding: 10px; text-align: right;">${Number(it.unit_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td style="padding: 10px; text-align: right;"><strong>${Number(it.item_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></td>
            </tr>
        `;
    });

    let addressHTML = 'Retirada na Empresa (Grátis)';
    if (order.delivery_type === 'entrega' && order.delivery_address) {
        const a = order.delivery_address;
        addressHTML = `Entrega: ${a.rua || ''}, ${a.numero || ''} - ${a.bairro || ''} (${a.cidade || ''})`;
    }

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #f97316; padding-bottom: 15px; margin-bottom: 20px;">
            <div>
                <h2 style="margin: 0; color: #0f172a; font-size: 22px;">Pedido ${order.order_code}</h2>
                <small style="color: #64748b;">Registrado em: ${new Date(order.created_at).toLocaleString('pt-BR')}</small>
            </div>
            <div>
                <span class="role-badge ${order.user_role}" style="font-size: 13px; padding: 6px 12px;">${order.user_role.toUpperCase()}</span>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f8fafc; padding: 18px; border-radius: 8px; margin-bottom: 20px; font-size: 13px;">
            <div>
                <strong>Cliente:</strong> ${clientName}<br>
                <strong>E-mail:</strong> ${clientEmail}<br>
                <strong>Telefone:</strong> ${clientPhone}
            </div>
            <div>
                <strong>Recebimento:</strong> ${addressHTML}<br>
                <strong>Canal:</strong> ${order.payment_method ? order.payment_method.toUpperCase() : 'WHATSAPP'}<br>
                <strong>Status Atual:</strong> <strong style="color: #ea580c;">${order.status.toUpperCase()}</strong>
            </div>
        </div>

        <h3 style="font-size: 15px; margin-bottom: 10px; color: #0f172a;">Itens & Especificações:</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
            <thead>
                <tr style="background: #0f172a; color: #fff;">
                    <th style="padding: 8px; text-align: left;">#</th>
                    <th style="padding: 8px; text-align: left;">Descrição da Peça</th>
                    <th style="padding: 8px; text-align: center;">Qtd</th>
                    <th style="padding: 8px; text-align: right;">Unitário</th>
                    <th style="padding: 8px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRows}
            </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-bottom: 25px;">
            <div style="width: 280px; background: #fff7ed; padding: 16px; border-radius: 8px; border-left: 4px solid #f97316; font-size: 13px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span>Subtotal:</span>
                    <strong>${Number(order.subtotal || order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span>Taxa de Arte:</span>
                    <strong>${Number(order.art_fee || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: #c2410c; border-top: 1px solid #fed7aa; padding-top: 6px;">
                    <span>TOTAL DO PEDIDO:</span>
                    <span>${Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            <button onclick="document.getElementById('modal-order-inspect').style.display='none'" style="background: #e2e8f0; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 600;">Fechar</button>
            <button onclick="printOrderNative('${order.id}')" style="background: #1e3a8a; color: #fff; border: none; padding: 10px 22px; border-radius: 6px; font-weight: 700; cursor: pointer;">
                <i class="fas fa-file-pdf"></i> Imprimir / Baixar PDF Oficial com Logo
            </button>
        </div>
    `;

    modal.style.display = 'flex';
};

// Emissão de PDF A4 Nativa de Alta Resolução com Logo
window.printOrderNative = function(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(generateDocumentHTML(order));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 400);
};

function generateDocumentHTML(order) {
    const clientName = order.user?.full_name || 'Cliente';
    const clientEmail = order.user?.email || '-';
    const clientPhone = order.user?.phone || '-';

    const items = order.items && order.items.length > 0 ? order.items : [
        { product_name: 'Material Gráfico / Comunicação Visual', quantity: 1, unit_price: order.subtotal || order.total, item_total: order.total }
    ];

    let itemsRows = '';
    items.forEach((it, idx) => {
        itemsRows += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${idx + 1}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>${it.product_name}</strong></td>
                <td style="padding: 10px; text-align: center; border: 1px solid #e2e8f0;">${it.quantity}</td>
                <td style="padding: 10px; text-align: right; border: 1px solid #e2e8f0;">${Number(it.unit_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td style="padding: 10px; text-align: right; border: 1px solid #e2e8f0;"><strong>${Number(it.item_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></td>
            </tr>
        `;
    });

    let addressStr = 'Retirada na Empresa (Mogi das Cruzes - Grátis)';
    if (order.delivery_type === 'entrega' && order.delivery_address) {
        const a = order.delivery_address;
        addressStr = `Entrega: ${a.rua || ''}, ${a.numero || ''} - ${a.bairro || ''} (${a.cidade || ''})`;
    }

    return `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Pedido_${order.order_code}</title>
            <style>
                @page { size: A4 portrait; margin: 12mm; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #fff; }
                .doc-box { max-width: 800px; margin: 0 auto; }
            </style>
        </head>
        <body>
            <div class="doc-box">
                <!-- Cabeçalho Oficial -->
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #f97316; padding-bottom: 15px; margin-bottom: 25px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <img src="../logo_cabecalho.png" style="height: 55px; max-width: 220px; object-fit: contain;" onerror="this.src='../logo.png'">
                        <div>
                            <h1 style="margin: 0; color: #1e3a8a; font-size: 20px; font-weight: 800;">VIDAL DESIGN SOLUTIONS</h1>
                            <p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">Comunicação Visual, Sinalização, Toldos e Impressão Digital</p>
                            <p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">Mogi das Cruzes - SP | Tel/WhatsApp: (11) 96864-9673</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 13px; font-weight: 800; color: #ea580c; text-transform: uppercase;">ORÇAMENTO / PEDIDO</div>
                        <div style="font-size: 18px; font-weight: 800; color: #0f172a;">${order.order_code}</div>
                        <div style="font-size: 11px; color: #94a3b8;">Data: ${new Date(order.created_at).toLocaleString('pt-BR')}</div>
                    </div>
                </div>

                <!-- Dados do Cliente -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; font-size: 13px;">
                    <div>
                        <strong>CLIENTE:</strong> ${clientName}<br>
                        <strong>E-MAIL:</strong> ${clientEmail}<br>
                        <strong>TELEFONE:</strong> ${clientPhone}<br>
                        <strong>MODALIDADE:</strong> ${order.user_role === 'revenda' ? 'Revenda Autorizada (Margem 50%)' : 'Cliente Final (Margem 100%)'}
                    </div>
                    <div>
                        <strong>RECEBIMENTO:</strong> ${addressStr}<br>
                        <strong>CANAL:</strong> ${order.payment_method ? order.payment_method.toUpperCase() : 'WHATSAPP'}<br>
                        <strong>STATUS:</strong> <span style="font-weight: bold; color: #16a34a;">${order.status.toUpperCase()}</span>
                    </div>
                </div>

                <!-- Tabela de Itens -->
                <h3 style="font-size: 14px; text-transform: uppercase; margin-bottom: 10px; color: #0f172a;">Itens & Especificações Técnicas:</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
                    <thead>
                        <tr style="background: #0f172a; color: #fff;">
                            <th style="padding: 8px; text-align: left; border: 1px solid #0f172a;">#</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #0f172a;">Descrição da Peça</th>
                            <th style="padding: 8px; text-align: center; border: 1px solid #0f172a;">Qtd</th>
                            <th style="padding: 8px; text-align: right; border: 1px solid #0f172a;">Unitário</th>
                            <th style="padding: 8px; text-align: right; border: 1px solid #0f172a;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>

                <!-- Resumo -->
                <div style="display: flex; justify-content: flex-end; margin-bottom: 25px;">
                    <div style="width: 280px; background: #fff7ed; padding: 15px; border-radius: 8px; border-left: 4px solid #f97316; font-size: 13px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span>Subtotal:</span>
                            <strong>${Number(order.subtotal || order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span>Taxa de Arte:</span>
                            <strong>${Number(order.art_fee || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: #c2410c; border-top: 1px solid #fed7aa; padding-top: 6px;">
                            <span>TOTAL DO PEDIDO:</span>
                            <span>${Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    </div>
                </div>

                <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; color: #64748b; text-align: center;">
                    Documento oficial de orçamento emitido pela Vidal Design Solutions.<br>
                    Mogi das Cruzes - SP | (11) 96864-9673 | vidaldesignsolutions@gmail.com
                </div>
            </div>
        </body>
        </html>
    `;
}

window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        await window.supabaseClient.from('v2_orders').update({ status: newStatus }).eq('id', orderId);
        alert(`Status alterado para ${newStatus.toUpperCase()}`);
    } catch (err) { alert('Erro ao atualizar status.'); }
};

// ==============================================================================
// 2. TRIAGEM DE REVENDA E LGPD
// ==============================================================================
async function loadUsersAndResellers() {
    const resellerTbody = document.getElementById('admin-resellers-tbody');
    const usersTbody = document.getElementById('admin-users-tbody');
    try {
        const { data, error } = await window.supabaseClient.from('v2_profiles').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        allUsers = data || [];
        const pendingResellers = allUsers.filter(u => u.requested_role === 'revenda' && u.status === 'pendente');
        renderResellersTable(resellerTbody, pendingResellers);
        renderUsersTable(usersTbody, allUsers);
    } catch (err) { console.error(err); }
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
    if (!tbody) return;
    tbody.innerHTML = '';
    list.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.full_name || 'Sem nome'}</td>
            <td>${u.email}</td>
            <td><span class="role-badge ${u.role}">${u.role.toUpperCase()}</span></td>
            <td><strong>${u.status.toUpperCase()}</strong></td>
            <td>
                ${u.role !== 'master' ? `
                    <button class="btn-action-view" onclick="editUserRole('${u.id}', '${u.role}')" style="padding:4px 8px; font-size:11px;">Mudar Modalidade</button>
                    <button class="btn-action-delete" onclick="deleteUserAccount('${u.id}', '${u.full_name || u.email}')" title="Excluir Usuário">✕</button>
                ` : '<em>Master Oficial</em>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openNewUserModal = function() {
    document.getElementById('modal-new-user').style.display = 'flex';
};

window.deleteUserAccount = async function(userId, userName) {
    if (!confirm(`Deseja realmente EXCLUIR o usuário "${userName}" do sistema?`)) return;
    try {
        const { error } = await window.supabaseClient.from('v2_profiles').delete().eq('id', userId);
        if (error) throw error;
        alert('Usuário excluído!');
        await loadUsersAndResellers();
    } catch (err) { alert('Erro: ' + err.message); }
};

window.editUserRole = async function(userId, currentRole) {
    const targetRole = currentRole === 'revenda' ? 'cliente_final' : 'revenda';
    if (!confirm(`Deseja alterar a modalidade deste usuário para ${targetRole.toUpperCase()}?`)) return;
    await window.supabaseClient.from('v2_profiles').update({ role: targetRole, requested_role: targetRole }).eq('id', userId);
    await loadUsersAndResellers();
};

window.decisionReseller = async function(userId, approved) {
    if (!confirm(`Confirma a decisão? O arquivo comprobatório será excluído permanentemente (LGPD).`)) return;
    try {
        const newRole = approved ? 'revenda' : 'cliente_final';
        await window.supabaseClient.from('v2_profiles').update({
            role: newRole,
            status: 'aprovado',
            requested_role: newRole,
            notes: `Triagem concluída: ${approved ? 'Revenda Aprovada' : 'Cliente Final'}`
        }).eq('id', userId);

        try {
            const { data: files } = await window.supabaseClient.storage.from('reseller-proofs').list('solicitacoes');
            const userFile = files?.find(f => f.name.startsWith(userId));
            if (userFile) await window.supabaseClient.storage.from('reseller-proofs').remove([`solicitacoes/${userFile.name}`]);
        } catch (e) {}

        alert('Decisão gravada e arquivo descartado com sucesso!');
        await loadUsersAndResellers();
    } catch (err) { alert('Erro: ' + err.message); }
};

// ==============================================================================
// 3. CATÁLOGO & EXCLUSÃO DE PRODUTOS
// ==============================================================================
async function loadProductsList() {
    const tbody = document.getElementById('admin-products-tbody');
    if (!tbody) return;
    try {
        const { data, error } = await window.supabaseClient.from('v2_products').select('*').order('name', { ascending: true });
        if (error) throw error;
        allProducts = data || [];
        renderProductsTable(allProducts);
    } catch (err) { console.error(err); }
}

function renderProductsTable(products) {
    const tbody = document.getElementById('admin-products-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    products.forEach(p => {
        const cost = Number(p.base_cost) || 0;
        const revenda = cost * 1.5;
        const cliente = cost * 2.0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.name}</strong></td>
            <td>${p.calculation_type.toUpperCase()}</td>
            <td><strong>${cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></td>
            <td><span style="color:#16a34a; font-weight:700;">${revenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (+50%)</span></td>
            <td><span style="color:#c2410c; font-weight:700;">${cliente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (+100%)</span></td>
            <td>${p.is_active ? '✅ Ativo' : '❌ Inativo'}</td>
            <td>
                <button class="btn-action-view" onclick="editProduct('${p.id}')" style="padding:4px 8px; font-size:11px;">Editar</button>
                <button class="btn-action-delete" onclick="deleteProduct('${p.id}', '${p.name}')" title="Excluir Produto">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteProduct = async function(prodId, prodName) {
    if (!confirm(`Deseja realmente EXCLUIR o produto "${prodName}" do catálogo?`)) return;
    try {
        const { error } = await window.supabaseClient.from('v2_products').delete().eq('id', prodId);
        if (error) throw error;
        alert(`Produto "${prodName}" excluído!`);
        await loadProductsList();
    } catch (err) { alert('Erro ao excluir: ' + err.message); }
};

window.editProduct = function(prodId) {
    const prod = allProducts.find(p => p.id === prodId);
    if (!prod) return;

    document.getElementById('edit-prod-id').value = prod.id;
    document.getElementById('form-product-title').textContent = `Editar Produto: ${prod.name}`;
    document.getElementById('new-prod-name').value = prod.name;
    document.getElementById('new-prod-cost').value = prod.base_cost;
    document.getElementById('new-prod-calctype').value = prod.calculation_type;
    document.getElementById('new-prod-days').value = prod.production_days;
    document.getElementById('new-prod-desc').value = prod.description || '';

    const imgs = Array.isArray(prod.images) ? prod.images : [];
    document.getElementById('new-prod-img1').value = imgs[0] || '';
    document.getElementById('new-prod-img2').value = imgs || '';
    document.getElementById('new-prod-img3').value = imgs || '';
    document.getElementById('new-prod-img4').value = imgs || '';

    const c = Number(prod.base_cost) || 0;
    document.getElementById('preview-revenda').textContent = (c * 1.5).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('preview-cliente').textContent = (c * 2.0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    document.getElementById('btn-cancel-edit').style.display = 'inline-block';
    document.getElementById('btn-submit-prod').textContent = 'Salvar Alterações';
    document.getElementById('form-new-product').scrollIntoView({ behavior: 'smooth' });
};

document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
    document.getElementById('form-new-product').reset();
    document.getElementById('edit-prod-id').value = '';
    document.getElementById('form-product-title').textContent = 'Novo Produto';
    document.getElementById('btn-cancel-edit').style.display = 'none';
    document.getElementById('btn-submit-prod').textContent = 'Salvar Produto no Banco';
    document.getElementById('preview-revenda').textContent = 'R$ 0,00';
    document.getElementById('preview-cliente').textContent = 'R$ 0,00';
});

async function saveProduct(formData) {
    const editId = document.getElementById('edit-prod-id').value;
    const cost = parseFloat(formData.get('base_cost')) || 0;

    const imagesList = [
        formData.get('img_1') || '',
        formData.get('img_2') || '',
        formData.get('img_3') || '',
        formData.get('img_4') || ''
    ].filter(Boolean);

    const attributesConfig = {
        has_sqm_calc: formData.get('var_sqm_calc') === 'on',
        has_min_sqm: formData.get('var_min_sqm') === 'on',
        format_fixed: formData.get('var_format_fixed') === 'on',
        materials: {
            adesivo: formData.get('var_mat_adesivo') === 'on',
            lona: formData.get('var_mat_lona') === 'on',
            papeis: formData.get('var_mat_papeis') === 'on',
            rigidos: formData.get('var_mat_rigidos') === 'on',
            dtf: formData.get('var_mat_dtf') === 'on'
        },
        colors: {
            c_4x0: formData.get('var_cor_4x0') === 'on',
            c_4x4: formData.get('var_cor_4x4') === 'on',
            c_1x0: formData.get('var_cor_1x0') === 'on',
            c_uv: formData.get('var_cor_uv') === 'on'
        },
        finishes: {
            laminacao: formData.get('var_acab_laminacao') === 'on',
            verniz: formData.get('var_acab_verniz') === 'on',
            ilhos: formData.get('var_acab_ilhos') === 'on',
            laser: formData.get('var_acab_laser') === 'on',
            dobra: formData.get('var_acab_dobra') === 'on'
        },
        services: {
            art_creation: formData.get('var_serv_arte') === 'on'
        },
        has_custom_escape: true
    };

    const payload = {
        name: formData.get('name'),
        slug: formData.get('name').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
        description: formData.get('description'),
        base_cost: cost,
        calculation_type: formData.get('calculation_type'),
        production_days: parseInt(formData.get('production_days')) || 2,
        images: imagesList,
        attributes_config: attributesConfig,
        is_active: true,
        updated_at: new Date().toISOString()
    };

    try {
        if (editId) {
            await window.supabaseClient.from('v2_products').update(payload).eq('id', editId);
            alert('Produto atualizado com sucesso!');
        } else {
            await window.supabaseClient.from('v2_products').insert(payload);
            alert('Novo produto cadastrado com sucesso!');
        }
        document.getElementById('btn-cancel-edit').click();
        await loadProductsList();
    } catch (err) { alert('Erro ao salvar: ' + err.message); }
}

// ==============================================================================
// 4. CONFIGURAÇÕES GLOBAIS (COM SALVAMENTO REAL)
// ==============================================================================
async function loadSettings() {
    try {
        const { data } = await window.supabaseClient.from('v2_settings').select('*').eq('id', 'global').single();
        if (data) {
            document.getElementById('cfg-reseller-margin').value = data.reseller_margin * 100;
            document.getElementById('cfg-retail-margin').value = data.retail_margin * 100;
            document.getElementById('cfg-art-fee').value = data.art_fee;
            document.getElementById('cfg-min-area').value = data.min_area_sqm;
            document.getElementById('cfg-whatsapp').value = data.whatsapp_number || '+5511949141803';
        }
    } catch (e) {}
}

async function saveGlobalSettings(e) {
    e.preventDefault();
    const resMargin = (parseFloat(document.getElementById('cfg-reseller-margin').value) || 50) / 100;
    const retMargin = (parseFloat(document.getElementById('cfg-retail-margin').value) || 100) / 100;
    const artFee = parseFloat(document.getElementById('cfg-art-fee').value) || 40;
    const minArea = parseFloat(document.getElementById('cfg-min-area').value) || 0.5;
    const whatsApp = document.getElementById('cfg-whatsapp').value;

    try {
        const { error } = await window.supabaseClient
            .from('v2_settings')
            .update({
                reseller_margin: resMargin,
                retail_margin: retMargin,
                art_fee: artFee,
                min_area_sqm: minArea,
                whatsapp_number: whatsApp,
                updated_at: new Date().toISOString()
            })
            .eq('id', 'global');

        if (error) throw error;
        alert('Regras Globais salvas com sucesso no banco de dados!');
    } catch (err) {
        alert('Erro ao salvar configurações: ' + err.message);
    }
}

function initAdminEventListeners() {
    document.getElementById('admin-order-search')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allOrders.filter(o => o.order_code.toLowerCase().includes(term) || o.user?.full_name?.toLowerCase().includes(term));
        renderOrdersTable(filtered);
    });

    document.getElementById('form-new-product')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveProduct(new FormData(e.target));
    });

    document.getElementById('form-global-settings')?.addEventListener('submit', saveGlobalSettings);

    document.getElementById('form-create-user-manual')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('user-new-name').value;
        const email = document.getElementById('user-new-email').value;
        const phone = document.getElementById('user-new-phone').value;
        const role = document.getElementById('user-new-role').value;
        const status = document.getElementById('user-new-status').value;

        try {
            const { error } = await window.supabaseClient.from('v2_profiles').insert({
                id: crypto.randomUUID(),
                email: email,
                full_name: name,
                phone: phone,
                role: role,
                status: status,
                requested_role: role
            });
            if (error) throw error;
            alert('Usuário cadastrado com sucesso!');
            document.getElementById('modal-new-user').style.display = 'none';
            await loadUsersAndResellers();
        } catch (err) { alert('Erro: ' + err.message); }
    });

    document.getElementById('new-prod-cost')?.addEventListener('input', (e) => {
        const c = parseFloat(e.target.value) || 0;
        document.getElementById('preview-revenda').textContent = (c * 1.5).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('preview-cliente').textContent = (c * 2.0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    });
}
