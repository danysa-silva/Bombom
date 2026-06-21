// ============================================================
// ESTADO
// ============================================================
let produtos = [];
let vendas = [];
let currentFilter = 'hoje';
let paymentStatus = 'dinheiro';
let pedidoPaymentStatus = 'dinheiro';
let editingProdutoId = null;
let nomeUsuario = '';
let modoAtual = ''; // 'admin' | 'cliente'
let produtoPedidoAtual = null;

// ============================================================
// INICIALIZAÇÃO
// ============================================================
window.addEventListener('load', async function () {
  if (!window.db) {
    showError('Banco de dados não configurado. Verifique o arquivo config.js.');
    return;
  }

  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('venda-data').value = hoje;

  const modoSalvo = localStorage.getItem('appModo');

  if (!modoSalvo) {
    esconderLoading();
    document.getElementById('tela-inicial').classList.remove('hidden');
    return;
  }

  if (modoSalvo === 'admin') {
    await iniciarModoAdmin();
  } else {
    nomeUsuario = localStorage.getItem('nomeUsuario') || '';
    if (!nomeUsuario) {
      esconderLoading();
      document.getElementById('tela-nome-cliente').classList.remove('hidden');
    } else {
      await iniciarModoCliente();
    }
  }
});

// ============================================================
// TELAS DE ENTRADA
// ============================================================
function entrarComoCliente() {
  document.getElementById('tela-inicial').classList.add('hidden');
  nomeUsuario = localStorage.getItem('nomeUsuario') || '';
  if (!nomeUsuario) {
    document.getElementById('tela-nome-cliente').classList.remove('hidden');
  } else {
    localStorage.setItem('appModo', 'cliente');
    iniciarModoCliente();
  }
}

function mostrarTelaPin() {
  document.getElementById('tela-inicial').classList.add('hidden');
  document.getElementById('tela-pin').classList.remove('hidden');
  setTimeout(function () { document.getElementById('input-pin').focus(); }, 100);
}

function verificarPin() {
  var pin = document.getElementById('input-pin').value;
  if (pin === window.ADMIN_PIN) {
    document.getElementById('tela-pin').classList.add('hidden');
    localStorage.setItem('appModo', 'admin');
    iniciarModoAdmin();
  } else {
    showToast('PIN incorreto. Tente novamente.');
    document.getElementById('input-pin').value = '';
  }
}

function salvarNomeUsuario() {
  var nome = document.getElementById('input-nome-usuario').value.trim();
  if (!nome) { showToast('Digite seu nome para continuar'); return; }
  nomeUsuario = nome;
  localStorage.setItem('nomeUsuario', nome);
  localStorage.setItem('appModo', 'cliente');
  document.getElementById('tela-nome-cliente').classList.add('hidden');
  iniciarModoCliente();
}

function voltarInicio() {
  document.getElementById('tela-pin').classList.add('hidden');
  document.getElementById('tela-nome-cliente').classList.add('hidden');
  document.getElementById('tela-inicial').classList.remove('hidden');
  document.getElementById('input-pin').value = '';
}

function sair() {
  if (!confirm('Deseja sair e voltar à tela inicial?')) return;
  localStorage.removeItem('appModo');
  location.reload();
}

// ============================================================
// MODO ADMIN
// ============================================================
async function iniciarModoAdmin() {
  modoAtual = 'admin';
  document.getElementById('nav-admin').classList.remove('hidden');
  document.getElementById('btn-sair').classList.remove('hidden');
  document.getElementById('page-title').textContent = 'Dashboard';
  document.getElementById('page-icon').textContent = '📊';
  await carregarDados();
}

// ============================================================
// MODO CLIENTE
// ============================================================
async function iniciarModoCliente() {
  modoAtual = 'cliente';
  document.getElementById('nav-cliente').classList.remove('hidden');
  document.getElementById('btn-sair').classList.remove('hidden');
  document.getElementById('page-title').textContent = 'Olá, ' + nomeUsuario + '!';
  document.getElementById('page-icon').textContent = '🛍️';

  // Mostra página da loja e esconde admin pages
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  document.getElementById('page-loja').classList.add('active');

  await carregarDados();
}

function navegarCliente(pagina) {
  var titulos = { loja: 'Loja', 'meus-pedidos': 'Meus Pedidos' };
  var icones = { loja: '🛍️', 'meus-pedidos': '📋' };

  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  document.getElementById('page-' + pagina).classList.add('active');

  document.querySelectorAll('#nav-cliente .nav-btn').forEach(function (b) { b.classList.remove('active'); });
  document.getElementById('nav-cli-' + pagina).classList.add('active');

  document.getElementById('page-title').textContent = titulos[pagina];
  document.getElementById('page-icon').textContent = icones[pagina];

  if (pagina === 'meus-pedidos') renderizarMeusPedidos();
}

// ============================================================
// CARREGAR DADOS
// ============================================================
async function carregarDados() {
  await Promise.all([carregarProdutos(), carregarVendas()]);
  esconderLoading();
}

async function carregarProdutos() {
  var { data, error } = await window.db.from('produtos').select('*').order('nome');
  if (error) { console.error(error); showToast('Erro ao carregar produtos'); return; }
  produtos = data || [];
  if (modoAtual === 'admin') {
    renderizarProdutos();
    renderizarEstoque();
    atualizarSelectVenda();
  } else {
    renderizarCatalogo();
  }
}

async function carregarVendas() {
  var { data, error } = await window.db.from('vendas').select('*').order('data', { ascending: false }).limit(200);
  if (error) { console.error(error); return; }
  vendas = data || [];
  if (modoAtual === 'admin') renderizarDashboard();
}

// ============================================================
// CATÁLOGO (CLIENTE)
// ============================================================
function renderizarCatalogo() {
  var container = document.getElementById('catalogo-produtos');
  var disponiveis = produtos.filter(function (p) { return p.estoque > 0; });

  if (disponiveis.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-icon">🍫</div>' +
      '<p>Nenhum produto disponível no momento</p></div>';
    return;
  }

  container.innerHTML = '<div class="catalogo-grid">' +
    disponiveis.map(function (p) {
      var imgHtml = p.imagem_url
        ? '<img src="' + p.imagem_url + '" class="catalogo-card-img" alt="' + escaparHTML(p.nome) + '">'
        : '<div class="catalogo-card-placeholder">🍫</div>';
      return (
        '<div class="catalogo-card" onclick="abrirModalPedido(\'' + p.id + '\')">' +
          imgHtml +
          '<div class="catalogo-card-info">' +
            '<div class="catalogo-card-nome">' + escaparHTML(p.nome) + '</div>' +
            '<div class="catalogo-card-preco">' + formatarDinheiro(p.precovenda) + '</div>' +
            '<div class="catalogo-card-estoque">' + p.estoque + ' disponíveis</div>' +
          '</div>' +
        '</div>'
      );
    }).join('') +
  '</div>';
}

function renderizarMeusPedidos() {
  var container = document.getElementById('lista-meus-pedidos');
  var meusPedidos = vendas.filter(function (v) {
    return (v.nomecomprador || '').toLowerCase() === nomeUsuario.toLowerCase();
  });

  if (meusPedidos.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-icon">📋</div>' +
      '<p>Você ainda não fez nenhum pedido</p></div>';
    return;
  }

  container.innerHTML = '<div class="section-title">Seus Pedidos</div>' +
    meusPedidos.map(function (v) {
      var partes = v.data.split('-');
      var dataStr = partes[2] + '/' + partes[1];
      var badgeInfo = {
        dinheiro: { classe: 'badge-pago', texto: '💵 Dinheiro' },
        pix:      { classe: 'badge-pago', texto: '📱 PIX' },
        credito:  { classe: 'badge-pago', texto: '💳 Crédito' },
        prazo:    { classe: 'badge-prazo', texto: '💰 Quando Receber' }
      };
      var badge = badgeInfo[v.status] || badgeInfo['prazo'];
      return (
        '<div class="venda-item">' +
          '<div class="venda-item-left">' +
            '<div class="venda-nome">' + escaparHTML(v.produtonome) + '</div>' +
            '<div class="venda-info">' + v.quantidade + 'x &bull; ' + dataStr + '</div>' +
          '</div>' +
          '<div class="venda-item-right">' +
            '<div class="venda-valor">' + formatarDinheiro(v.total) + '</div>' +
            '<span class="badge ' + badge.classe + '">' + badge.texto + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join('');
}

// Modal pedido (cliente)
function abrirModalPedido(produtoId) {
  produtoPedidoAtual = produtos.find(function (p) { return p.id === produtoId; });
  if (!produtoPedidoAtual) return;

  document.getElementById('modal-pedido-titulo').textContent = produtoPedidoAtual.nome;
  document.getElementById('pedido-qty').value = '1';
  setPedidoPayment('dinheiro');
  updatePedidoPreview();

  var imgHtml = produtoPedidoAtual.imagem_url
    ? '<img src="' + produtoPedidoAtual.imagem_url + '" class="pedido-produto-img" alt="">'
    : '<div class="pedido-produto-placeholder">🍫</div>';

  document.getElementById('modal-pedido-produto-info').innerHTML =
    imgHtml +
    '<div>' +
      '<div class="pedido-produto-nome">' + escaparHTML(produtoPedidoAtual.nome) + '</div>' +
      '<div class="pedido-produto-preco">' + formatarDinheiro(produtoPedidoAtual.precovenda) + ' cada</div>' +
    '</div>';

  document.getElementById('modal-pedido').classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

function changePedidoQty(delta) {
  var input = document.getElementById('pedido-qty');
  input.value = Math.max(1, (parseInt(input.value) || 1) + delta);
  updatePedidoPreview();
}

function setPedidoPayment(status) {
  pedidoPaymentStatus = status;
  ['dinheiro', 'pix', 'credito', 'prazo'].forEach(function (s) {
    document.getElementById('pedido-btn-' + s).className =
      'pay-btn' + (status === s ? ' pay-btn-active' : '');
  });
}

function updatePedidoPreview() {
  if (!produtoPedidoAtual) return;
  var qty = parseInt(document.getElementById('pedido-qty').value) || 1;
  var total = parseFloat(produtoPedidoAtual.precovenda) * qty;
  document.getElementById('pedido-preview-total').textContent = formatarDinheiro(total);
}

async function confirmarPedido() {
  if (!produtoPedidoAtual) return;
  var qty = parseInt(document.getElementById('pedido-qty').value) || 1;

  if (produtoPedidoAtual.estoque < qty) {
    showToast('Estoque insuficiente! Disponível: ' + produtoPedidoAtual.estoque);
    return;
  }

  var btn = document.getElementById('btn-confirmar-pedido');
  var hoje = new Date().toISOString().split('T')[0];
  var precovenda = parseFloat(produtoPedidoAtual.precovenda);
  var precocusto = parseFloat(produtoPedidoAtual.precocusto);

  var venda = {
    produtoid: produtoPedidoAtual.id,
    produtonome: produtoPedidoAtual.nome,
    quantidade: qty,
    precovenda: precovenda,
    precocusto: precocusto,
    status: pedidoPaymentStatus,
    data: hoje,
    total: precovenda * qty,
    lucro: (precovenda - precocusto) * qty,
    nomecomprador: nomeUsuario
  };

  try {
    btn.disabled = true;
    btn.textContent = 'Confirmando...';

    var { error: vendaError } = await window.db.from('vendas').insert([venda]);
    if (vendaError) throw vendaError;

    var { error: stockError } = await window.db
      .from('produtos').update({ estoque: produtoPedidoAtual.estoque - qty }).eq('id', produtoPedidoAtual.id);
    if (stockError) throw stockError;

    showToast('✅ Pedido feito! Total: ' + formatarDinheiro(venda.total));
    closeModal('modal-pedido');
    await carregarDados();
    navegarCliente('meus-pedidos');

  } catch (erro) {
    console.error(erro);
    showToast('Erro ao fazer pedido. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar Pedido';
  }
}

// ============================================================
// NAVEGAÇÃO ADMIN
// ============================================================
var paginaConfig = {
  dashboard: { titulo: 'Dashboard',  icone: '📊' },
  venda:     { titulo: 'Nova Venda', icone: '🛒' },
  produtos:  { titulo: 'Produtos',   icone: '🍫' },
  estoque:   { titulo: 'Estoque',    icone: '📦' }
};

function navigate(pagina) {
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  document.getElementById('page-' + pagina).classList.add('active');

  document.querySelectorAll('#nav-admin .nav-btn').forEach(function (b) { b.classList.remove('active'); });
  document.getElementById('nav-' + pagina).classList.add('active');

  var config = paginaConfig[pagina];
  document.getElementById('page-title').textContent = config.titulo;
  document.getElementById('page-icon').textContent = config.icone;
  window.scrollTo(0, 0);
}

// ============================================================
// DASHBOARD
// ============================================================
function setFilter(filtro) {
  currentFilter = filtro;
  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.filter === filtro);
  });
  renderizarDashboard();
}

function getVendasFiltradas() {
  var agora = new Date();
  var hojeStr = agora.toISOString().split('T')[0];

  return vendas.filter(function (v) {
    var dataVenda = v.data;
    if (currentFilter === 'hoje') return dataVenda === hojeStr;
    if (currentFilter === 'semana') {
      var semanaAtras = new Date(agora);
      semanaAtras.setDate(semanaAtras.getDate() - 6);
      return dataVenda >= semanaAtras.toISOString().split('T')[0];
    }
    return dataVenda.startsWith(hojeStr.substring(0, 7));
  });
}

function renderizarDashboard() {
  var filtradas = getVendasFiltradas();
  var totalVendido = 0, recebido = 0, aReceber = 0, lucro = 0;

  filtradas.forEach(function (v) {
    totalVendido += parseFloat(v.total) || 0;
    lucro += parseFloat(v.lucro) || 0;
    if (v.status === 'prazo') aReceber += parseFloat(v.total) || 0;
    else recebido += parseFloat(v.total) || 0;
  });

  document.getElementById('dash-total-vendido').textContent = formatarDinheiro(totalVendido);
  document.getElementById('dash-recebido').textContent = formatarDinheiro(recebido);
  document.getElementById('dash-a-receber').textContent = formatarDinheiro(aReceber);
  document.getElementById('dash-lucro').textContent = formatarDinheiro(lucro);
  document.getElementById('dash-qtd-vendas').textContent = filtradas.length + (filtradas.length === 1 ? ' venda' : ' vendas');

  var container = document.getElementById('dash-ultimas-vendas');
  var recentes = filtradas.slice(0, 15);

  if (recentes.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🛒</div><p>Nenhuma venda no período</p></div>';
    return;
  }

  var badgeInfo = {
    dinheiro: { classe: 'badge-pago', texto: '💵 Dinheiro' },
    pix:      { classe: 'badge-pago', texto: '📱 PIX' },
    credito:  { classe: 'badge-pago', texto: '💳 Crédito' },
    prazo:    { classe: 'badge-prazo', texto: '💰 Quando Receber' }
  };

  container.innerHTML = recentes.map(function (v) {
    var partes = v.data.split('-');
    var dataStr = partes[2] + '/' + partes[1];
    var badge = badgeInfo[v.status] || badgeInfo['prazo'];
    return (
      '<div class="venda-item">' +
        '<div class="venda-item-left">' +
          '<div class="venda-nome">' + escaparHTML(v.produtonome) + '</div>' +
          '<div class="venda-info">' + v.quantidade + 'x &bull; ' + dataStr +
            (v.nomecomprador ? ' &bull; ' + escaparHTML(v.nomecomprador) : '') + '</div>' +
        '</div>' +
        '<div class="venda-item-right">' +
          '<div class="venda-valor">' + formatarDinheiro(v.total) + '</div>' +
          '<span class="badge ' + badge.classe + '">' + badge.texto + '</span>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

// ============================================================
// NOVA VENDA (ADMIN)
// ============================================================
function atualizarSelectVenda() {
  var select = document.getElementById('venda-produto');
  var valorAtual = select.value;
  select.innerHTML = '<option value="">Selecione um produto...</option>';
  produtos.forEach(function (p) {
    var opt = document.createElement('option');
    opt.value = p.id;
    var textoEstoque = p.estoque > 0 ? '(estoque: ' + p.estoque + ')' : '❌ SEM ESTOQUE';
    opt.textContent = p.nome + ' — ' + formatarDinheiro(p.precovenda) + ' ' + textoEstoque;
    if (p.estoque === 0) opt.disabled = true;
    select.appendChild(opt);
  });
  if (valorAtual) select.value = valorAtual;
}

function changeQty(delta) {
  var input = document.getElementById('venda-qty');
  input.value = Math.max(1, (parseInt(input.value) || 1) + delta);
  updateVendaPreview();
}

function setPayment(status) {
  paymentStatus = status;
  ['dinheiro', 'pix', 'credito', 'prazo'].forEach(function (s) {
    document.getElementById('btn-' + s).className = 'pay-btn' + (status === s ? ' pay-btn-active' : '');
  });
}

function updateVendaPreview() {
  var produtoId = document.getElementById('venda-produto').value;
  var qty = parseInt(document.getElementById('venda-qty').value) || 0;
  if (!produtoId || qty <= 0) { document.getElementById('venda-preview').classList.add('hidden'); return; }
  var produto = produtos.find(function (p) { return p.id === produtoId; });
  if (!produto) return;
  document.getElementById('preview-total').textContent = formatarDinheiro(parseFloat(produto.precovenda) * qty);
  document.getElementById('preview-lucro').textContent = formatarDinheiro((parseFloat(produto.precovenda) - parseFloat(produto.precocusto)) * qty);
  document.getElementById('venda-preview').classList.remove('hidden');
}

async function registrarVenda() {
  var produtoId = document.getElementById('venda-produto').value;
  var qty = parseInt(document.getElementById('venda-qty').value) || 0;
  var dataStr = document.getElementById('venda-data').value;
  var nomeCliente = document.getElementById('venda-cliente').value.trim();

  if (!produtoId) { showToast('Selecione um produto'); return; }
  if (qty <= 0)   { showToast('Informe uma quantidade válida'); return; }
  if (!nomeCliente) { showToast('Informe o nome do cliente'); return; }

  var produto = produtos.find(function (p) { return p.id === produtoId; });
  if (!produto) return;
  if (produto.estoque < qty) { showToast('Estoque insuficiente! Disponível: ' + produto.estoque); return; }

  var btn = document.getElementById('btn-registrar');
  var precovenda = parseFloat(produto.precovenda);
  var precocusto = parseFloat(produto.precocusto);

  var venda = {
    produtoid: produtoId,
    produtonome: produto.nome,
    quantidade: qty,
    precovenda: precovenda,
    precocusto: precocusto,
    status: paymentStatus,
    data: dataStr,
    total: precovenda * qty,
    lucro: (precovenda - precocusto) * qty,
    nomecomprador: nomeCliente
  };

  try {
    btn.disabled = true;
    btn.textContent = 'Registrando...';

    var { error: vendaError } = await window.db.from('vendas').insert([venda]);
    if (vendaError) throw vendaError;

    var { error: stockError } = await window.db
      .from('produtos').update({ estoque: produto.estoque - qty }).eq('id', produtoId);
    if (stockError) throw stockError;

    showToast('✅ Venda registrada! Total: ' + formatarDinheiro(venda.total));
    document.getElementById('venda-produto').value = '';
    document.getElementById('venda-qty').value = '1';
    document.getElementById('venda-cliente').value = '';
    document.getElementById('venda-preview').classList.add('hidden');
    setPayment('dinheiro');
    await carregarDados();
    navigate('dashboard');

  } catch (erro) {
    console.error(erro);
    showToast('Erro ao registrar venda. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Registrar Venda';
  }
}

// ============================================================
// PRODUTOS (ADMIN)
// ============================================================
function renderizarProdutos() {
  var container = document.getElementById('lista-produtos');
  if (produtos.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🍫</div><p>Nenhum produto cadastrado ainda.<br>Clique em "+ Novo Produto" para começar!</p></div>';
    return;
  }
  container.innerHTML = produtos.map(function (p) {
    var lucroUnitario = parseFloat(p.precovenda) - parseFloat(p.precocusto);
    var badgeClass = p.estoque === 0 ? 'estoque-zero' : p.estoque <= (p.estoqueminimo || 5) ? 'estoque-baixo' : 'estoque-ok';
    var imagemHtml = p.imagem_url
      ? '<img src="' + p.imagem_url + '" class="produto-imagem" alt="' + escaparHTML(p.nome) + '">'
      : '<div class="produto-imagem-placeholder">🍫</div>';
    return (
      '<div class="produto-item" style="padding:0;overflow:hidden">' +
        imagemHtml +
        '<div style="padding:12px 14px">' +
          '<div class="produto-header">' +
            '<div class="produto-nome">' + escaparHTML(p.nome) + '</div>' +
            '<span class="estoque-badge ' + badgeClass + '">' + p.estoque + ' un.</span>' +
          '</div>' +
          '<div class="produto-precos">' +
            '<span>Custo: <strong>' + formatarDinheiro(p.precocusto) + '</strong></span>' +
            '<span>Venda: <strong>' + formatarDinheiro(p.precovenda) + '</strong></span>' +
            '<span>Lucro: <strong class="green">' + formatarDinheiro(lucroUnitario) + '</strong></span>' +
          '</div>' +
          '<div class="produto-actions">' +
            '<button class="btn-secondary" onclick="openProdutoModal(\'' + p.id + '\')">Editar</button>' +
            '<button class="btn-danger" onclick="deletarProduto(\'' + p.id + '\', \'' + escaparHTML(p.nome) + '\')">Excluir</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function openProdutoModal(produtoId) {
  editingProdutoId = produtoId || null;
  document.getElementById('produto-imagem').value = '';
  document.getElementById('produto-imagem-preview').classList.add('hidden');
  document.getElementById('upload-placeholder').classList.remove('hidden');

  if (produtoId) {
    var p = produtos.find(function (x) { return x.id === produtoId; });
    if (p) {
      document.getElementById('produto-nome').value = p.nome;
      document.getElementById('produto-custo').value = p.precocusto;
      document.getElementById('produto-venda').value = p.precovenda;
      document.getElementById('produto-estoque').value = p.estoque;
      document.getElementById('produto-estoque-min').value = p.estoqueminimo || 5;
      if (p.imagem_url) {
        document.getElementById('produto-imagem-preview').src = p.imagem_url;
        document.getElementById('produto-imagem-preview').classList.remove('hidden');
        document.getElementById('upload-placeholder').classList.add('hidden');
      }
    }
    document.getElementById('modal-produto-title').textContent = 'Editar Produto';
  } else {
    document.getElementById('produto-nome').value = '';
    document.getElementById('produto-custo').value = '';
    document.getElementById('produto-venda').value = '';
    document.getElementById('produto-estoque').value = '';
    document.getElementById('produto-estoque-min').value = '5';
    document.getElementById('modal-produto-title').textContent = 'Novo Produto';
  }
  document.getElementById('modal-produto').classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

function previewImagem(input) {
  if (input.files && input.files[0]) {
    var reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById('produto-imagem-preview').src = e.target.result;
      document.getElementById('produto-imagem-preview').classList.remove('hidden');
      document.getElementById('upload-placeholder').classList.add('hidden');
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function uploadImagem(file, produtoId) {
  var extensao = file.name.split('.').pop() || 'jpg';
  var nomeArquivo = 'produtos/' + produtoId + '-' + Date.now() + '.' + extensao;
  var { error } = await window.db.storage.from('imagens').upload(nomeArquivo, file, { upsert: true });
  if (error) throw error;
  var { data } = window.db.storage.from('imagens').getPublicUrl(nomeArquivo);
  return data.publicUrl;
}

async function salvarProduto() {
  var nome = document.getElementById('produto-nome').value.trim();
  var precocusto = parseFloat(document.getElementById('produto-custo').value) || 0;
  var precovenda = parseFloat(document.getElementById('produto-venda').value) || 0;
  var estoque = parseInt(document.getElementById('produto-estoque').value) || 0;
  var estoqueminimo = parseInt(document.getElementById('produto-estoque-min').value) || 5;
  var imagemInput = document.getElementById('produto-imagem');

  if (!nome) { showToast('Informe o nome do produto'); return; }
  if (precovenda <= 0) { showToast('Informe o preço de venda'); return; }

  var dados = { nome: nome, precocusto: precocusto, precovenda: precovenda, estoque: estoque, estoqueminimo: estoqueminimo };

  try {
    var produtoId = editingProdutoId;
    if (editingProdutoId) {
      var resUpd = await window.db.from('produtos').update(dados).eq('id', editingProdutoId);
      if (resUpd.error) throw new Error('DB: ' + resUpd.error.message);
    } else {
      var resIns = await window.db.from('produtos').insert([dados]).select().single();
      if (resIns.error) throw new Error('DB: ' + resIns.error.message);
      produtoId = resIns.data.id;
    }

    if (imagemInput.files && imagemInput.files[0]) {
      try {
        var imagemUrl = await uploadImagem(imagemInput.files[0], produtoId);
        await window.db.from('produtos').update({ imagem_url: imagemUrl }).eq('id', produtoId);
      } catch (imgErr) {
        console.warn('Foto falhou:', imgErr.message);
        showToast('Produto salvo! Mas a foto falhou — veja instruções no console.', 5000);
        closeModal('modal-produto');
        await carregarProdutos();
        return;
      }
    }

    showToast(editingProdutoId ? '✅ Produto atualizado!' : '✅ Produto cadastrado!');
    closeModal('modal-produto');
    await carregarProdutos();
  } catch (erro) {
    console.error('Erro salvarProduto:', erro.message);
    showToast('Erro: ' + erro.message, 6000);
  }
}

async function deletarProduto(id, nome) {
  if (!confirm('Excluir "' + nome + '"?')) return;
  try {
    var { error } = await window.db.from('produtos').delete().eq('id', id);
    if (error) throw error;
    showToast('Produto excluído');
    await carregarProdutos();
  } catch (erro) {
    console.error(erro);
    showToast('Erro ao excluir produto');
  }
}

// ============================================================
// ESTOQUE (ADMIN)
// ============================================================
function renderizarEstoque() {
  var alertasContainer = document.getElementById('alertas-estoque');
  var listaContainer = document.getElementById('lista-estoque');
  var baixos = produtos.filter(function (p) { return p.estoque <= (p.estoqueminimo || 5); });

  alertasContainer.innerHTML = baixos.length > 0
    ? '<div class="section-title">⚠️ Estoque Baixo</div>' +
      baixos.map(function (p) {
        var texto = p.estoque === 0 ? 'Estoque <strong>zerado!</strong>' : 'Restam <strong>' + p.estoque + '</strong> unidade' + (p.estoque !== 1 ? 's' : '') + '.';
        return '<div class="alerta"><strong>' + escaparHTML(p.nome) + '</strong>' + texto + '</div>';
      }).join('')
    : '';

  if (produtos.length === 0) {
    listaContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>Nenhum produto cadastrado</p></div>';
    return;
  }

  listaContainer.innerHTML = '<div class="section-title">Todos os Produtos</div>' +
    produtos.map(function (p) {
      var badgeClass = p.estoque === 0 ? 'estoque-zero' : p.estoque <= (p.estoqueminimo || 5) ? 'estoque-baixo' : 'estoque-ok';
      var imgHtml = p.imagem_url
        ? '<img src="' + p.imagem_url + '" class="estoque-img" alt="">'
        : '<div class="estoque-img-placeholder">🍫</div>';
      return (
        '<div class="estoque-item">' +
          imgHtml +
          '<div style="flex:1">' +
            '<div class="estoque-nome">' + escaparHTML(p.nome) + '</div>' +
            '<div class="estoque-info">Mínimo: ' + (p.estoqueminimo || 5) + ' un.</div>' +
          '</div>' +
          '<span class="estoque-badge ' + badgeClass + '">' + p.estoque + ' un.</span>' +
        '</div>'
      );
    }).join('');
}

// ============================================================
// MODAIS
// ============================================================
function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
  document.getElementById('overlay').classList.add('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(function (m) { m.classList.add('hidden'); });
  document.getElementById('overlay').classList.add('hidden');
}

// ============================================================
// UTILITÁRIOS
// ============================================================
function formatarDinheiro(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function escaparHTML(texto) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(String(texto || '')));
  return div.innerHTML;
}

function showToast(mensagem, duracao) {
  duracao = duracao || 3000;
  var existente = document.querySelector('.toast');
  if (existente) existente.remove();
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = mensagem;
  document.body.appendChild(toast);
  setTimeout(function () { if (toast.parentNode) toast.remove(); }, duracao);
}

function esconderLoading() {
  document.getElementById('loading').style.display = 'none';
}

function showError(mensagem) {
  document.getElementById('loading').innerHTML =
    '<div style="text-align:center;padding:24px;color:#ef4444;max-width:300px">' +
    '<div style="font-size:2.5rem;margin-bottom:14px">⚠️</div>' +
    '<p style="font-size:0.95rem;line-height:1.5">' + mensagem + '</p></div>';
}
