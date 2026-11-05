// ============================================================
// ESTADO
// ============================================================
let produtos = [];
let vendas = [];
let currentFilter = 'mes';
let mesSelecionado = ''; // 'AAAA-MM' do mês mostrado no painel (vazio = mês atual)
let graficoMeses = null;
let paymentStatus = 'dinheiro';
let pedidoPaymentStatus = 'dinheiro';
let editingProdutoId = null;
let nomeUsuario = '';
let modoAtual = ''; // 'admin' | 'cliente'
let produtoPedidoAtual = null;
let receberGrupos = [];
let carrinho = [];
let carrinhoPayment = 'dinheiro';
let privacidade = JSON.parse(localStorage.getItem('privacidade') || 'false');

// ============================================================
// INICIALIZAÇÃO
// ============================================================
window.addEventListener('load', async function () {
  if (!window.db) {
    showError('Banco de dados não configurado. Verifique o arquivo config.js.');
    return;
  }

  const hoje = dataLocalStr(new Date());
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
      carregarNomesClientes();
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
    carregarNomesClientes();
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
  var nome = document.getElementById('input-nome-usuario').value.trim().replace(/\s+/g, ' ');
  if (!nome) { showToast('Digite seu nome para continuar'); return; }
  nome = confirmarNomeParecido(nome, 'Você é "{nome}"?\n\nOK = sim, sou eu\nCancelar = não, sou outra pessoa');
  nomeUsuario = nome;
  localStorage.setItem('nomeUsuario', nome);
  localStorage.setItem('appModo', 'cliente');
  document.getElementById('tela-nome-cliente').classList.add('hidden');
  iniciarModoCliente();
}

// Reaproveita a grafia já usada em vendas anteriores para o mesmo nome
// (ignorando maiúsculas/espaços), evitando duplicar o cliente com nomes diferentes
function resolverNomeCliente(nomeDigitado) {
  var nome = (nomeDigitado || '').trim().replace(/\s+/g, ' ');
  if (!nome) return nome;
  var existente = vendas.find(function (v) {
    return normalizarNome(v.nomecomprador) === normalizarNome(nome);
  });
  return existente ? existente.nomecomprador : nome;
}

// ============================================================
// SUGESTÃO DE NOMES (evita cadastrar a mesma cliente com outro nome)
// ============================================================
var nomesClientes = []; // nomes já usados em vendas, sem repetição

function normalizarNome(n) {
  return (n || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

function montarNomesClientes(lista) {
  var vistos = {};
  var nomes = [];
  lista.forEach(function (n) {
    n = (n || '').trim();
    var chave = normalizarNome(n);
    if (n && !vistos[chave]) { vistos[chave] = true; nomes.push(n); }
  });
  nomes.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  nomesClientes = nomes;
}

// Na tela de nome da cliente as vendas ainda não foram carregadas: busca só os nomes
async function carregarNomesClientes() {
  if (!window.db) return;
  var { data, error } = await window.db.from('vendas').select('nomecomprador');
  if (error) { console.error(error); return; }
  montarNomesClientes((data || []).map(function (v) { return v.nomecomprador; }));
}

function sugestoesNome(texto) {
  var t = normalizarNome(texto);
  if (t.length < 2) return [];
  return nomesClientes.filter(function (n) {
    var c = normalizarNome(n);
    if (c === t) return false;
    return c.startsWith(t) || c.split(' ').some(function (p) { return p.startsWith(t); });
  }).slice(0, 5);
}

// Nome digitado que é só o começo de um nome já salvo (ex.: "Lidiane" → "Lidiane Laborda")
function nomeParecido(texto) {
  var t = normalizarNome(texto);
  if (!t) return null;
  if (nomesClientes.some(function (n) { return normalizarNome(n) === t; })) return null;
  var candidatos = nomesClientes.filter(function (n) {
    return normalizarNome(n).startsWith(t + ' ');
  });
  return candidatos.length === 1 ? candidatos[0] : null;
}

function mostrarSugestoesNome(input, boxId) {
  var box = document.getElementById(boxId);
  if (!box) return;
  var lista = sugestoesNome(input.value);
  if (lista.length === 0) { box.innerHTML = ''; box.classList.add('hidden'); return; }
  box.innerHTML = '<span class="sugestoes-nome-label">Já cadastrado:</span>' +
    lista.map(function (n, i) {
      return '<button type="button" class="sugestao-nome-chip" data-i="' + i + '">' + escaparHTML(n) + '</button>';
    }).join('');
  box.querySelectorAll('.sugestao-nome-chip').forEach(function (btn) {
    btn.onclick = function () {
      input.value = lista[parseInt(btn.dataset.i)];
      box.innerHTML = '';
      box.classList.add('hidden');
      input.focus();
    };
  });
  box.classList.remove('hidden');
}

// ============================================================
// EDITAR / JUNTAR NOME DE CLIENTE
// ============================================================
function ligarBotoesEditarNome(container) {
  container.querySelectorAll('.btn-editar-nome').forEach(function (btn) {
    btn.onclick = function (e) {
      e.stopPropagation();
      renomearCliente(btn.dataset.nome);
    };
  });
}

// Troca o nome em todas as vendas da cliente. Se o novo nome já existir,
// as compras das duas passam a ficar juntas no mesmo nome.
async function renomearCliente(nomeAtual) {
  var digitado = prompt('Novo nome para "' + nomeAtual + '":\n\n(Se escrever o nome de outra cliente já cadastrada, as compras das duas ficam juntas.)', nomeAtual);
  if (digitado === null) return;
  var novo = digitado.trim().replace(/\s+/g, ' ');
  if (!novo || novo === nomeAtual) return;

  var chaveAtual = normalizarNome(nomeAtual);
  var existente = vendas.find(function (v) {
    var n = normalizarNome(v.nomecomprador);
    return n === normalizarNome(novo) && n !== chaveAtual;
  });
  if (existente) {
    novo = existente.nomecomprador;
    if (!confirm('Já existe "' + novo + '".\n\nJuntar todas as compras de "' + nomeAtual + '" com "' + novo + '"?')) return;
  }

  // Todas as grafias desse nome (maiúsculas, acentos, espaços) mudam juntas
  var variantes = [];
  vendas.forEach(function (v) {
    if (v.nomecomprador && normalizarNome(v.nomecomprador) === chaveAtual && variantes.indexOf(v.nomecomprador) === -1) {
      variantes.push(v.nomecomprador);
    }
  });
  if (variantes.length === 0) return;

  var { error } = await window.db.from('vendas').update({ nomecomprador: novo }).in('nomecomprador', variantes);
  if (error) { console.error(error); showToast('Erro ao trocar o nome'); return; }
  showToast(existente ? '✅ Compras juntadas em "' + novo + '"' : '✅ Nome trocado para "' + novo + '"');
  await carregarVendas();
  if (document.getElementById('page-receber').classList.contains('active')) renderizarReceber();
}

function confirmarNomeParecido(nome, pergunta) {
  var parecido = nomeParecido(nome);
  if (parecido && confirm(pergunta.replace('{nome}', parecido))) return parecido;
  return nome;
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
  var btnPriv = document.getElementById('btn-privacidade');
  btnPriv.classList.remove('hidden');
  btnPriv.textContent = privacidade ? '🙈' : '👁';
  await carregarDados();
  navigate('venda');
}

function togglePrivacidade() {
  privacidade = !privacidade;
  localStorage.setItem('privacidade', JSON.stringify(privacidade));
  document.getElementById('btn-privacidade').textContent = privacidade ? '🙈' : '👁';
  renderizarDashboard();
  renderizarAnaliseProdutos();
  updateVendaPreview();
}

// ============================================================
// MODO CLIENTE
// ============================================================
async function iniciarModoCliente() {
  modoAtual = 'cliente';
  document.getElementById('nav-cliente').classList.remove('hidden');
  document.getElementById('btn-sair').classList.remove('hidden');
  document.getElementById('page-icon').textContent = '🛍️';

  // Mostra página da loja e esconde admin pages
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  document.getElementById('page-loja').classList.add('active');

  await carregarDados();

  // Se já existe uma venda com esse nome grafado de outro jeito, usa a mesma grafia
  var nomeResolvido = resolverNomeCliente(nomeUsuario);
  // Cliente salva com nome curto (ex.: "Lidiane") quando já existe o nome completo
  // (pergunta uma vez só: se ela disser que é outra pessoa, não pergunta de novo)
  montarNomesClientes(vendas.map(function (v) { return v.nomecomprador; }));
  if (localStorage.getItem('nomeConfirmado') !== nomeResolvido) {
    var antes = nomeResolvido;
    nomeResolvido = confirmarNomeParecido(nomeResolvido, 'Você é "{nome}"?\n\nOK = sim, sou eu\nCancelar = não, sou outra pessoa');
    if (nomeResolvido === antes) localStorage.setItem('nomeConfirmado', antes);
  }
  if (nomeResolvido !== nomeUsuario) {
    nomeUsuario = nomeResolvido;
    localStorage.setItem('nomeUsuario', nomeUsuario);
  }
  document.getElementById('page-title').textContent = 'Olá, ' + nomeUsuario + '!';
}

function navegarCliente(pagina) {
  var titulos = { loja: 'Loja', carrinho: 'Meu Carrinho', 'meus-pedidos': 'Meus Pedidos' };
  var icones = { loja: '🛍️', carrinho: '🛒', 'meus-pedidos': '📋' };

  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  document.getElementById('page-' + pagina).classList.add('active');

  document.querySelectorAll('#nav-cliente .nav-btn').forEach(function (b) { b.classList.remove('active'); });
  document.getElementById('nav-cli-' + pagina).classList.add('active');

  document.getElementById('page-title').textContent = titulos[pagina];
  document.getElementById('page-icon').textContent = icones[pagina];

  if (pagina === 'meus-pedidos') renderizarMeusPedidos();
  if (pagina === 'carrinho') renderizarCarrinho();
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
  // Busca todas as vendas, de 1000 em 1000 (limite por requisição do Supabase)
  var todas = [];
  var passo = 1000;
  for (var inicio = 0; ; inicio += passo) {
    var { data, error } = await window.db.from('vendas').select('*')
      .order('data', { ascending: false }).order('id')
      .range(inicio, inicio + passo - 1);
    if (error) { console.error(error); showToast('Erro ao carregar vendas'); return; }
    todas = todas.concat(data || []);
    if (!data || data.length < passo) break;
  }
  vendas = todas;
  if (modoAtual === 'admin') {
    renderizarDashboard();
    renderizarAnaliseProdutos();
    atualizarListaClientes();
  }
}

function atualizarListaClientes() {
  montarNomesClientes(vendas.map(function (v) { return v.nomecomprador; }));
  var datalist = document.getElementById('clientes-lista');
  if (!datalist) return;
  var vistos = {};
  var nomes = [];
  vendas.forEach(function (v) {
    var nome = (v.nomecomprador || '').trim();
    var chave = nome.toLowerCase();
    if (nome && !vistos[chave]) { vistos[chave] = true; nomes.push(nome); }
  });
  nomes.sort();
  datalist.innerHTML = nomes.map(function(n) { return '<option value="' + escaparHTML(n) + '">'; }).join('');
}

// ============================================================
// CATÁLOGO (CLIENTE)
// ============================================================
function renderizarCatalogo() {
  var container = document.getElementById('catalogo-produtos');
  var disponiveis = produtos.filter(function (p) { return p.estoque > 0 && !p.oculto; });

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

  var totalGeral = meusPedidos.reduce(function (s, v) { return s + (parseFloat(v.total) || 0); }, 0);
  var totalPendente = meusPedidos.filter(function (v) { return !v.recebido; }).reduce(function (s, v) { return s + (parseFloat(v.total) || 0); }, 0);

  var resumoHtml =
    '<div class="pedidos-resumo">' +
      '<div class="pedidos-resumo-item">' +
        '<span class="pedidos-resumo-label">Total de pedidos</span>' +
        '<span class="pedidos-resumo-valor">' + formatarDinheiro(totalGeral) + '</span>' +
      '</div>' +
      (totalPendente > 0
        ? '<div class="pedidos-resumo-item pedidos-resumo-pendente">' +
            '<span class="pedidos-resumo-label">💰 A pagar</span>' +
            '<span class="pedidos-resumo-valor">' + formatarDinheiro(totalPendente) + '</span>' +
          '</div>' +
          '<button class="btn-primary" onclick="togglePagarPendente()">📱 Pagar agora</button>' +
          '<div class="pix-info hidden" id="meus-pedidos-pix-info">' +
            '<div class="pix-info-titulo">Chave PIX para pagar:</div>' +
            '<div class="pix-key" onclick="copiarPix()">' + (window.PIX_KEY || '') + '</div>' +
            '<div class="pix-copy-hint">Toque para copiar</div>' +
          '</div>'
        : '') +
    '</div>';

  container.innerHTML = resumoHtml + '<div class="section-title">Seus Pedidos</div>' +
    meusPedidos.map(function (v) {
      var partes = v.data.split('-');
      var dataStr = partes[2] + '/' + partes[1];
      var badgeInfo = {
        dinheiro: { classe: 'badge-pago', texto: '💵 Dinheiro' },
        pix:      { classe: 'badge-pago', texto: '📱 PIX' },
        credito:  { classe: 'badge-pago', texto: '💳 Crédito' },
        prazo:    { classe: 'badge-prazo', texto: '💰 Quando Receber' }
      };
      var badge = v.recebido
        ? { classe: 'badge-pago', texto: '✅ Pago' }
        : (badgeInfo[v.status] || badgeInfo['prazo']);
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

function togglePagarPendente() {
  document.getElementById('meus-pedidos-pix-info').classList.toggle('hidden');
}

// Modal pedido (cliente)
function abrirModalPedido(produtoId) {
  produtoPedidoAtual = produtos.find(function (p) { return p.id === produtoId; });
  if (!produtoPedidoAtual) return;

  document.getElementById('modal-pedido-titulo').textContent = produtoPedidoAtual.nome;
  document.getElementById('pedido-qty').value = '1';
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
  var pixInfo = document.getElementById('pedido-pix-info');
  if (status === 'pix') {
    document.getElementById('pedido-pix-chave').textContent = window.PIX_KEY || '';
    pixInfo.classList.remove('hidden');
  } else {
    pixInfo.classList.add('hidden');
  }
}

function copiarPix() {
  var chave = window.PIX_KEY || '';
  if (!chave) return;
  navigator.clipboard.writeText(chave).then(function () {
    showToast('✅ Chave PIX copiada!');
  }).catch(function () {
    showToast('Chave PIX: ' + chave, 5000);
  });
}

function updatePedidoPreview() {
  if (!produtoPedidoAtual) return;
  var qty = parseInt(document.getElementById('pedido-qty').value) || 1;
  var total = parseFloat(produtoPedidoAtual.precovenda) * qty;
  document.getElementById('pedido-preview-total').textContent = formatarDinheiro(total);
}

function adicionarAoCarrinho() {
  if (!produtoPedidoAtual) return;
  var qty = parseInt(document.getElementById('pedido-qty').value) || 1;

  if (produtoPedidoAtual.estoque < qty) {
    showToast('Estoque insuficiente! Disponível: ' + produtoPedidoAtual.estoque);
    return;
  }

  var existente = carrinho.find(function (i) { return i.produto.id === produtoPedidoAtual.id; });
  if (existente) {
    existente.quantidade += qty;
  } else {
    carrinho.push({ produto: Object.assign({}, produtoPedidoAtual), quantidade: qty });
  }

  atualizarBadgeCarrinho();
  closeModal('modal-pedido');
  showToast('🛒 Adicionado! Veja o carrinho para finalizar.');
}

function atualizarBadgeCarrinho() {
  var total = carrinho.reduce(function (s, i) { return s + i.quantidade; }, 0);
  var badge = document.getElementById('carrinho-badge');
  if (!badge) return;
  badge.textContent = total;
  if (total > 0) badge.classList.remove('hidden');
  else badge.classList.add('hidden');
}

function renderizarCarrinho() {
  var vazio = document.getElementById('carrinho-vazio');
  var conteudo = document.getElementById('carrinho-conteudo');

  if (carrinho.length === 0) {
    vazio.classList.remove('hidden');
    conteudo.classList.add('hidden');
    return;
  }

  vazio.classList.add('hidden');
  conteudo.classList.remove('hidden');

  var totalGeral = 0;
  document.getElementById('lista-carrinho').innerHTML = carrinho.map(function (item, idx) {
    var subtotal = parseFloat(item.produto.precovenda) * item.quantidade;
    totalGeral += subtotal;
    var imgHtml = item.produto.imagem_url
      ? '<img src="' + item.produto.imagem_url + '" class="carrinho-item-img" alt="">'
      : '<div class="carrinho-item-placeholder">🍫</div>';
    return (
      '<div class="carrinho-item">' +
        imgHtml +
        '<div class="carrinho-item-info">' +
          '<div class="carrinho-item-nome">' + escaparHTML(item.produto.nome) + '</div>' +
          '<div class="carrinho-item-preco">' + formatarDinheiro(item.produto.precovenda) + ' cada</div>' +
        '</div>' +
        '<div class="carrinho-item-dir">' +
          '<div class="qty-control">' +
            '<button class="qty-btn" onclick="alterarQtdCarrinho(' + idx + ',-1)">−</button>' +
            '<span class="carrinho-qty">' + item.quantidade + '</span>' +
            '<button class="qty-btn" onclick="alterarQtdCarrinho(' + idx + ',1)">+</button>' +
          '</div>' +
          '<div class="carrinho-subtotal">' + formatarDinheiro(subtotal) + '</div>' +
          '<button class="btn-excluir-venda" onclick="removerDoCarrinho(' + idx + ')">🗑</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  document.getElementById('carrinho-total').textContent = formatarDinheiro(totalGeral);
}

function alterarQtdCarrinho(idx, delta) {
  var item = carrinho[idx];
  if (!item) return;
  var nova = item.quantidade + delta;
  if (nova <= 0) { removerDoCarrinho(idx); return; }
  if (nova > item.produto.estoque) { showToast('Máximo disponível: ' + item.produto.estoque); return; }
  item.quantidade = nova;
  atualizarBadgeCarrinho();
  renderizarCarrinho();
}

function removerDoCarrinho(idx) {
  carrinho.splice(idx, 1);
  atualizarBadgeCarrinho();
  renderizarCarrinho();
}

function setCarrinhoPayment(status) {
  carrinhoPayment = status;
  ['dinheiro', 'pix', 'credito', 'prazo'].forEach(function (s) {
    document.getElementById('carr-btn-' + s).className = 'pay-btn' + (status === s ? ' pay-btn-active' : '');
  });
  var pixInfo = document.getElementById('carrinho-pix-info');
  if (status === 'pix') {
    document.getElementById('carrinho-pix-chave').textContent = window.PIX_KEY || '';
    pixInfo.classList.remove('hidden');
  } else {
    pixInfo.classList.add('hidden');
  }
}

async function confirmarCarrinho() {
  if (carrinho.length === 0) return;
  var btn = document.getElementById('btn-confirmar-carrinho');
  var hoje = dataLocalStr(new Date());
  var totalGeral = 0;

  for (var i = 0; i < carrinho.length; i++) {
    if (carrinho[i].produto.estoque < carrinho[i].quantidade) {
      showToast('Estoque insuficiente para ' + carrinho[i].produto.nome);
      return;
    }
  }

  try {
    btn.disabled = true;
    btn.textContent = 'Confirmando...';

    for (var i = 0; i < carrinho.length; i++) {
      var item = carrinho[i];
      var preco = parseFloat(item.produto.precovenda);
      var custo = parseFloat(item.produto.precocusto);
      var itemTotal = preco * item.quantidade;
      totalGeral += itemTotal;

      var { error: ve } = await window.db.from('vendas').insert([{
        produtoid: item.produto.id,
        produtonome: item.produto.nome,
        quantidade: item.quantidade,
        precovenda: preco,
        precocusto: custo,
        status: carrinhoPayment,
        recebido: false,
        data: hoje,
        total: itemTotal,
        lucro: (preco - custo) * item.quantidade,
        nomecomprador: nomeUsuario
      }]);
      if (ve) throw ve;

      var { error: se } = await window.db.from('produtos')
        .update({ estoque: item.produto.estoque - item.quantidade }).eq('id', item.produto.id);
      if (se) throw se;
    }

    showToast('✅ Pedido confirmado! Total: ' + formatarDinheiro(totalGeral));
    carrinho = [];
    carrinhoPayment = 'dinheiro';
    atualizarBadgeCarrinho();
    await carregarDados();
    navegarCliente('meus-pedidos');

  } catch (erro) {
    console.error(erro);
    showToast('Erro ao confirmar pedido. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Confirmar Pedido';
  }
}

// ============================================================
// NAVEGAÇÃO ADMIN
// ============================================================
var paginaConfig = {
  dashboard: { titulo: 'Dashboard',  icone: '📊' },
  venda:     { titulo: 'Nova Venda', icone: '🛒' },
  receber:   { titulo: 'A Receber',  icone: '💰' },
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

  if (pagina === 'receber') renderizarReceber();
}

// ============================================================
// DASHBOARD
// ============================================================
var NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function mesAtualStr() { return dataLocalStr(new Date()).substring(0, 7); }

// Soma (ou subtrai) meses de um 'AAAA-MM'
function somarMes(mesStr, delta) {
  var partes = mesStr.split('-');
  var d = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1 + delta, 1);
  return dataLocalStr(d).substring(0, 7);
}

function nomeMes(mesStr, curto) {
  var partes = mesStr.split('-');
  var nome = NOMES_MESES[parseInt(partes[1]) - 1];
  return curto ? nome.substring(0, 3) : nome + ' ' + partes[0];
}

function mudarMes(delta) {
  var novo = somarMes(mesSelecionado || mesAtualStr(), delta);
  if (novo > mesAtualStr()) return;
  mesSelecionado = novo;
  setFilter('mes');
}

function setFilter(filtro) {
  currentFilter = filtro;
  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.filter === filtro);
  });
  renderizarDashboard();
}

// Data no fuso do aparelho (toISOString usa UTC e virava o dia às 20h em Manaus)
function dataLocalStr(d) {
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var dia = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + dia;
}

function dataCaiNoFiltro(dataStr, filtro) {
  if (filtro === 'tudo') return true;
  if (!dataStr) return false;
  var agora = new Date();
  var hojeStr = dataLocalStr(agora);
  if (filtro === 'hoje') return dataStr === hojeStr;
  if (filtro === 'semana') {
    var semanaAtras = new Date(agora);
    semanaAtras.setDate(semanaAtras.getDate() - 6);
    return dataStr >= dataLocalStr(semanaAtras);
  }
  return dataStr.startsWith(mesSelecionado || hojeStr.substring(0, 7));
}

function getVendasFiltradas() {
  return vendas.filter(function (v) { return dataCaiNoFiltro(v.data, currentFilter); });
}

// Vendas recebidas dentro do período, pela data em que o pagamento foi confirmado
// (não pela data da venda) — assim uma venda "a prazo" antiga que foi paga hoje
// aparece em "Hoje", mesmo tendo sido vendida em outro dia.
function getVendasRecebidasNoPeriodo() {
  return vendas.filter(function (v) {
    if (!v.recebido) return false;
    return dataCaiNoFiltro(v.data_recebimento || v.data, currentFilter);
  });
}

// Agrupa as vendas não pagas por cliente (mesma regra da tela "A Receber")
function agruparDevedores() {
  var mapa = {};
  vendas.forEach(function (v) {
    if (v.recebido) return;
    var nome = (v.nomecomprador || 'Sem nome').trim();
    var chave = normalizarNome(nome);
    if (!mapa[chave]) mapa[chave] = { nome: nome, total: 0, qtd: 0 };
    mapa[chave].total += parseFloat(v.total) || 0;
    mapa[chave].qtd++;
  });
  return Object.values(mapa).sort(function (a, b) { return b.total - a.total; });
}

// Totais por mês: vendido e lucro pela data da venda, recebido pela data do pagamento
function totaisPorMes(qtdMeses) {
  var fim = mesAtualStr();
  var meses = [];
  for (var i = qtdMeses - 1; i >= 0; i--) meses.push(somarMes(fim, -i));
  var t = {};
  meses.forEach(function (m) { t[m] = { vendido: 0, recebido: 0, lucro: 0 }; });
  vendas.forEach(function (v) {
    var mv = (v.data || '').substring(0, 7);
    if (t[mv]) { t[mv].vendido += parseFloat(v.total) || 0; t[mv].lucro += parseFloat(v.lucro) || 0; }
    if (v.recebido) {
      var mr = (v.data_recebimento || v.data || '').substring(0, 7);
      if (t[mr]) t[mr].recebido += parseFloat(v.total) || 0;
    }
  });
  return { meses: meses, totais: t };
}

function renderizarGraficoMeses() {
  var canvas = document.getElementById('grafico-meses');
  if (!canvas || typeof Chart === 'undefined') return;
  var dados = totaisPorMes(6);
  var serie = function (campo) {
    return dados.meses.map(function (m) { return Math.round(dados.totais[m][campo] * 100) / 100; });
  };
  var config = {
    type: 'bar',
    data: {
      labels: dados.meses.map(function (m) { return nomeMes(m, true); }),
      datasets: [
        { label: 'Vendi', data: serie('vendido'), backgroundColor: '#2a78d6', borderRadius: 4, maxBarThickness: 14 },
        { label: 'Recebi', data: serie('recebido'), backgroundColor: '#1baf7a', borderRadius: 4, maxBarThickness: 14 },
        { label: 'Lucro', data: serie('lucro'), backgroundColor: '#eda100', borderRadius: 4, maxBarThickness: 14 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + (privacidade ? '• • •' : formatarDinheiro(c.raw)); } } }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#ece9f5' }, ticks: { display: !privacidade, callback: function (v) { return 'R$ ' + v; } } }
      }
    }
  };
  if (graficoMeses) graficoMeses.destroy();
  graficoMeses = new Chart(canvas, config);
}

function renderizarDevedoresDashboard() {
  var box = document.getElementById('dash-devedores');
  if (!box) return;
  var grupos = agruparDevedores();
  if (grupos.length === 0) {
    box.innerHTML = '<div class="dash-vazio">Ninguém está devendo 🎉</div>';
    return;
  }
  var top = grupos.slice(0, 5);
  box.innerHTML = top.map(function (g) {
    return (
      '<div class="devedor-linha">' +
        '<span class="devedor-nome">' + escaparHTML(g.nome) + '</span>' +
        '<span class="devedor-valor">' + (privacidade ? '• • •' : formatarDinheiro(g.total)) + '</span>' +
        '<button class="btn-editar-nome" data-nome="' + escaparAttr(g.nome) + '" aria-label="Editar nome">✏️</button>' +
      '</div>'
    );
  }).join('') +
  '<button class="devedor-ver-todos" onclick="navigate(\'receber\')">Ver todos (' + grupos.length + ') ›</button>';
  ligarBotoesEditarNome(box);
}

function renderizarDashboard() {
  // Navegação de mês só aparece no filtro "Mês"
  var mesMostrado = mesSelecionado || mesAtualStr();
  document.getElementById('mes-nav').classList.toggle('hidden', currentFilter !== 'mes');
  document.getElementById('mes-nav-titulo').textContent = nomeMes(mesMostrado);
  document.getElementById('mes-nav-prox').style.visibility = mesMostrado >= mesAtualStr() ? 'hidden' : 'visible';

  var filtradas = getVendasFiltradas();
  var totalVendido = 0, lucro = 0;

  filtradas.forEach(function (v) {
    totalVendido += parseFloat(v.total) || 0;
    lucro += parseFloat(v.lucro) || 0;
  });

  var recebidasPeriodo = getVendasRecebidasNoPeriodo();
  var recebido = recebidasPeriodo.reduce(function (s, v) { return s + (parseFloat(v.total) || 0); }, 0);

  // "Falta receber" é sempre o total em aberto, de qualquer mês
  var devedores = agruparDevedores();
  var aReceber = devedores.reduce(function (s, g) { return s + g.total; }, 0);

  var mascarar = function(v) { return privacidade ? '• • • •' : formatarDinheiro(v); };
  document.getElementById('dash-total-vendido').textContent = mascarar(totalVendido);
  document.getElementById('dash-recebido').textContent = mascarar(recebido);
  document.getElementById('dash-a-receber').textContent = mascarar(aReceber);
  document.getElementById('dash-lucro').textContent = mascarar(lucro);
  document.getElementById('dash-qtd-vendas').textContent = filtradas.length + (filtradas.length === 1 ? ' venda' : ' vendas');
  document.getElementById('dash-margem').textContent = totalVendido > 0
    ? 'margem ' + Math.round(100 * lucro / totalVendido) + '%'
    : 'margem —';
  document.getElementById('dash-a-receber-sub').textContent = devedores.length === 0
    ? 'tudo recebido'
    : devedores.length + (devedores.length === 1 ? ' pessoa' : ' pessoas') + ', todos os meses';

  renderizarGraficoMeses();
  renderizarDevedoresDashboard();

  var tituloPeriodo = { hoje: 'Recebidos hoje', semana: 'Recebidos na semana', mes: 'Recebidos em ' + nomeMes(mesMostrado), tudo: 'Todos os recebidos' };
  document.getElementById('dash-recebidos-titulo').textContent = tituloPeriodo[currentFilter] || 'Recebidos no período';

  var containerRecebidos = document.getElementById('dash-recebidos-periodo');
  if (recebidasPeriodo.length === 0) {
    containerRecebidos.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div><p>Ninguém pagou neste período ainda</p></div>';
  } else {
    containerRecebidos.innerHTML = recebidasPeriodo.map(function (v) {
      var partes = v.data.split('-');
      var dataVendaStr = partes[2] + '/' + partes[1];
      return (
        '<div class="venda-item">' +
          '<div class="venda-item-left">' +
            '<div class="venda-nome">' + escaparHTML(v.produtonome) + '</div>' +
            '<div class="venda-info">' + v.quantidade + 'x &bull; vendido ' + dataVendaStr +
              (v.nomecomprador ? ' &bull; ' + escaparHTML(v.nomecomprador) : '') + '</div>' +
          '</div>' +
          '<div class="venda-item-right">' +
            '<div class="venda-valor">' + formatarDinheiro(v.total) + '</div>' +
            '<span class="badge badge-pago">✅ Pago</span>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  var container = document.getElementById('dash-ultimas-vendas');
  var limite = currentFilter === 'tudo' ? 50 : filtradas.length;
  var recentes = filtradas.slice(0, limite);

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
    var badge = v.recebido
      ? { classe: 'badge-pago', texto: '✅ Pago' }
      : (badgeInfo[v.status] || badgeInfo['prazo']);
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
          '<button class="btn-excluir-venda" onclick="deletarVenda(\'' + v.id + '\',\'' + escaparHTML(v.produtonome) + '\',' + v.quantidade + ',\'' + v.produtoid + '\')">🗑</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

async function deletarVenda(vendaId, produtoNome, quantidade, produtoId) {
  if (!confirm('Excluir venda de "' + produtoNome + '"?\nO estoque será devolvido.')) return;
  try {
    var { error: delError } = await window.db.from('vendas').delete().eq('id', vendaId);
    if (delError) throw delError;

    // Devolve ao estoque
    var produto = produtos.find(function (p) { return p.id === produtoId; });
    if (produto) {
      await window.db.from('produtos').update({ estoque: produto.estoque + quantidade }).eq('id', produtoId);
    }

    showToast('🗑 Venda excluída e estoque devolvido');
    await carregarDados();
  } catch (erro) {
    console.error(erro);
    showToast('Erro ao excluir venda');
  }
}

// ============================================================
// NOVA VENDA (ADMIN)
// ============================================================
var vendaProdutoId = null;

function atualizarSelectVenda() {
  var grid = document.getElementById('venda-produtos-grid');
  if (!grid) return;

  if (produtos.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🍫</div><p>Nenhum produto cadastrado</p></div>';
    return;
  }

  grid.innerHTML = '<div class="catalogo-grid">' +
    produtos.map(function (p) {
      var semEstoque = p.estoque === 0;
      var imgHtml = p.imagem_url
        ? '<img src="' + p.imagem_url + '" class="catalogo-card-img" alt="">'
        : '<div class="catalogo-card-placeholder">🍫</div>';
      return (
        '<div class="catalogo-card venda-card' + (semEstoque ? ' venda-card-sem-estoque' : '') + '" ' +
          (semEstoque ? '' : 'onclick="selecionarProdutoVenda(\'' + p.id + '\')"') +
          ' id="venda-card-' + p.id + '">' +
          imgHtml +
          '<div class="catalogo-card-info">' +
            '<div class="catalogo-card-nome">' + escaparHTML(p.nome) + '</div>' +
            '<div class="catalogo-card-preco">' + formatarDinheiro(p.precovenda) + '</div>' +
            '<div class="catalogo-card-estoque">' + (semEstoque ? '❌ Sem estoque' : p.estoque + ' disponíveis') + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('') +
  '</div>';
}

function selecionarProdutoVenda(produtoId) {
  vendaProdutoId = produtoId;
  var produto = produtos.find(function (p) { return p.id === produtoId; });
  if (!produto) return;

  document.querySelectorAll('.venda-card').forEach(function (c) { c.classList.remove('venda-card-ativo'); });
  var card = document.getElementById('venda-card-' + produtoId);
  if (card) card.classList.add('venda-card-ativo');

  var imgHtml = produto.imagem_url
    ? '<img src="' + produto.imagem_url + '" class="pedido-produto-img" alt="">'
    : '<div class="pedido-produto-placeholder">🍫</div>';

  document.getElementById('venda-produto-selecionado').innerHTML =
    imgHtml +
    '<div>' +
      '<div class="pedido-produto-nome">' + escaparHTML(produto.nome) + '</div>' +
      '<div class="pedido-produto-preco">' + formatarDinheiro(produto.precovenda) + ' cada &bull; ' + produto.estoque + ' em estoque</div>' +
    '</div>';
  document.getElementById('venda-produto-selecionado').classList.remove('hidden');
  document.getElementById('venda-form-detalhes').classList.remove('hidden');

  document.getElementById('venda-qty').value = '1';
  updateVendaPreview();
  document.getElementById('venda-form-detalhes').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  var qty = parseInt(document.getElementById('venda-qty').value) || 0;
  if (!vendaProdutoId || qty <= 0) { document.getElementById('venda-preview').classList.add('hidden'); return; }
  var produto = produtos.find(function (p) { return p.id === vendaProdutoId; });
  if (!produto) return;
  document.getElementById('preview-total').textContent = formatarDinheiro(parseFloat(produto.precovenda) * qty);
  document.getElementById('venda-preview').classList.remove('hidden');
}

async function registrarVenda() {
  var produtoId = vendaProdutoId;
  var qty = parseInt(document.getElementById('venda-qty').value) || 0;
  var dataStr = document.getElementById('venda-data').value;
  var nomeCliente = resolverNomeCliente(document.getElementById('venda-cliente').value);

  if (!produtoId) { showToast('Selecione um produto'); return; }
  if (qty <= 0)   { showToast('Informe uma quantidade válida'); return; }
  if (!nomeCliente) { showToast('Informe o nome do cliente'); return; }
  nomeCliente = confirmarNomeParecido(nomeCliente, 'Já existe a cliente "{nome}".\n\nOK = usar esse nome\nCancelar = é outra pessoa');

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
    recebido: false,
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
    vendaProdutoId = null;
    document.getElementById('venda-qty').value = '1';
    document.getElementById('venda-cliente').value = '';
    document.getElementById('venda-preview').classList.add('hidden');
    document.getElementById('venda-form-detalhes').classList.add('hidden');
    document.getElementById('venda-produto-selecionado').classList.add('hidden');
    document.querySelectorAll('.venda-card').forEach(function (c) { c.classList.remove('venda-card-ativo'); });
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
// ============================================================
// ANÁLISE DE PRODUTOS E SUGESTÃO DE PREÇO
// ============================================================
var MARGEM_BAIXA = 30; // abaixo disso (%) o produto entra em "precisam de atenção"

function margemPct(precovenda, precocusto) {
  var pv = parseFloat(precovenda) || 0, pc = parseFloat(precocusto) || 0;
  return pv > 0 ? Math.round(100 * (pv - pc) / pv) : 0;
}

function renderizarAnaliseProdutos() {
  var box = document.getElementById('produtos-analise');
  if (!box || produtos.length === 0) { if (box) box.innerHTML = ''; return; }

  // Lucro total já ganho com cada produto (pelas vendas)
  var lucroPorProduto = {};
  vendas.forEach(function (v) {
    var chave = v.produtoid || v.produtonome;
    lucroPorProduto[chave] = (lucroPorProduto[chave] || 0) + (parseFloat(v.lucro) || 0);
  });

  var lista = produtos.map(function (p) {
    return { p: p, lucro: lucroPorProduto[p.id] || 0, margem: margemPct(p.precovenda, p.precocusto) };
  });

  var melhores = lista.filter(function (x) { return x.lucro > 0; })
    .sort(function (a, b) { return b.lucro - a.lucro; }).slice(0, 5);
  var atencao = lista.filter(function (x) { return x.margem < MARGEM_BAIXA; })
    .sort(function (a, b) { return a.margem - b.margem; });

  var pill = function (m) {
    var cls = m < 0 ? 'pill-ruim' : m < MARGEM_BAIXA ? 'pill-atencao' : 'pill-bom';
    var txt = m < 0 ? 'prejuízo' : m + '%';
    return '<span class="pill-margem ' + cls + '">' + txt + '</span>';
  };
  var linha = function (x, direita) {
    return '<div class="devedor-linha"><span class="devedor-nome">' + escaparHTML(x.p.nome) +
      (x.p.oculto ? ' <small class="texto-suave">(oculto)</small>' : '') + '</span>' + direita + '</div>';
  };

  var html = '';
  if (melhores.length) {
    html += '<div class="dash-bloco"><div class="dash-bloco-titulo">Os que mais dão lucro</div>' +
      melhores.map(function (x) {
        return linha(x, '<span class="devedor-valor">' + (privacidade ? '• • •' : formatarDinheiro(x.lucro)) + ' ' + pill(x.margem) + '</span>');
      }).join('') + '</div>';
  }
  if (atencao.length) {
    html += '<div class="dash-bloco"><div class="dash-bloco-titulo">Precisam de atenção <small class="texto-suave">(margem abaixo de ' + MARGEM_BAIXA + '%)</small></div>' +
      atencao.map(function (x) {
        return linha(x, '<span class="devedor-valor">' + pill(x.margem) +
          ' <button class="btn-link" onclick="openProdutoModal(\'' + x.p.id + '\')">ajustar</button></span>');
      }).join('') + '</div>';
  }
  box.innerHTML = html;
}

// Preço para atingir a margem desejada, arredondado para cima em R$ 0,50
function precoParaMargem(custo, margem) {
  if (!(custo > 0) || margem >= 100) return 0;
  return Math.ceil((custo / (1 - margem / 100)) * 2) / 2;
}

function atualizarSugestaoPreco() {
  var box = document.getElementById('sugestao-preco');
  var custo = parseFloat(document.getElementById('produto-custo').value);
  if (!(custo > 0)) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');

  var margem = parseInt(document.getElementById('margem-desejada').value);
  document.getElementById('margem-desejada-valor').textContent = margem + '%';
  var sugerido = precoParaMargem(custo, margem);
  document.getElementById('preco-sugerido').textContent = formatarDinheiro(sugerido) +
    ' (lucro ' + formatarDinheiro(sugerido - custo) + ')';

  var venda = parseFloat(document.getElementById('produto-venda').value);
  var atual = document.getElementById('margem-atual');
  if (venda > 0) {
    var m = margemPct(venda, custo);
    atual.textContent = 'Com o preço atual (' + formatarDinheiro(venda) + ') a margem é ' + m + '%' +
      (m < 0 ? ' — você perde dinheiro em cada venda' : m < MARGEM_BAIXA ? ' — está baixa' : '');
    atual.className = 'sugestao-preco-atual ' + (m < 0 ? 'texto-ruim' : m < MARGEM_BAIXA ? 'texto-atencao' : 'texto-bom');
  } else {
    atual.textContent = '';
  }
}

function usarPrecoSugerido() {
  var custo = parseFloat(document.getElementById('produto-custo').value);
  var margem = parseInt(document.getElementById('margem-desejada').value);
  var sugerido = precoParaMargem(custo, margem);
  if (sugerido > 0) {
    document.getElementById('produto-venda').value = sugerido.toFixed(2);
    atualizarSugestaoPreco();
  }
}

function renderizarProdutos() {
  renderizarAnaliseProdutos();
  var container = document.getElementById('lista-produtos');
  if (produtos.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🍫</div><p>Nenhum produto cadastrado ainda.<br>Clique em "+ Novo Produto" para começar!</p></div>';
    return;
  }
  container.innerHTML = produtos.map(function (p) {
    var lucroUnitario = parseFloat(p.precovenda) - parseFloat(p.precocusto);
    var badgeClass = p.estoque === 0 ? 'estoque-zero' : p.estoque <= (p.estoqueminimo || 5) ? 'estoque-baixo' : 'estoque-ok';
    var oculto = !!p.oculto;
    var imagemHtml = p.imagem_url
      ? '<img src="' + p.imagem_url + '" class="produto-imagem' + (oculto ? ' produto-oculto-img' : '') + '" alt="' + escaparHTML(p.nome) + '">'
      : '<div class="produto-imagem-placeholder' + (oculto ? ' produto-oculto-img' : '') + '">🍫</div>';
    var badgeOculto = oculto ? '<span class="badge-oculto">🚫 Oculto</span>' : '';
    return (
      '<div class="produto-item' + (oculto ? ' produto-item-oculto' : '') + '" style="padding:0;overflow:hidden">' +
        imagemHtml +
        '<div style="padding:12px 14px">' +
          '<div class="produto-header">' +
            '<div class="produto-nome">' + escaparHTML(p.nome) + ' ' + badgeOculto + '</div>' +
            '<span class="estoque-badge ' + badgeClass + '">' + p.estoque + ' un.</span>' +
          '</div>' +
          '<div class="produto-precos">' +
            '<span>Custo: <strong>' + formatarDinheiro(p.precocusto) + '</strong></span>' +
            '<span>Venda: <strong>' + formatarDinheiro(p.precovenda) + '</strong></span>' +
            '<span>Lucro: <strong class="green">' + formatarDinheiro(lucroUnitario) + '</strong></span>' +
          '</div>' +
          '<div class="produto-actions">' +
            '<button class="btn-secondary" onclick="openProdutoModal(\'' + p.id + '\')">Editar</button>' +
            '<button class="btn-ocultar" onclick="toggleOcultarProduto(\'' + p.id + '\',' + oculto + ')">' + (oculto ? '👁 Mostrar' : '🚫 Ocultar') + '</button>' +
            '<button class="btn-danger" onclick="deletarProduto(\'' + p.id + '\', \'' + escaparHTML(p.nome) + '\')">Excluir</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

async function toggleOcultarProduto(id, ocultoAtual) {
  var novoValor = !ocultoAtual;
  var { error } = await window.db.from('produtos').update({ oculto: novoValor }).eq('id', id);
  if (error) { showToast('Erro ao atualizar produto'); return; }
  showToast(novoValor ? '🚫 Produto ocultado dos clientes' : '👁 Produto visível para os clientes');
  await carregarProdutos();
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
  atualizarSugestaoPreco();
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
// A RECEBER (ADMIN)
// ============================================================
function renderizarReceber() {
  var container = document.getElementById('lista-receber');

  // Só mostra vendas não confirmadas
  var naoRecebidas = vendas.filter(function (v) { return !v.recebido; });

  if (naoRecebidas.length === 0) {
    receberGrupos = [];
    container.innerHTML =
      '<div class="empty-state"><div class="empty-icon">✅</div><p>Nenhum valor a receber!<br>Tudo confirmado.</p></div>';
    return;
  }

  // Agrupa por cliente (ignora maiúsculas/espaços para não separar o mesmo cliente em grupos diferentes)
  var gruposMap = {};
  naoRecebidas.forEach(function (v) {
    var nome = (v.nomecomprador || 'Sem nome').trim();
    var chave = normalizarNome(nome);
    if (!gruposMap[chave]) gruposMap[chave] = { nome: nome, total: 0, vendas: [], ids: [] };
    gruposMap[chave].total += parseFloat(v.total) || 0;
    gruposMap[chave].vendas.push(v);
    gruposMap[chave].ids.push(v.id);
  });

  var termoBusca = (document.getElementById('receber-busca').value || '').trim().toLowerCase();
  var todosGrupos = Object.values(gruposMap).sort(function (a, b) { return b.total - a.total; });
  receberGrupos = termoBusca
    ? todosGrupos.filter(function (g) { return g.nome.toLowerCase().indexOf(termoBusca) !== -1; })
    : todosGrupos;

  if (receberGrupos.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-icon">🔎</div><p>Nenhum cliente encontrado</p></div>';
    return;
  }

  var pagConfig = {
    dinheiro: { texto: '💵 Dinheiro',     classe: 'badge-metodo-din' },
    pix:      { texto: '📱 PIX',          classe: 'badge-metodo-pix' },
    credito:  { texto: '💳 Crédito',      classe: 'badge-metodo-cred' },
    prazo:    { texto: '💰 Quando Receber', classe: 'badge-metodo-prazo' }
  };

  container.innerHTML = receberGrupos.map(function (grupo, idx) {
    var itens = grupo.vendas.map(function (v) {
      var partes = v.data.split('-');
      var dataStr = partes[2] + '/' + partes[1];
      var cfg = pagConfig[v.status] || pagConfig['prazo'];
      return (
        '<div class="receber-linha receber-linha-pendente">' +
          '<div class="receber-linha-esq">' +
            '<div class="receber-linha-produto">' + escaparHTML(v.produtonome) + ' x' + v.quantidade + '</div>' +
            '<div class="receber-data">' + dataStr + '</div>' +
          '</div>' +
          '<div class="receber-linha-dir">' +
            '<div class="receber-linha-valor">' + formatarDinheiro(v.total) + '</div>' +
            '<span class="badge ' + cfg.classe + '">' + cfg.texto + '</span>' +
            '<button class="btn-marcar-ind" onclick="marcarVendaPaga(\'' + v.id + '\')">✅ Pago</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var btnTudo = grupo.ids.length > 1
      ? '<button class="btn-confirmar-pago" onclick="marcarClientePago(' + idx + ')">✅ Confirmar tudo pago (' + formatarDinheiro(grupo.total) + ')</button>'
      : '';

    return (
      '<div class="receber-grupo">' +
        '<div class="receber-header">' +
          '<div>' +
            '<div class="receber-cliente">👤 ' + escaparHTML(grupo.nome) +
              (grupo.nome !== 'Sem nome' ? ' <button class="btn-editar-nome" data-nome="' + escaparAttr(grupo.nome) + '" aria-label="Editar nome">✏️</button>' : '') +
            '</div>' +
            '<div class="receber-deve">A receber: ' + formatarDinheiro(grupo.total) + '</div>' +
          '</div>' +
          '<div class="receber-qtd">' + grupo.ids.length + ' item' + (grupo.ids.length > 1 ? 's' : '') + '</div>' +
        '</div>' +
        '<div class="receber-itens">' + itens + '</div>' +
        btnTudo +
      '</div>'
    );
  }).join('');
  ligarBotoesEditarNome(container);
}

// Marca como recebido e registra a data do recebimento. Se a coluna
// data_recebimento ainda não existir no banco, cai de volta pro update simples.
async function confirmarRecebimento(aplicarFiltro) {
  var hoje = dataLocalStr(new Date());
  var resp = await aplicarFiltro(window.db.from('vendas').update({ recebido: true, data_recebimento: hoje }));
  if (resp.error) {
    resp = await aplicarFiltro(window.db.from('vendas').update({ recebido: true }));
  }
  return resp;
}

async function marcarVendaPaga(vendaId) {
  try {
    var { error } = await confirmarRecebimento(function (q) { return q.eq('id', vendaId); });
    if (error) throw error;
    showToast('✅ Pagamento confirmado!');
    await carregarVendas();
    renderizarReceber();
    renderizarDashboard();
  } catch (erro) {
    console.error(erro);
    showToast('Erro ao confirmar pagamento');
  }
}

async function marcarClientePago(idx) {
  var grupo = receberGrupos[idx];
  if (!grupo || grupo.ids.length === 0) return;
  if (!confirm('Confirmar que ' + grupo.nome + ' pagou ' + formatarDinheiro(grupo.total) + '?')) return;

  try {
    var { error } = await confirmarRecebimento(function (q) { return q.in('id', grupo.ids); });
    if (error) throw error;
    showToast('✅ Tudo pago por ' + grupo.nome + '!');
    await carregarVendas();
    renderizarReceber();
    renderizarDashboard();
  } catch (erro) {
    console.error(erro);
    showToast('Erro ao confirmar pagamento');
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

// Para usar dentro de atributos HTML (data-nome="...")
function escaparAttr(texto) {
  return escaparHTML(texto).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
