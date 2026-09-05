// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/cart.js
// OBJETIVO: Carrinho com Anexo de Arte, Geração de PDF Fiel e Checkout Duplo
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

function loadCartFromStorage() {
    try {
        currentCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    } catch (e) {
        currentCart = [];
    }
    updateCartCount();
}

function saveCartToStorage() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(currentCart));
    updateCartCount();
    renderCartPageUI();
}

function updateCartCount() {
    const counterElements = document.querySelectorAll('#cartCount, #cartItemCount');
    const totalItems = currentCart.reduce((sum, item) => sum + item.quantity, 0);
    counterElements.forEach(el => {
        el.textContent = totalItems;
    });
}

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

async function checkUserSession() {
    if (window.AuthController) {
        currentUser = await window.AuthController.getCurrentUser();
        if (currentUser) {
            currentProfile = await window.AuthController.getUserProfile(currentUser.id);
        }
    }
}

async function loadGlobalSettings() {
    if (!window.supabaseClient) return;
    try {
        const { data } = await window.supabaseClient
            .from('v2_settings')
            .select('*')
            .eq('id', 'global')
            .single();
        globalSettings = data;
    } catch (e) {}
}

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
    if (currentCart[index].quantity <= 0) currentCart.splice(index, 1);
    saveCartToStorage();
};

window.removeCartItem = function(index) {
    if (confirm('Deseja remover este item do seu pedido?')) {
        currentCart.splice(index, 1);
        saveCartToStorage();
    }
};

function initCartEvents() {
    document.querySelectorAll('input[name="delivery_option"]').forEach(r => {
        r.addEventListener('change', (e) => {
            const form = document.getElementById('delivery-address-form');
            if (form) form.style.display = e.target.value === 'entrega' ? 'block' : 'none';
        });
    });

    document.getElementById('btn-checkout-mercadopago')?.addEventListener('click', () => {
        processOrderSubmission('mercado_pago');
    });

    document.getElementById('btn-checkout-whatsapp')?.addEventListener('click', () => {
        processOrderSubmission('whatsapp');
    });
}

// Grava o pedido com anexo de arte e todos os itens
async function processOrderSubmission(paymentMethod) {
    if (!currentCart.length) {
        alert('Seu carrinho está vazio.');
        return;
    }

    if (!currentUser || !currentProfile) {
        alert('Faça login com o Google para vincular e emitir seu orçamento oficial.');
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

    // Upload do arquivo de arte se fornecido
    const artworkFileInput = document.getElementById('order-artwork-file');
    const sendViaWpp = document.getElementById('send-artwork-via-wpp')?.checked;
    let artworkFileName = null;

    if (artworkFileInput && artworkFileInput.files.length > 0) {
        try {
            const artFile = artworkFileInput.files[0];
            artworkFileName = `arte_${currentUser.id}_${Date.now()}.${artFile.name.split('.').pop()}`;
            await window.supabaseClient.storage.from('order-documents').upload(`artes/${artworkFileName}`, artFile);
        } catch (uploadErr) {
            console.warn('Upload de arte pelo site falhou, cliente enviará pelo WhatsApp:', uploadErr);
        }
    }

    let subtotal = 0;
    let artFee = 0;
    currentCart.forEach(it => {
        subtotal += (it.basePrice * it.quantity);
        if (it.hasArt || (it.name && it.name.includes('Contratar criação'))) artFee += 40;
    });
    const total = subtotal + artFee;

    let notesText = artworkFileName ? `Arquivo de Arte Anexado: ${artworkFileName}` : (sendViaWpp ? 'Arte será enviada via WhatsApp' : 'Sem anexo inicial');

    try {
        // 1. Inserir Pedido Principal
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
                total: total,
                pdf_url: artworkFileName ? `https://ibaavtapoqbvcbbqynxs.supabase.co/storage/v1/object/public/order-documents/artes/${artworkFileName}` : null,
                notes: notesText
            })
            .select()
            .single();

        if (orderErr) throw orderErr;

        // 2. Inserir Itens na tabela v2_order_items
        const itemsPayload = currentCart.map(it => ({
            order_id: orderData.id,
            product_name: it.name,
            unit_price: it.basePrice,
            quantity: it.quantity,
            item_total: it.basePrice * it.quantity
        }));

        await window.supabaseClient.from('v2_order_items').insert(itemsPayload);

        const savedItems = [...currentCart];
        localStorage.removeItem(CART_STORAGE_KEY);
        currentCart = [];
        updateCartCount();

        if (paymentMethod === 'whatsapp') {
            sendWhatsAppWithOrder(orderData, savedItems, notesText);
        } else {
            showOrderFinishedModal(orderData, savedItems, 'Mercado Pago');
        }

    } catch (err) {
        console.error('Erro ao finalizar pedido:', err);
        alert('Erro ao registrar pedido: ' + err.message);
    }
}

function sendWhatsAppWithOrder(order, items, notes) {
    const phone = globalSettings?.whatsapp_number || '5511968649673';
    const clientName = currentProfile?.full_name || 'Cliente';

    let msg = `*PEDIDO OFICIAL — VIDAL DESIGN SOLUTIONS*\n`;
    msg += `----------------------------------------\n`;
    msg += `*ID do Pedido:* ${order.order_code}\n`;
    msg += `*Cliente:* ${clientName}\n`;
    msg += `*Modalidade:* ${order.user_role === 'revenda' ? 'Revenda' : 'Cliente Final'}\n`;
    msg += `*Recebimento:* ${order.delivery_type.toUpperCase()}\n`;
    msg += `*Arte:* ${notes}\n`;
    msg += `----------------------------------------\n`;
    msg += `*ITENS DO PEDIDO:*\n`;

    items.forEach((it, i) => {
        msg += `\n${i+1}. *${it.name}*\n`;
        msg += `   - Qtd: ${it.quantity} un.\n`;
        msg += `   - Subtotal: ${(it.basePrice * it.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    });

    msg += `\n----------------------------------------\n`;
    msg += `*VALOR TOTAL:* ${Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    msg += `\nOlá! Acabei de gerar o pedido sob o ID *${order.order_code}* pelo site e gostaria de confirmar a produção e envio dos arquivos!`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    showOrderFinishedModal(order, items, 'WhatsApp');
}

function showOrderFinishedModal(order, items, canal) {
    let modal = document.getElementById('modal-order-done');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-order-done';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.85); display:flex; align-items:center; justify-content:center; z-index:9999;';
        document.body.appendChild(modal);
    }

    const isMP = canal === 'Mercado Pago';
    modal.innerHTML = `
        <div style="background:#fff; padding:35px; border-radius:16px; max-width:580px; width:90%; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.3);">
            <i class="fas fa-check-circle" style="font-size: 50px; color: #16a34a; margin-bottom: 12px;"></i>
            <h2 style="font-family:Montserrat, sans-serif; font-size: 22px; color: #0f172a; margin-bottom: 8px;">Pedido Registrado com Sucesso!</h2>
            <div style="background: #f1f5f9; padding: 10px 20px; border-radius: 8px; font-weight: 800; font-size: 20px; color: #ea580c; display: inline-block; margin: 10px 0 15px;">
                ${order.order_code}
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
                ${isMP 
                    ? 'Seu pedido foi registrado no sistema! Baixe o seu orçamento oficial com todas as peças e confirme a liberação via WhatsApp.' 
                    : 'Seu pedido foi registrado e encaminhado para atendimento no WhatsApp.'}
            </p>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button onclick="downloadNativeCartPDF('${order.id}')" style="background:#1e3a8a; color:#fff; border:none; padding:12px 20px; border-radius:8px; font-weight:700; cursor:pointer; font-size:13px;">
                    <i class="fas fa-file-pdf"></i> Baixar Orçamento Oficial (PDF)
                </button>
                <a href="https://wa.me/${globalSettings?.whatsapp_number || '5511968649673'}?text=${encodeURIComponent('Olá! Acabei de gerar o pedido ' + order.order_code + ' pelo site.')}" target="_blank" style="background:#25d366; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:700; font-size:13px;">
                    <i class="fab fa-whatsapp"></i> Acompanhar no WhatsApp
                </a>
            </div>
        </div>
    `;

    window.downloadNativeCartPDF = function() {
        const printWindow = window.open('', '_blank');
        const safeItems = items && items.length > 0 ? items : [
            { name: 'Material Gráfico / Comunicação Visual', quantity: 1, basePrice: order.subtotal || order.total }
        ];

        let rows = '';
        safeItems.forEach((it, idx) => {
            rows += `
                <tr>
                    <td style="padding:10px; border:1px solid #e2e8f0;">${idx + 1}</td>
                    <td style="padding:10px; border:1px solid #e2e8f0;"><strong>${it.name || it.product_name}</strong></td>
                    <td style="padding:10px; text-align:center; border:1px solid #e2e8f0;">${it.quantity}</td>
                    <td style="padding:10px; text-align:right; border:1px solid #e2e8f0;">${Number(it.basePrice || it.unit_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="padding:10px; text-align:right; border:1px solid #e2e8f0;"><strong>${(Number(it.basePrice || it.unit_price) * Number(it.quantity)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></td>
                </tr>
            `;
        });

        let addressStr = 'Retirada na Empresa (Mogi das Cruzes - Grátis)';
        if (order.delivery_type === 'entrega' && order.delivery_address) {
            const a = order.delivery_address;
            addressStr = `Entrega: ${a.rua || ''}, ${a.numero || ''} - ${a.bairro || ''} (${a.cidade || ''})`;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Pedido_${order.order_code}</title>
                <style>
                    @page { size: A4 portrait; margin: 12mm; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; }
                </style>
            </head>
            <body>
                <div style="max-width: 800px; margin: 0 auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #f97316; padding-bottom:15px; margin-bottom:25px;">
                        <div style="display:flex; align-items:center; gap:15px;">
                            <img src="../logo_cabecalho.png" style="height:55px; max-width:220px; object-fit:contain;" onerror="this.src='../logo.png'">
                            <div>
                                <h1 style="margin:0; color:#1e3a8a; font-size:20px; font-weight:800;">VIDAL DESIGN SOLUTIONS</h1>
                                <p style="margin:2px 0 0 0; color:#64748b; font-size:12px;">Comunicação Visual, Sinalização, Toldos e Impressão Digital</p>
                                <p style="margin:2px 0 0 0; color:#64748b; font-size:12px;">Mogi das Cruzes - SP | Tel/WhatsApp: (11) 96864-9673</p>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:13px; font-weight:800; color:#ea580c;">ORÇAMENTO / PEDIDO</div>
                            <div style="font-size:18px; font-weight:800; color:#0f172a;">${order.order_code}</div>
                            <div style="font-size:11px; color:#94a3b8;">Data: ${new Date().toLocaleString('pt-BR')}</div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:15px; margin-bottom:20px; font-size:13px;">
                        <div>
                            <strong>CLIENTE:</strong> ${currentProfile?.full_name || 'Cliente'}<br>
                            <strong>E-MAIL:</strong> ${currentProfile?.email || '-'}<br>
                            <strong>TELEFONE:</strong> ${currentProfile?.phone || '-'}
                        </div>
                        <div>
                            <strong>RECEBIMENTO:</strong> ${addressStr}<br>
                            <strong>CANAL:</strong> ${canal.toUpperCase()}<br>
                            <strong>STATUS:</strong> <span style="font-weight:bold; color:#16a34a;">RECEBIDO</span>
                        </div>
                    </div>

                    <h3 style="font-size:14px; text-transform:uppercase; margin-bottom:10px; color:#0f172a;">Itens do Pedido:</h3>
                    <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:20px;">
                        <thead>
                            <tr style="background:#0f172a; color:#fff;">
                                <th style="padding:8px; text-align:left;">#</th>
                                <th style="padding:8px; text-align:left;">Descrição da Peça</th>
                                <th style="padding:8px; text-align:center;">Qtd</th>
                                <th style="padding:8px; text-align:right;">Unitário</th>
                                <th style="padding:8px; text-align:right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>

                    <div style="display:flex; justify-content:flex-end; margin-bottom:25px;">
                        <div style="width:280px; background:#fff7ed; padding:15px; border-radius:8px; border-left:4px solid #f97316; font-size:13px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                                <span>Subtotal:</span>
                                <strong>${Number(order.subtotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                                <span>Taxa de Arte:</span>
                                <strong>${Number(order.art_fee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold; color:#c2410c; border-top:1px solid #fed7aa; padding-top:6px;">
                                <span>VALOR TOTAL:</span>
                                <span>${Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>
                    </div>

                    <div style="border-top:1px solid #e2e8f0; padding-top:15px; font-size:11px; color:#64748b; text-align:center;">
                        Documento OFICIAL emitido pela Vidal Design Solutions.<br>
                        Mogi das Cruzes - SP | (11) 96864-9673 | (11) 94914-1803
                    </div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 400);
    };
}
