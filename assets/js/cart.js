// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/cart.js
// OBJETIVO: Gerenciamento do Carrinho, Gravação no Supabase, Checkout Duplo e PDF
// ==============================================================================

const CART_STORAGE_KEY = 'vdl_cart_v2';
let currentCart = [];
let currentUser = null;
let currentProfile = null;
let globalSettings = null;

document.addEventListener('DOMContentLoaded', async () => {
    loadCartFromStorage();
    await checkUserSession();
    await loadGlobalSettings();
    renderCartTable();
    initCartEvents();
});

// Carrega itens do localStorage
function loadCartFromStorage() {
    try {
        currentCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    } catch (e) {
        currentCart = [];
    }
    updateCartCounter();
}

// Salva carrinho no localStorage
function saveCartToStorage() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(currentCart));
    updateCartCounter();
    renderCartTable();
}

// Atualiza o contador de itens no cabeçalho
function updateCartCounter() {
    const counterEl = document.getElementById('cart-counter');
    if (counterEl) {
        const totalItems = currentCart.reduce((sum, item) => sum + item.quantity, 0);
        counterEl.textContent = totalItems;
    }
}

// Carrega sessão do usuário
async function checkUserSession() {
    if (window.AuthController) {
        currentUser = await window.AuthController.getCurrentUser();
        if (currentUser) {
            currentProfile = await window.AuthController.getUserProfile(currentUser.id);
        }
    }
}

// Carrega configurações globais (telefone WhatsApp, etc.)
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
        console.warn('Configurações globais não carregadas, usando padrões.');
    }
}

// Renderiza a lista de produtos no carrinho
function renderCartTable() {
    const tbody = document.getElementById('cart-items-tbody');
    const emptyNotice = document.getElementById('cart-empty-notice');
    const cartContent = document.getElementById('cart-content-wrapper');

    if (!tbody) return;

    if (!currentCart.length) {
        if (emptyNotice) emptyNotice.style.display = 'block';
        if (cartContent) cartContent.style.display = 'none';
        return;
    }

    if (emptyNotice) emptyNotice.style.display = 'none';
    if (cartContent) cartContent.style.display = 'grid';

    tbody.innerHTML = '';
    let subtotal = 0;
    let totalArtFees = 0;

    currentCart.forEach((item, index) => {
        // Cálculo do item
        let unitPrice = Number(item.unitPrice) || 0;
        let areaInfo = '';

        if (item.width && item.height) {
            const w = parseFloat(item.width) / 100;
            const h = parseFloat(item.height) / 100;
            let area = w * h;
            if (area < 0.5) area = 0.5; // Trava mínima de 0,5 m²
            unitPrice = unitPrice * area;
            areaInfo = `<br><small class="text-muted">📐 ${item.width}cm × ${item.height}cm (${area.toFixed(2)} m²)</small>`;
        }

        const itemSubtotal = unitPrice * item.quantity;
        subtotal += itemSubtotal;
        totalArtFees += (item.artFee || 0);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="cart-product-cell">
                <img src="${item.image || '../logo.png'}" class="cart-item-thumb" alt="${item.name}">
                <div>
                    <strong>${item.name}</strong>
                    ${areaInfo}
                    <div class="cart-item-specs">
                        <small>Material: ${item.material || 'Padrão'}</small><br>
                        <small>Acabamento: ${item.acabamento || 'Padrão'}</small>
                        ${item.hasArt ? '<br><small class="art-tag">🎨 Arte Profissional (+ R$ 40,00)</small>' : ''}
                    </div>
                </div>
            </td>
            <td>${unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td>
                <div class="quantity-controls">
                    <button class="btn-qty" onclick="changeQuantity(${index}, -1)">-</button>
                    <span class="qty-value">${item.quantity}</span>
                    <button class="btn-qty" onclick="changeQuantity(${index}, 1)">+</button>
                </div>
            </td>
            <td><strong>${itemSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></td>
            <td>
                <button class="btn-remove-item" onclick="removeItem(${index})" title="Remover item">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Atualiza Totais
    const totalGeral = subtotal + totalArtFees;
    document.getElementById('summary-subtotal').textContent = subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('summary-art-fee').textContent = totalArtFees.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('summary-total').textContent = totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Alteração de Quantidade
window.changeQuantity = function(index, delta) {
    if (!currentCart[index]) return;
    currentCart[index].quantity += delta;
    if (currentCart[index].quantity <= 0) {
        currentCart.splice(index, 1);
    }
    saveCartToStorage();
};

// Remoção de Item
window.removeItem = function(index) {
    if (confirm('Deseja remover este item do carrinho?')) {
        currentCart.splice(index, 1);
        saveCartToStorage();
    }
};

// Configuração de Eventos
function initCartEvents() {
    // Alternância de Retirada / Entrega
    const radios = document.querySelectorAll('input[name="delivery_option"]');
    radios.forEach(r => {
        r.addEventListener('change', (e) => {
            const addressBox = document.getElementById('delivery-address-form');
            if (addressBox) {
                addressBox.style.display = e.target.value === 'entrega' ? 'block' : 'none';
            }
        });
    });

    // Botão de Checkout com Mercado Pago
    document.getElementById('btn-checkout-mercadopago')?.addEventListener('click', () => {
        finalizeOrder('mercado_pago');
    });

    // Botão de Checkout com WhatsApp
    document.getElementById('btn-checkout-whatsapp')?.addEventListener('click', () => {
        finalizeOrder('whatsapp');
    });
}

// Gravação do Pedido no Supabase e Geração do ID Único
async function finalizeOrder(paymentMethod) {
    if (!currentCart.length) {
        alert('Seu carrinho está vazio.');
        return;
    }

    // Trava de identificação obrigatória
    if (!currentUser || !currentProfile) {
        alert('Você precisa estar logado com sua conta Google para concluir o pedido.');
        window.AuthController?.loginWithGoogle();
        return;
    }

    if (currentProfile.status !== 'aprovado' && currentProfile.role !== 'master') {
        alert('Seu cadastro está em fase de triagem. A finalização de pedidos estará disponível assim que sua conta for aprovada.');
        return;
    }

    // Opção de Entrega
    const deliveryType = document.querySelector('input[name="delivery_option"]:checked')?.value || 'retirada';
    let deliveryAddress = {};

    if (deliveryType === 'entrega') {
        const rua = document.getElementById('addr-street')?.value;
        const num = document.getElementById('addr-number')?.value;
        const bairro = document.getElementById('addr-neighborhood')?.value;
        const cidade = document.getElementById('addr-city')?.value;

        if (!rua || !num || !cidade) {
            alert('Por favor, preencha o endereço de entrega completo.');
            return;
        }
        deliveryAddress = { rua, numero: num, bairro, cidade };
    }

    // Cálculos finais
    let subtotal = 0;
    let totalArt = 0;
    currentCart.forEach(item => {
        let uPrice = Number(item.unitPrice) || 0;
        if (item.width && item.height) {
            const area = Math.max(0.5, (parseFloat(item.width)/100) * (parseFloat(item.height)/100));
            uPrice = uPrice * area;
        }
        subtotal += (uPrice * item.quantity);
        totalArt += (item.artFee || 0);
    });
    const total = subtotal + totalArt;

    try {
        // 1. Inserir na tabela v2_orders (o ID único é gerado automaticamente pelo banco)
        const { data: orderData, error: orderError } = await window.supabaseClient
            .from('v2_orders')
            .insert({
                user_id: currentUser.id,
                user_role: currentProfile.role,
                status: 'recebido',
                delivery_type: deliveryType,
                delivery_address: deliveryAddress,
                payment_method: paymentMethod,
                subtotal: subtotal,
                art_fee: totalArt,
                total: total
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // 2. Inserir itens na v2_order_items
        const orderItemsPayload = currentCart.map(item => {
            let uPrice = Number(item.unitPrice) || 0;
            if (item.width && item.height) {
                const area = Math.max(0.5, (parseFloat(item.width)/100) * (parseFloat(item.height)/100));
                uPrice = uPrice * area;
            }
            return {
                order_id: orderData.id,
                product_name: item.name,
                unit_price: uPrice,
                quantity: item.quantity,
                width: item.width ? parseFloat(item.width) : null,
                height: item.height ? parseFloat(item.height) : null,
                selected_attributes: {
                    material: item.material,
                    acabamento: item.acabamento,
                    hasArt: item.hasArt,
                    artFee: item.artFee
                },
                item_total: (uPrice * item.quantity) + (item.artFee || 0)
            };
        });

        const { error: itemsError } = await window.supabaseClient
            .from('v2_order_items')
            .insert(orderItemsPayload);

        if (itemsError) throw itemsError;

        // Limpa o carrinho
        localStorage.removeItem(CART_STORAGE_KEY);
        currentCart = [];
        updateCartCounter();

        // 3. Executar Ação Conforme o Método de Checkout
        if (paymentMethod === 'whatsapp') {
            sendWhatsAppOrder(orderData, orderItemsPayload);
        } else {
            showOrderSuccessModal(orderData, orderItemsPayload, 'Mercado Pago');
        }

    } catch (err) {
        console.error('Erro ao registrar pedido:', err.message);
        alert('Não foi possível registrar o pedido. Tente novamente ou nos contate via WhatsApp.');
    }
}

// Formatação e Envio para WhatsApp (Preservando a compatibilidade com o agente de IA)
function sendWhatsAppOrder(order, items) {
    const phone = globalSettings?.whatsapp_number || '5511999999999';
    const clientName = currentProfile?.full_name || 'Cliente';

    let msg = `*NOVO PEDIDO REGISTRADO — VIDAL DESIGN SOLUTIONS*\n`;
    msg += `----------------------------------------\n`;
    msg += `*ID do Pedido:* ${order.order_code}\n`;
    msg += `*Cliente:* ${clientName}\n`;
    msg += `*Modalidade:* ${order.user_role === 'revenda' ? 'Revendedor' : 'Cliente Final'}\n`;
    msg += `*Recebimento:* ${order.delivery_type.toUpperCase()}\n`;
    msg += `----------------------------------------\n`;
    msg += `*ITENS DO PEDIDO:*\n`;

    items.forEach((it, i) => {
        msg += `\n${i+1}. *${it.product_name}* (x${it.quantity})\n`;
        if (it.width && it.height) {
            msg += `   - Medida: ${it.width}cm x ${it.height}cm\n`;
        }
        msg += `   - Material: ${it.selected_attributes.material}\n`;
        msg += `   - Acabamento: ${it.selected_attributes.acabamento}\n`;
        if (it.selected_attributes.hasArt) {
            msg += `   - Arte: Criação inclusa (+ R$ 40,00)\n`;
        }
        msg += `   - Total do item: ${Number(it.item_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    });

    msg += `----------------------------------------\n`;
    msg += `*VALOR TOTAL:* ${Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    msg += `\nOlá, acabei de gerar meu pedido no site sob o ID *${order.order_code}* e gostaria de prosseguir com o atendimento!`;

    const encodedUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(encodedUrl, '_blank');

    showOrderSuccessModal(order, items, 'WhatsApp');
}

// Modal de Confirmação com Geração de PDF Oficial
function showOrderSuccessModal(order, items, canal) {
    let modal = document.getElementById('modal-order-success');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-order-success';
        modal.className = 'custom-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 48px;">🎉</span>
                <h2 style="color: #2e7d32; margin: 8px 0;">Pedido Registrado com Sucesso!</h2>
                <div style="background: #eee; padding: 8px 16px; border-radius: 4px; display: inline-block; font-size: 18px; font-weight: bold; color: #333;">
                    ${order.order_code}
                </div>
            </div>

            <p>Seu pedido foi registrado na plataforma e vinculado à sua conta através do canal <strong>${canal}</strong>.</p>
            <p>Você pode baixar agora o comprovante / orçamento oficial em PDF com todas as especificações técnicas e financeiras.</p>

            <div style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
                <button id="btn-download-pdf" class="btn-primary" style="background: #1976d2;">📄 Baixar Documento PDF</button>
                <a href="../index.html" class="btn-secondary" style="display: inline-block; text-decoration: none; text-align: center;">Voltar ao Catálogo</a>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    document.getElementById('btn-download-pdf').addEventListener('click', () => {
        generateOrderPDF(order, items);
    });
}

// Função de Geração de PDF Oficial da Operação
function generateOrderPDF(order, items) {
    const clientName = currentProfile?.full_name || 'Cliente';
    const clientEmail = currentProfile?.email || '';

    // Elemento HTML temporário para renderizar o PDF
    const printArea = document.createElement('div');
    printArea.style.padding = '30px';
    printArea.style.fontFamily = 'Arial, sans-serif';
    printArea.style.color = '#333';

    let itemsRowsHTML = '';
    items.forEach((it, idx) => {
        let specs = `Material: ${it.selected_attributes.material} | Acabamento: ${it.selected_attributes.acabamento}`;
        if (it.width && it.height) specs += ` | Dimensões: ${it.width}cm × ${it.height}cm`;
        if (it.selected_attributes.hasArt) specs += ` | Com Arte (+ R$ 40,00)`;

        itemsRowsHTML += `
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 10px;">${idx + 1}</td>
                <td style="padding: 10px;">
                    <strong>${it.product_name}</strong><br>
                    <small style="color: #666;">${specs}</small>
                </td>
                <td style="padding: 10px; text-align: center;">${it.quantity}</td>
                <td style="padding: 10px; text-align: right;">${Number(it.unit_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td style="padding: 10px; text-align: right;"><strong>${Number(it.item_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></td>
            </tr>
        `;
    });

    printArea.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #ff9800; padding-bottom: 15px; margin-bottom: 20px;">
            <div>
                <h1 style="margin: 0; color: #1a1a1a; font-size: 22px;">VIDAL DESIGN SOLUTIONS</h1>
                <p style="margin: 4px 0 0 0; color: #777; font-size: 13px;">Comunicação Visual, Sinalização e Impressão Digital</p>
                <p style="margin: 2px 0 0 0; color: #777; font-size: 12px;">Mogi das Cruzes - SP | Tel / WhatsApp: (11) 99999-9999</p>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 16px; font-weight: bold; color: #d84315;">PEDIDO / ORÇAMENTO</div>
                <div style="font-size: 18px; font-weight: bold; color: #1a1a1a;">${order.order_code}</div>
                <div style="font-size: 12px; color: #666;">Data: ${new Date(order.created_at || Date.now()).toLocaleString('pt-BR')}</div>
            </div>
        </div>

        <div style="background: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
                <strong>Cliente:</strong> ${clientName}<br>
                <strong>E-mail:</strong> ${clientEmail}<br>
                <strong>Modalidade Comercial:</strong> ${order.user_role === 'revenda' ? 'Revenda Autorizada' : 'Cliente Final'}
            </div>
            <div>
                <strong>Forma de Recebimento:</strong> ${order.delivery_type.toUpperCase()}<br>
                <strong>Forma de Pagamento / Canal:</strong> ${order.payment_method.toUpperCase()}<br>
                <strong>Status Atual:</strong> ${order.status.toUpperCase()}
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
            <thead>
                <tr style="background: #1a1a1a; color: #fff;">
                    <th style="padding: 8px; text-align: left;">#</th>
                    <th style="padding: 8px; text-align: left;">Descrição do Produto & Especificações</th>
                    <th style="padding: 8px; text-align: center;">Qtd</th>
                    <th style="padding: 8px; text-align: right;">Unitário</th>
                    <th style="padding: 8px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRowsHTML}
            </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-top: 15px;">
            <div style="width: 280px; font-size: 14px; background: #fdf7e7; padding: 15px; border-radius: 6px; border-left: 4px solid #ff9800;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span>Subtotal:</span>
                    <strong>${Number(order.subtotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span>Taxa de Arte:</span>
                    <strong>${Number(order.art_fee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: #d84315; border-top: 1px solid #ccc; padding-top: 6px;">
                    <span>VALOR TOTAL:</span>
                    <span>${Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
            </div>
        </div>

        <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; font-size: 11px; color: #888; text-align: center;">
            Documento gerado automaticamente pelo portal oficial Vidal Design Solutions V2. Válido como comprovante de pedido e orçamento de produção.
        </div>
    `;

    // Opções de conversão para PDF
    const opt = {
        margin: 10,
        filename: `Pedido_${order.order_code.replace('#', '')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (window.html2pdf) {
        window.html2pdf().set(opt).from(printArea).save();
    } else {
        alert('A biblioteca de geração de PDF está sendo carregada. Tente novamente em alguns segundos.');
    }
}
