// ==============================================================================
// PROJETO: Vidal Design Solutions V2
// ARQUIVO: assets/js/products.js
// OBJETIVO: Motor de Catálogo, Consulta Segura ao Supabase e Renderização
// ==============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Se estivermos na home com a grade de produtos, carregar o catálogo
    if (document.getElementById('products-grid')) {
        await loadCatalogGrid();
    }
});

// Busca os produtos de forma segura no Supabase através da RPC v2_get_catalog
async function fetchSecureCatalog() {
    if (!window.supabaseClient) {
        console.error('Supabase Client não inicializado.');
        return [];
    }

    try {
        const { data, error } = await window.supabaseClient.rpc('v2_get_catalog');
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Erro ao carregar catálogo seguro:', err.message);
        return [];
    }
}

// Renderiza os produtos na página principal
async function loadCatalogGrid() {
    const grid = document.getElementById('products-grid');
    const subtitle = document.getElementById('catalog-subtitle');
    if (!grid) return;

    grid.innerHTML = '<div class="loading-state">Carregando catálogo oficial...</div>';

    const products = await fetchSecureCatalog();

    if (!products.length) {
        grid.innerHTML = '<div class="empty-state">Nenhum produto disponível no momento.</div>';
        if (subtitle) subtitle.textContent = 'Novos produtos sendo adicionados em breve.';
        return;
    }

    if (subtitle) {
        subtitle.textContent = `${products.length} itens disponíveis para produção`;
    }

    grid.innerHTML = '';

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';

        // Foto principal (primeira do array de imagens ou imagem padrão)
        const images = Array.isArray(product.images) && product.images.length > 0 
            ? product.images 
            : ['../logo.png'];
        const mainImage = images[0];

        // Tratamento de exibição de preço conforme regras da reunião
        let priceDisplayHTML = '';
        if (product.display_price === null || product.display_price === undefined) {
            priceDisplayHTML = `
                <div class="price-locked-box">
                    <span class="price-locked-badge">🔒 Preço sob consulta</span>
                    <small>Faça login para ver valores</small>
                </div>
            `;
        } else {
            const formattedPrice = Number(product.display_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const unitLabel = product.calculation_type === 'sqm' ? '/ m²' : 
                             product.calculation_type === 'linear_meter' ? '/ m linear' : '';
            
            priceDisplayHTML = `
                <div class="price-box">
                    <span class="price-label">A partir de</span>
                    <span class="price-value">${formattedPrice} <small>${unitLabel}</small></span>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="product-thumb-wrapper">
                <img src="${mainImage}" alt="${product.name}" class="product-thumb" loading="lazy" />
                <span class="deadline-badge">⏱️ ${product.production_days} dias úteis</span>
            </div>
            <div class="product-info">
                <h3 class="product-title">${product.name}</h3>
                <p class="product-desc">${product.description || 'Produto sob medida de alta qualidade.'}</p>
                ${priceDisplayHTML}
                <div class="product-card-actions">
                    <a href="pages/produto.html?id=${product.id}" class="btn-config-product">Configurar e Pedir</a>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

// Exportação global para uso nas outras páginas
window.CatalogController = {
    fetchSecureCatalog,
    loadCatalogGrid
};
