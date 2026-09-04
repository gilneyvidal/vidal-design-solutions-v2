// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/products.js
// OBJETIVO: Catálogo Integrado ao Supabase com Regras de Margem e Modal Gráfico
// ==============================================================================

let productsData = [];
let currentProduct = null;

// Opção Padrão de Arte (+ R$ 40,00 conforme Ata 01)
const arteOptions = {
    id: 'arte',
    label: 'Opções de Criação de Arte',
    type: 'radio',
    obs: '* Arquivos para impressão devem ser enviados em alta resolução (PDFx1a, CMYK com textos em curvas).',
    choices: [
        { label: 'Já possuo o arquivo pronto (Enviar no WhatsApp)', price: 0, isM2: false },
        { label: 'Contratar criação profissional (+ R$ 40,00)', price: 40, isM2: false }
    ]
};

// Formatação de Moeda
function formatCurrencyProduct(value) {
    if (value === null || value === undefined || isNaN(value)) return '🔒 Sob consulta';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Injeção da estrutura do Modal no HTML
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

// Carregamento de Produtos do Supabase
async function loadProductsFromSupabase() {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;

    productsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--gray-600);"><i class="fas fa-spinner fa-spin"></i> Carregando produtos oficiais...</div>';

    try {
        if (!window.supabaseClient) {
            console.warn('Supabase não conectado. Aguardando...');
            return;
        }

        // Busca produtos com preços protegidos pela RPC v2_get_catalog
        const { data, error } = await window.supabaseClient.rpc('v2_get_catalog');
        if (error) throw error;

        if (data && data.length > 0) {
            // Mapeia os dados vindos do banco para o padrão visual do frontend
            productsData = data.map(p => {
                let cat = 'geral';
                const nameLow = p.name.toLowerCase();
                if (nameLow.includes('adesivo') || nameLow.includes('dtf')) cat = 'adesivos';
                else if (nameLow.includes('banner') || nameLow.includes('lona') || nameLow.includes('wind')) cat = 'banners';
                else if (nameLow.includes('cartão') || nameLow.includes('folheto')) cat = 'papelaria';
                else if (nameLow.includes('automotivo') || nameLow.includes('tapetes') || nameLow.includes('perfume') || nameLow.includes('aromatizante') || nameLow.includes('lixocar') || nameLow.includes('limpeza')) cat = 'automotivo';
                else if (nameLow.includes('toldo')) cat = 'toldos';
                else if (nameLow.includes('camiseta') || nameLow.includes('moletom')) cat = 'vestuario';
                else if (nameLow.includes('social') || nameLow.includes('artes')) cat = 'social-midia';

                const imagesArr = Array.isArray(p.images) && p.images.length > 0 ? p.images : ['assets/images/produtos/adesivo-branco.jpg'];

                return {
                    id: p.id,
                    name: p.name,
                    category: cat,
                    description: p.description || 'Produto oficial Vidal Design Solutions.',
                    calcType: p.calculation_type === 'sqm' ? 'area' : (p.calculation_type === 'linear_meter' ? 'linear' : 'unit'),
                    basePrice: p.display_price !== null ? Number(p.display_price) : null,
                    productionDays: p.production_days || 2,
                    image: imagesArr[0],
                    options: [
                        {
                            id: 'acabamento',
                            label: 'Material e Acabamento:',
                            type: 'select',
                            choices: [
                                { label: 'Padrão da Categoria', price: 0 },
                                { label: 'Laminação Extra', price: 10, isM2: true },
                                { label: 'Personalizável / Outro (Ajustar no WhatsApp)', price: 0 }
                            ]
                        },
                        arteOptions
                    ]
                };
            });

            renderProducts(productsData);
        } else {
            productsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--gray-500);">Nenhum produto cadastrado no catálogo.</div>';
        }

    } catch (err) {
        console.error('Erro ao buscar catálogo:', err);
        productsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--gray-500);">Erro ao carregar catálogo. Recarregue a página.</div>';
    }
}

// Renderização dos Cards de Produtos na Grade
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

// Abertura do Modal de Configuração
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

    // Trava de Preço Oculto se não estiver logado
    const isLocked = currentProduct.basePrice === null;
    const footerHTML = isLocked ? `
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 1rem; border-radius: var(--radius-md); text-align: center; margin-top: 1.5rem;">
            <p style="color: #b91c1c; font-weight: 700; font-size: 0.95rem; margin-bottom: 0.5rem;">
                <i class="fas fa-lock"></i> Preços protegidos para visitantes
            </p>
            <p style="color: #6b7280; font-size: 0.85rem; margin-bottom: 1rem;">
                Faça login com sua conta Google no topo da página para liberar orçamentos e pedidos.
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
            ${dimensionsHTML}
            ${optionsHTML}
        </div>
        
        <div id="modalSummary" style="background: var(--gray-50); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200); margin-top: 1.5rem; font-size: 0.9rem; color: var(--gray-700); line-height: 1.5;">
        </div> 

        ${footerHTML}
    `;
    
    document.getElementById('productModal').classList.remove('hidden');
    if (!isLocked) calcTotal();
}

function closeModal() {
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.add('hidden');
}

// Cálculo do Total em Tempo Real com Regra dos 0,5 m² Mínimo
function calcTotal() {
    if (!currentProduct || currentProduct.basePrice === null) return;
    
    let w_cm = document.getElementById('calcW') ? parseFloat(document.getElementById('calcW').value) || 0 : 0;
    let h_cm = document.getElementById('calcH') ? parseFloat(document.getElementById('calcH').value) || 0 : 0;
    let qty = document.getElementById('calcQty') ? parseInt(document.getElementById('calcQty').value) || 1 : 1;
    if (qty < 1) qty = 1;

    let multiplier = 0;
    let summaryText = `<strong>Resumo da seleção:</strong><br>`;
    
    // Regra da Área (m²) com Mínimo de 0,5 m²
    if (currentProduct.calcType === 'area') {
        let areaM2 = (w_cm / 100) * (h_cm / 100);
        let totalAreaLote = areaM2 * qty;
        
        summaryText += `- <strong>Medidas:</strong> ${w_cm}cm x ${h_cm}cm<br>`;
        summaryText += `- <strong>Quantidade:</strong> ${qty} peça(s)<br>`;
        
        if (w_cm > 0 && h_cm > 0) {
            multiplier = totalAreaLote < 0.5 ? 0.5 : totalAreaLote; 
        }
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
            summaryText += `- <strong>${cleanLabel}:</strong> ${choice.label}<br>`;
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

// Confirmação e Envio para o Carrinho
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
    if (currentProduct.calcType === 'area') sizeStr = `(${calcData.w_cm}cm x ${calcData.h_cm}cm) - ${calcData.qty} un.`;
    else if (currentProduct.calcType === 'linear') sizeStr = `(${calcData.w_cm}cm linear) - ${calcData.qty} un.`;
    else sizeStr = `- ${calcData.qty} un.`;

    const cartItem = {
        id: currentProduct.id + '-' + Date.now(),
        name: `${currentProduct.name} ${sizeStr} ${detailsStr}`,
        category: currentProduct.category,
        basePrice: calcData.finalPrice,
        image: currentProduct.image
    };

    if (typeof addToCart === 'function') {
        addToCart(cartItem);
        closeModal();
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initModalStructure();
    loadProductsFromSupabase();
    
    // Escuta eventos de filtro disparados pelos cards de categorias da home
    window.addEventListener('filterProducts', (e) => {
        const category = e.detail.category;
        if (!category || category === 'all') renderProducts(productsData);
        else renderProducts(productsData.filter(p => p.category === category));
    });
});
