// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/cart.js
// OBJETIVO: Gerenciamento do Carrinho, ID Único #VDL, Checkout Duplo e PDF
// ==============================================================================

const CART_STORAGE_KEY = 'vidalCart';
let currentCart = [];
let currentUser = null;
let currentProfile = null;
let globalSettings = null;

document.addEventListener('DOMContentLoaded', async () => {
    loadCartFromStorage();
    await checkUserSession();
    await loadGlobalSettings();
    renderCartPageUI();
    initCartEvents();
});

// Carrega itens do localStorage
function loadCartFromStorage() {
    try {
        currentCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    } catch (e) {
        currentCart = [];
    }
    updateCartCount();
}

// Salva alterações no localStorage
function saveCartToStorage() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(currentCart));
    updateCartCount();
    renderCartPageUI();
}

// Atualiza o contador de itens no cabeçalho
function updateCartCount() {
    const counterElements = document.querySelectorAll('#cartCount, #cartItemCount');
    const totalItems = currentCart.reduce((sum, item) => sum + item.quantity, 0);
    counterElements.forEach(el => {
        el.textContent = totalItems;
    });
}

// Adiciona item ao carrinho (chamado pelo products.js)
window.addToCart = function(product) {
    const existingIndex = currentCart.findIndex(item => item.id === product.id);
    if (existingIndex > -1) {
        currentCart[existingIndex].quantity += 1;
    } else {
        currentCart.push({
            ...product,
            quantity: 1,
            addedAt: new Date().toISOString()
        });
    }
    saveCartToStorage();
    alert(`"${product.name.split('|')[0].trim()}" foi adicionado ao seu orçamento!`);
};

// Verifica sessão do usuário logado
async function checkUserSession() {
    if (window.AuthController) {
        currentUser = await window.AuthController.getCurrentUser();
        if (currentUser) {
            currentProfile = await window.AuthController.getUserProfile(currentUser.id);
        }
    }
}

// Busca configurações globais do Supabase (WhatsApp, etc.)
async function loadGlobalSettings() {
    if (!window.supabaseClient) return;
    try {
        const { data } = await window.supabaseClient
            .from('v2_settings')
            .select('*')
            .eq('id', 'global')
            .single();
        globalSettings = data;
    } catch (e) {
        console.warn('Configurações globais não carregadas, usando padrão.');
    }
}

// Renderiza a lista de produtos na página do carrinho
function renderCartPageUI() {
    const container = document.getElementById('cart-items-container');
    const emptyNotice = document.getElementById('cart-empty-notice');
    const contentWrapper = document.getElementById('cart-content-wrapper');

    if (!container) return;

    if (!currentCart.length) {
        if (emptyNotice) emptyNotice.style.display = 'block';
        if (contentWrapper) contentWrapper.style.display = 'none';
        return;
    }

    if (emptyNotice) emptyNotice.style.display = 'none';
    if (contentWrapper) contentWrapper.style.display = 'grid';

    container.innerHTML = '';
    let subtotal = 0;
    let totalArt = 0;

    currentCart.forEach((item, index) => {
        const unitPrice = Number(item.basePrice) || 0;
        const itemTotal = unitPrice * item.quantity;
        subtotal += itemTotal;

        if (item.hasArt || (item.name && item.name.includes('Contratar criação'))) {
            totalArt += 40;
        }

        const imgPath = item.image && !item.image.includes('placeholder') ? `../${item.image}` : '../logo.png';

        const itemRow = document.createElement('div');
        itemRow.className = 'cart-item-row';
        itemRow.innerHTML = `
            <img src="${imgPath}" class="cart-item-img" alt="${item.name}" onerror="this.src='../logo.png'">
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-specs-badge">
                    <i class="fas fa-tag"></i> ${item.category ? item.category.toUpperCase() : 'PERSONALIZADO'}
                </div>
                <div class="cart-item-price-unit">
                    Valor unitário: <strong>${unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
            </div>
            <div class="cart-qty-wrapper">
                <button class="btn-qty-action" onclick="changeQty(${index}, -1)">-</button>
                <span class="qty-display-value">${item.quantity}</span>
                <button class="btn-qty-action" onclick="changeQty(${index}, 1)">+</button>
            </div>
            <div class="cart-item-subtotal">
                ${itemTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <button class="btn-remove-cart" onclick="removeCartItem(${index})" title="Remover">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        container.appendChild(itemRow);
    });

    const totalFinal = subtotal + totalArt;
    document.getElementById('summary-subtotal').textContent = subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('summary-art-fee').textContent = totalArt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('summary-total').textContent = totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

window.changeQty = function(index, delta) {
    if (!currentCart[index]) return;
    currentCart[index].quantity += delta;
    if (currentCart[index].quantity <= 0) {
        currentCart.splice(index, 1);
    }
    saveCartToStorage();
};

window.removeCartItem = function(index) {
    if (confirm('Deseja remover esta peça do seu pedido?')) {
        currentCart.splice(index, 1);
        saveCartToStorage();
    }
};

function initCartEvents() {
    // Alternar formulário de entrega
    document.querySelectorAll('input[name="delivery_option"]').forEach(r => {
        r.addEventListener('change', (e) => {
            const form = document.getElementById('delivery-address-form');
            if (form) form.style.display = e.target.value === 'entrega' ? 'block' : 'none';
        });
    });

    // Checkout Mercado Pago
    document.getElementById('btn-checkout-mercadopago')?.addEventListener('click', () => {
        processOrderSubmission('mercado_pago');
    });

    // Checkout WhatsApp
    document.getElementById('btn-checkout-whatsapp')?.addEventListener('click', () => {
        processOrderSubmission('whatsapp');
    });
}

// Grava o Pedido no Supabase e Emite o PDF
async function processOrderSubmission(paymentMethod) {
    if (!currentCart.length) {
        alert('Seu carrinho está vazio.');
        return;
    }

    // Trava de Identificação
    if (!currentUser || !currentProfile) {
        alert('Por favor, faça login com o Google para vincular e emitir seu pedido oficial.');
        window.AuthController?.loginWithGoogle();
        return;
    }

    const deliveryType = document.querySelector('input[name="delivery_option"]:checked')?.value || 'retirada';
    let addressData = {};

    if (deliveryType === 'entrega') {
        const rua = document.getElementById('addr-street')?.value;
        const num = document.getElementById('addr-number')?.value;
        const bairro = document.getElementById('addr-neighborhood')?.value;
        const cidade = document.getElementById('addr-city')?.value;

        if (!rua || !num || !cidade) {
            alert('Por favor, preencha o endereço completo de entrega.');
            return;
        }
        addressData = { rua, numero: num, bairro, cidade };
    }

    let subtotal = 0;
    let artFee = 0;
    currentCart.forEach(it => {
        subtotal += (it.basePrice * it.quantity);
        if (it.hasArt || (it.name && it.name.includes('Contratar criação'))) artFee += 40;
    });
    const total = subtotal + artFee;

    try {
        // 1. Grava o pedido com o ID Único gerado pelo Supabase
        const { data: orderData, error: orderErr } = await window.supabaseClient
            .from('v2_orders')
            .insert({
                user_id: currentUser.id,
                user_role: currentProfile.role || 'cliente_final',
                status: 'recebido',
                delivery_type: deliveryType,
                delivery_address: addressData,
                payment_method: paymentMethod,
                subtotal: subtotal,
                art_fee: artFee,
                total: total
            })
            .select()
            .single();

        if (orderErr) throw orderErr;

        // 2. Grava os itens na v2_order_items
        const itemsPayload = currentCart.map(it => ({
            order_id: orderData.id,
            product_name: it.name,
            unit_price: it.basePrice,
            quantity: it.quantity,
            item_total: it.basePrice * it.quantity
        }));

        await window.supabaseClient.from('v2_order_items').insert(itemsPayload);

        // Limpa o carrinho
        const savedItems = [...currentCart];
        localStorage.removeItem(CART_STORAGE_KEY);
        currentCart = [];
        updateCartCount();

        // 3. Executa a Ação
        if (paymentMethod === 'whatsapp') {
            sendWhatsAppWithOrder(orderData, savedItems);
        } else {
            showOrderFinishedModal(orderData, savedItems, 'Mercado Pago');
        }

    } catch (err) {
        console.error('Erro ao finalizar pedido:', err);
        alert('Erro ao registrar pedido: ' + err.message);
    }
}

// Disparo para o WhatsApp com ID Único e dados para IA
function sendWhatsAppWithOrder(order, items) {
    const phone = globalSettings?.whatsapp_number || '5511968649673';
    const clientName = currentProfile?.full_name || 'Cliente';

    let msg = `*PEDIDO OFICIAL — VIDAL DESIGN SOLUTIONS*\n`;
    msg += `----------------------------------------\n`;
    msg += `*ID do Pedido:* ${order.order_code}\n`;
    msg += `*Cliente:* ${clientName}\n`;
    msg += `*Modalidade:* ${order.user_role === 'revenda' ? 'Revenda' : 'Cliente Final'}\n`;
    msg += `*Recebimento:* ${order.delivery_type.toUpperCase()}\n`;
    msg += `----------------------------------------\n`;
    msg += `*ITENS DO ORÇAMENTO:*\n`;

    items.forEach((it, i) => {
        msg += `\n${i+1}. *${it.name}*\n`;
        msg += `   - Qtd: ${it.quantity} un.\n`;
        msg += `   - Subtotal: ${(it.basePrice * it.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    });

    msg += `\n----------------------------------------\n`;
    msg += `*VALOR TOTAL:* ${Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    msg += `\nOlá! Acabei de gerar o pedido sob o ID *${order.order_code}* no site e gostaria de confirmar a produção!`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    showOrderFinishedModal(order, items, 'WhatsApp');
}

// Modal de Conclusão com Download de PDF
function showOrderFinishedModal(order, items, canal) {
    let modal = document.getElementById('modal-order-done');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-order-done';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:9999;';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div style="background:#fff; padding:35px; border-radius:16px; max-width:550px; width:90%; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.3);">
            <i class="fas fa-check-circle" style="font-size: 55px; color: #16a34a; margin-bottom: 15px;"></i>
            <h2 style="font-family:Montserrat, sans-serif; font-size: 24px; color: #1e293b; margin-bottom: 8px;">Pedido Registrado com Sucesso!</h2>
            <div style="background: #f1f5f9; padding: 10px 20px; border-radius: 8px; font-weight: 800; font-size: 20px; color: #ea580c; display: inline-block; margin: 10px 0 20px;">
                ${order.order_code}
            </div>
            <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 25px;">
                Seu pedido foi registrado no sistema através do canal <strong>${canal}</strong> e vinculado à sua conta oficial.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                <button id="btn-dl-pdf" style="background:#1e3a8a; color:#fff; border:none; padding:12px 24px; border-radius:8px; font-weight:700; cursor:pointer; font-size:14px;">
                    <i class="fas fa-file-pdf"></i> Baixar Orçamento Oficial em PDF
                </button>
                <a href="../index.html" style="background:#f1f5f9; color:#475569; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px;">
                    Voltar ao Início
                </a>
            </div>
        </div>
    `;

    document.getElementById('btn-dl-pdf').addEventListener('click', () => {
        downloadOrderPDF(order, items);
    });
}

// Emissão de PDF Oficial com Identidade Visual Vidal Design Solutions
function downloadOrderPDF(order, items) {
    const clientName = currentProfile?.full_name || 'Cliente';
    const clientEmail = currentProfile?.email || '';

    const element = document.createElement('div');
    element.style.padding = '30px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.color = '#1e293b';

    let itemsRows = '';
    items.forEach((it, idx) => {
        itemsRows += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px;">${idx + 1}</td>
                <td style="padding: 10px;"><strong>${it.name}</strong></td>
                <td style="padding: 10px; text-align: center;">${it.quantity}</td>
                <td style="padding: 10px; text-align: right;">${Number(it.basePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td style="padding: 10px; text-align: right;"><strong>${(it.basePrice * it.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></td>
            </tr>
        `;
    });

    element.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #f97316; padding-bottom: 15px; margin-bottom: 25px;">
            <div>
                <h1 style="margin: 0; color: #1e3a8a; font-size: 22px;">VIDAL DESIGN SOLUTIONS</h1>
                <p style="margin: 3px 0 0 0; color: #64748b; font-size: 12px;">Comunicação Visual, Sinalização, Toldos e Impressão Digital</p>
                <p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">Mogi das Cruzes - SP | (11) 96864-9673</p>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 14px; font-weight: bold; color: #ea580c;">ORÇAMENTO / PEDIDO</div>
                <div style="font-size: 18px; font-weight: bold; color: #0f172a;">${order.order_code}</div>
                <div style="font-size: 11px; color: #94a3b8;">${new Date().toLocaleString('pt-BR')}</div>
            </div>
        </div>

        <div style="background: #f8fafc; border-radius: 8px; padding: 15px; margin-bottom: 20px; font-size: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
                <strong>Cliente:</strong> ${clientName}<br>
                <strong>E-mail:</strong> ${clientEmail}<br>
                <strong>Modalidade:</strong> ${order.user_role === 'revenda' ? 'Revenda Autorizada (Margem 50%)' : 'Cliente Final (Margem 100%)'}
            </div>
            <div>
                <strong>Recebimento:</strong> ${order.delivery_type.toUpperCase()}<br>
                <strong>Canal:</strong> ${order.payment_method.toUpperCase()}<br>
                <strong>Status Inicial:</strong> ${order.status.toUpperCase()}
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 25px;">
            <thead>
                <tr style="background: #1e3a8a; color: #fff;">
                    <th style="padding: 8px; text-align: left;">#</th>
                    <th style="padding: 8px; text-align: left;">Item & Especificações</th>
                    <th style="padding: 8px; text-align: center;">Qtd</th>
                    <th style="padding: 8px; text-align: right;">Unitário</th>
                    <th style="padding: 8px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRows}
            </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end;">
            <div style="width: 260px; background: #fff7ed; padding: 15px; border-radius: 8px; border-left: 4px solid #f97316; font-size: 13px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span>Subtotal:</span>
                    <strong>${Number(order.subtotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span>Taxa de Arte:</span>
                    <strong>${Number(order.art_fee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: #c2410c; border-top: 1px solid #fed7aa; padding-top: 6px;">
                    <span>VALOR TOTAL:</span>
                    <span>${Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
            </div>
        </div>

        <div style="margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #94a3b8; text-align: center;">
            Documento emitido automaticamente pelo Portal V2 da Vidal Design Solutions.
        </div>
    `;

    const opt = {
        margin: 10,
        filename: `Pedido_${order.order_code.replace('#', '')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    window.html2pdf().set(opt).from(element).save();
}
