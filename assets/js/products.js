// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/products.js
// OBJETIVO: Catálogo Dinâmico Conectado ao Supabase com Fallback Duplo e Proteção
// ==============================================================================

let productsData = [];
let currentProduct = null;

const arteOptions = {
    id: 'arte',
    label: 'Opções de Criação de Arte',
    type: 'radio',
    obs: '* Arquivos enviados devem estar em alta resolução (PDFx1a, CMYK, curvas).',
    choices: [
        { label: 'Já possuo a arte pronta (Enviar no WhatsApp)', price: 0, isM2: false },
        { label: 'Contratar criação profissional (+ R$ 40,00)', price: 40, isM2: false }
    ]
};

function formatCurrencyProduct(value) {
    if (value === null || value === undefined || isNaN(value)) return '🔒 Sob consulta';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function initModalStructure() {
    if (document.getElementById('productModal')) return;
    const modalHTML = `
    <div id="productModal" class="modal-overlay hidden">
        <div class="modal-content">
            <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
            <div id="modalBody"></div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Carregamento com Fallback Duplo (Nunca quebra)
async function loadProductsFromSupabase() {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;

    productsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--gray-600);"><i class="fas fa-spinner fa-spin"></i> Carregando produtos oficiais...</div>';

    try {
        if (!window.supabaseClient) {
            console.warn('Supabase Client não inicializado.');
            return;
        }

        // Descobre se há usuário logado e qual a modalidade
        let userRole = 'guest';
        if (window.AuthController) {
            const user = await window.AuthController.getCurrentUser();
            if (user) {
                const profile = await window.AuthController.getUserProfile(user.id);
                if (profile && profile.status === 'aprovado') userRole = profile.role;
                else if (profile && profile.role === 'master') userRole = 'master';
            }
        }

        let rawProducts = null;

        // 1. Tenta buscar via RPC
        try {
            const { data, error } = await window.supabaseClient.rpc('v2_get_catalog');
            if (!error && data && data.length > 0) {
                rawProducts = data;
            }
        } catch (e) {}

        // 2. Se a RPC não responder, busca direto na tabela v2_products
        if (!rawProducts) {
            const { data: tableData, error: tableErr } = await window.supabaseClient
                .from('v2_products')
                .select('*')
                .eq('is_active', true)
                .order('name');

            if (tableErr) throw tableErr;

            rawProducts = (tableData || []).map(p => {
                const cost = Number(p.base_cost) || 0;
                let finalDisplayPrice = null;
                if (userRole === 'revenda') finalDisplayPrice = cost * 1.5;
                else if (userRole === 'cliente_final' || userRole === 'master') finalDisplayPrice = cost * 2.0;

                return {
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    calculation_type: p.calculation_type,
                    production_days: p.production_days,
                    images: p.images,
                    display_price: finalDisplayPrice
                };
            });
        }

        if (rawProducts && rawProducts.length > 0) {
            productsData = rawProducts.map(p => {
                let cat = 'geral';
                const nameLow = p.name.toLowerCase();
                if (nameLow.includes('adesivo') || nameLow.includes('dtf')) cat = 'adesivos';
                else if (nameLow.includes('banner') || nameLow.includes('lona') || nameLow.includes('wind')) cat = 'banners';
                else if (nameLow.includes('cartão') || nameLow.includes('folheto')) cat = 'papelaria';
                else if (nameLow.includes('automotivo') || nameLow.includes('tapete') || nameLow.includes('perfume') || nameLow.includes('aromatizante') || nameLow.includes('lixocar') || nameLow.includes('limpeza')) cat = 'automotivo';
                else if (nameLow.includes('toldo')) cat = 'toldos';
                else if (nameLow.includes('camiseta') || nameLow.includes('moletom')) cat = 'vestuario';
                else if (nameLow.includes('social') || nameLow.includes('arte')) cat = 'social-midia';

                const imagesArr = Array.isArray(p.images) && p.images.length > 0 ? p.images : ['assets/images/produtos/adesivo-branco.jpg'];

                return {
                    id: p.id,
                    name: p.name,
                    category: cat,
                    description: p.description || 'Comunicação visual de alta resolução.',
                    calcType: p.calculation_type === 'sqm' ? 'area' : (p.calculation_type === 'linear_meter' ? 'linear' : 'unit'),
                    basePrice: p.display_price !== null ? Number(p.display_price) : null,
                    productionDays: p.production_days || 2,
                    image: imagesArr[0],
                    options: [
                        {
                            id: 'acabamento',
                            label: 'Material / Acabamento:',
                            type: 'select',
                            choices: [
                                { label: 'Padrão da Categoria', price: 0 },
                                { label: 'Laminação Extra', price: 10, isM2: true },
                                { label: 'Personalizável / Outro (Definir no WhatsApp)', price: 0 }
                            ]
                        },
                        arteOptions
                    ]
                };
            });

            renderProducts(productsData);
        } else {
            productsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--gray-500);">Nenhum produto disponível no momento.</div>';
        }

    } catch (err) {
        console.error('Erro ao carregar catálogo:', err);
        productsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--gray-500);">Erro de conexão com o catálogo. Recarregue a página.</div>';
    }
}

function renderProducts(productsToRender) {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;
    
    productsGrid.innerHTML = '';
    
    if (!productsToRender.length) {
        productsGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--gray-500);">Nenhum produto nesta categoria.</div>`;
        return;
    }
    
    productsToRender.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'product-card animate-in';
        card.style.animationDelay = `${index * 0.05}s`;
        
        let displayPriceHTML = '';
        if (product.basePrice === null) {
            displayPriceHTML = `
                <div class="product-price">
                    <span class="price-label">Preço Comercial</span>
                    <span class="price-value" style="font-size: 1rem; color: #6b7280;"><i class="fas fa-lock"></i> Sob consulta</span>
                </div>
            `;
        } else {
            let priceUnit = product.calcType === 'area' ? '/ m²' : (product.calcType === 'linear' ? '/ metro' : '');
            displayPriceHTML = `
                <div class="product-price">
                    <span class="price-label">A partir de</span>
                    <span class="price-value">${formatCurrencyProduct(product.basePrice)} <span style="font-size: 0.7em;">${priceUnit}</span></span>
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="product-image">
                <span class="product-badge">${product.category}</span>
                <img src="${product.image}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.src='logo.png'">
            </div>
            <div class="product-info">
                <h3 class="product-title">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-footer">
                    ${displayPriceHTML}
                    <button class="product-btn config-btn" data-id="${product.id}">
                        <i class="fas fa-cog"></i> Configurar
                    </button>
                </div>
            </div>
        `;
        productsGrid.appendChild(card);
    });
    
    document.querySelectorAll('.config-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openModal(e.currentTarget.getAttribute('data-id')));
    });
}

function openModal(productId) {
    currentProduct = productsData.find(p => p.id === productId);
    if (!currentProduct) return;

    const modalBody = document.getElementById('modalBody');
    
    let dimensionsHTML = '';
    if (currentProduct.calcType === 'area') {
        dimensionsHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>Largura (cm)</label>
                    <input type="number" id="calcW" value="100" min="10" step="1" onchange="calcTotal()" onkeyup="calcTotal()">
                </div>
                <div class="form-group">
                    <label>Altura (cm)</label>
                    <input type="number" id="calcH" value="100" min="10" step="1" onchange="calcTotal()" onkeyup="calcTotal()">
                </div>
            </div>
            <div class="form-group" style="margin-top: -0.5rem;">
                <label style="color: var(--primary); font-weight: 700;">Quantidade de Peças</label>
                <input type="number" id="calcQty" value="1" min="1" step="1" onchange="calcTotal()" onkeyup="calcTotal()" style="border-color: var(--primary);">
            </div>`;
    } else if (currentProduct.calcType === 'linear') {
        dimensionsHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>Largura Total (cm lineares)</label>
                    <input type="number" id="calcW" value="100" min="10" step="1" onchange="calcTotal()" onkeyup="calcTotal()">
                </div>
                <div class="form-group">
                    <label style="color: var(--primary); font-weight: 700;">Quantidade</label>
                    <input type="number" id="calcQty" value="1" min="1" step="1" onchange="calcTotal()" onkeyup="calcTotal()" style="border-color: var(--primary);">
                </div>
            </div>`;
    } else {
        dimensionsHTML = `
            <div class="form-group">
                <label style="color: var(--primary); font-weight: 700;">Quantidade</label>
                <input type="number" id="calcQty" value="1" min="1" step="1" onchange="calcTotal()" onkeyup="calcTotal()" style="border-color: var(--primary);">
            </div>`;
    }

    let optionsHTML = '';
    currentProduct.options.forEach((opt, optIndex) => {
        optionsHTML += `<div class="form-group"><label>${opt.label}</label>`;
        if (opt.obs) optionsHTML += `<p style="font-size:0.75rem; color:#ef4444; margin-bottom:0.5rem; line-height:1.2;">${opt.obs}</p>`;
        
        if (opt.type === 'select') {
            optionsHTML += `<select id="opt_${optIndex}" onchange="calcTotal()">`;
            opt.choices.forEach((choice, choiceIndex) => {
                optionsHTML += `<option value="${choiceIndex}">${choice.label}</option>`;
            });
            optionsHTML += `</select></div>`;
        } else if (opt.type === 'radio') {
            opt.choices.forEach((choice, choiceIndex) => {
                let checked = choiceIndex === 0 ? 'checked' : '';
                optionsHTML += `
                <label class="radio-label">
                    <input type="radio" name="opt_${optIndex}" value="${choiceIndex}" ${checked} onchange="calcTotal()">
                    ${choice.label}
                </label>`;
            });
            optionsHTML += `</div>`;
        }
    });

    const isLocked = currentProduct.basePrice === null;
    const footerHTML = isLocked ? `
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 1rem; border-radius: var(--radius-md); text-align: center; margin-top: 1.5rem;">
            <p style="color: #b91c1c; font-weight: 700; font-size: 0.95rem; margin-bottom: 0.5rem;">
                <i class="fas fa-lock"></i> Preços protegidos para visitantes
            </p>
            <p style="color: #6b7280; font-size: 0.85rem; margin-bottom: 1rem;">
                Faça login com sua conta Google ou cadastre-se para liberar orçamentos e pedidos.
            </p>
            <button class="btn btn-primary" onclick="closeModal(); window.AuthController.loginWithGoogle();">
                <i class="fab fa-google"></i> Entrar com Google
            </button>
        </div>
    ` : `
        <div class="modal-footer">
            <div class="modal-total">Total Estimado: <span id="modalTotalPrice">R$ 0,00</span></div>
            <button class="btn btn-primary" onclick="confirmModalCart()">Adicionar ao Orçamento</button>
        </div>
    `;

    modalBody.innerHTML = `
        <h2 style="margin-bottom: 0.5rem;">${currentProduct.name}</h2>
        <p style="color: var(--gray-600); font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.6;">${currentProduct.description}</p>
        <div style="border-top: 1px solid var(--gray-200); padding-top: 1.5rem;">
            ${dimensionsHTML}${optionsHTML}
        </div>
        <div id="modalSummary" style="background: var(--gray-50); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200); margin-top: 1.5rem; font-size: 0.9rem; color: var(--gray-700); line-height: 1.5;"></div> 
        ${footerHTML}
    `;
    
    document.getElementById('productModal').classList.remove('hidden');
    if (!isLocked) calcTotal();
}

function closeModal() {
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.add('hidden');
}

function calcTotal() {
    if (!currentProduct || currentProduct.basePrice === null) return;
    
    let w_cm = document.getElementById('calcW') ? parseFloat(document.getElementById('calcW').value) || 0 : 0;
    let h_cm = document.getElementById('calcH') ? parseFloat(document.getElementById('calcH').value) || 0 : 0;
    let qty = document.getElementById('calcQty') ? parseInt(document.getElementById('calcQty').value) || 1 : 1;
    if (qty < 1) qty = 1;

    let multiplier = 0;
    let summaryText = `<strong>Resumo da seleção:</strong><br>`;
    
    if (currentProduct.calcType === 'area') {
        let areaM2 = (w_cm / 100) * (h_cm / 100);
        let totalAreaLote = areaM2 * qty;
        summaryText += `- <strong>Medidas:</strong> ${w_cm}cm x${h_cm}cm<br>`;
        summaryText += `- <strong>Quantidade:</strong> ${qty} peça(s)<br>`;
        if (w_cm > 0 && h_cm > 0) multiplier = totalAreaLote < 0.5 ? 0.5 : totalAreaLote; 
    } else if (currentProduct.calcType === 'linear') {
        let totalLinear = (w_cm / 100) * qty;
        summaryText += `- <strong>Largura:</strong> ${w_cm}cm lineares<br>`;
        summaryText += `- <strong>Quantidade:</strong> ${qty} peça(s)<br>`;
        if (w_cm > 0) multiplier = totalLinear;
    } else {
        multiplier = qty;
        summaryText += `- <strong>Quantidade:</strong> ${qty} unidade(s)<br>`;
    }

    let base = currentProduct.basePrice;
    let extraM2 = 0;
    let extraFlat = 0;

    currentProduct.options.forEach((opt, optIndex) => {
        let selectedIndex = 0;
        if (opt.type === 'select') {
            const el = document.getElementById(`opt_${optIndex}`);
            if (el) selectedIndex = parseInt(el.value);
        } else if (opt.type === 'radio') {
            let radios = document.getElementsByName(`opt_${optIndex}`);
            for (let r of radios) { if (r.checked) selectedIndex = parseInt(r.value); }
        }
        
        let choice = opt.choices[selectedIndex];
        if (choice) {
            let cleanLabel = opt.label.replace(':', '');
            summaryText += `- <strong>${cleanLabel}:</strong>${choice.label}<br>`;
            if (choice.price > 0) {
                if (choice.isM2) extraM2 += choice.price;
                else extraFlat += choice.price;
            }
        }
    });

    let finalPrice = 0;
    if (multiplier === 0 && currentProduct.calcType === 'area') {
        finalPrice = 0;
    } else {
        finalPrice = (base * multiplier) + (extraM2 * multiplier) + extraFlat;
    }

    const summaryEl = document.getElementById('modalSummary');
    const totalEl = document.getElementById('modalTotalPrice');
    if (summaryEl) summaryEl.innerHTML = summaryText;
    if (totalEl) totalEl.innerText = formatCurrencyProduct(finalPrice);
    
    return { finalPrice, multiplier, w_cm, h_cm, qty };
}

function confirmModalCart() {
    const calcData = calcTotal();
    if (!calcData) return;

    if (currentProduct.calcType === 'area' && (calcData.w_cm === 0 || calcData.h_cm === 0)) {
        alert("Por favor, preencha as medidas do material antes de adicionar.");
        return;
    }
    
    let detailsStr = '';
    currentProduct.options.forEach((opt, optIndex) => {
        let selectedIndex = 0;
        if (opt.type === 'select') {
            const el = document.getElementById(`opt_${optIndex}`);
            if (el) selectedIndex = parseInt(el.value);
        } else if (opt.type === 'radio') {
            let radios = document.getElementsByName(`opt_${optIndex}`);
            for (let r of radios) { if (r.checked) selectedIndex = parseInt(r.value); }
        }
        if (opt.choices[selectedIndex]) {
            detailsStr += ` | ${opt.choices[selectedIndex].label}`;
        }
    });

    let sizeStr = '';
    if (currentProduct.calcType === 'area') sizeStr = `(${calcData.w_cm}cm x ${calcData.h_cm}cm) -${calcData.qty} un.`;
    else if (currentProduct.calcType === 'linear') sizeStr = `(${calcData.w_cm}cm linear) -${calcData.qty} un.`;
    else sizeStr = `- ${calcData.qty} un.`;

    const cartItem = {
        id: currentProduct.id + '-' + Date.now(),
        name: `${currentProduct.name} ${sizeStr}${detailsStr}`,
        category: currentProduct.category,
        basePrice: calcData.finalPrice,
        image: currentProduct.image
    };

    if (typeof addToCart === 'function') {
        addToCart(cartItem);
        closeModal();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initModalStructure();
    loadProductsFromSupabase();
    
    window.addEventListener('filterProducts', (e) => {
        const category = e.detail.category;
        if (!category || category === 'all') renderProducts(productsData);
        else renderProducts(productsData.filter(p => p.category === category));
    });
});
