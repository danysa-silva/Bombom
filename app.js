// ============================================================
// ESTADO DA APLICAÇÃO
// ============================================================
let produtos = [];
let vendas = [];
let currentFilter = 'hoje';
let paymentStatus = 'pago';
let editingProdutoId = null;
let db;

// ============================================================
// INICIALIZAÇÃO
// ============================================================
window.addEventListener('load', function () {
  if (typeof firebase === 'undefined') {
    showError('Firebase não carregou. Verifique sua conexão com a internet.');
    return;
  }

  try {
    db = firebase.firestore();
  } catch (e) {
    showError('Erro ao conectar com o Firebase. Verifique o arquivo firebase-config.js e certifique-se de ter preenchido as informações do seu projeto.');
    return;
  }

  // Define a data de hoje no campo de data da venda
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('venda-data').value = hoje;

  // Carrega dados em tempo real (atualiza automaticamente)
  carregarProdutos();
  carregarVendas();
});

// ============================================================
// DADOS: PRODUTOS
// ============================================================
function carregarProdutos() {
  db.collection('produtos')
    .orderBy('nome')
    .onSnapshot(
      function (snapshot) {
        produtos = snapshot.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        renderizarProdutos();
        renderizarEstoque();
        atualizarSelectVenda();
        esconderLoading();
      },
      function (erro) {
        console.error('Erro ao carregar produtos:', erro);
        showToast('Erro ao carregar produtos. Verifique o firebase-config.js');
        esconderLoading();
      }
    );
}

// ============================================================
// DADOS: VENDAS
// ============================================================
function carregarVendas() {
  db.collection('vendas')
    .orderBy('data', 'desc')
    .limit(200)
    .onSnapshot(
      function (snapshot) {
        vendas = snapshot.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        renderizarDashboard();
      },
      function (erro) {
        console.error('Erro ao carregar vendas:', erro);
      }
    );
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
var paginaConfig = {
  dashboard: { titulo: 'Dashboard',    icone: '📊' },
  venda:     { titulo: 'Nova Venda',   icone: '🛒' },
  produtos:  { titulo: 'Produtos',     icone: '🍫' },
  estoque:   { titulo: 'Estoque',      icone: '📦' }
};

function navigate(pagina) {
  document.querySelectorAll('.page').forEach(function (p) {
    p.classList.remove('active');
  });
  document.getElementById('page-' + pagina).classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.classList.remove('active');
  });
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
  var hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

  return vendas.filter(function (v) {
    var dataVenda = v.data && v.data.toDate ? v.data.toDate() : new Date(v.data);
    var diaVenda = new Date(dataVenda.getFullYear(), dataVenda.getMonth(), dataVenda.getDate());

    if (currentFilter === 'hoje') {
      return diaVenda.getTime() === hoje.getTime();
    }
    if (currentFilter === 'semana') {
      var semanaAtras = new Date(hoje);
      semanaAtras.setDate(semanaAtras.getDate() - 6);
      return diaVenda >= semanaAtras;
    }
    // mês
    return dataVenda.getMonth() === agora.getMonth() &&
           dataVenda.getFullYear() === agora.getFullYear();
  });
}

function renderizarDashboard() {
  var filtradas = getVendasFiltradas();

  var totalVendido = 0;
  var recebido = 0;
  var aReceber = 0;
  var lucro = 0;

  filtradas.forEach(function (v) {
    totalVendido += v.total || 0;
    lucro += v.lucro || 0;
    if (v.status === 'pago') {
      recebido += v.total || 0;
    } else {
      aReceber += v.total || 0;
    }
  });

  document.getElementById('dash-total-vendido').textContent = formatarDinheiro(totalVendido);
  document.getElementById('dash-recebido').textContent = formatarDinheiro(recebido);
  document.getElementById('dash-a-receber').textContent = formatarDinheiro(aReceber);
  document.getElementById('dash-lucro').textContent = formatarDinheiro(lucro);
  document.getElementById('dash-qtd-vendas').textContent =
    filtradas.length + (filtradas.length === 1 ? ' venda' : ' vendas');

  var container = document.getElementById('dash-ultimas-vendas');
  var recentes = filtradas.slice(0, 15);

  if (recentes.length === 0) {
    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">🛒</div>' +
        '<p>Nenhuma venda no período selecionado</p>' +
      '</div>';
    return;
  }

  container.innerHTML = recentes.map(function (v) {
    var dataVenda = v.data && v.data.toDate ? v.data.toDate() : new Date(v.data);
    var dataStr = dataVenda.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    var badgeClass = v.status === 'pago' ? 'badge-pago' : 'badge-prazo';
    var badgeTexto = v.status === 'pago' ? 'Pago' : 'A prazo';
    return (
      '<div class="venda-item">' +
        '<div class="venda-item-left">' +
          '<div class="venda-nome">' + escaparHTML(v.produtoNome) + '</div>' +
          '<div class="venda-info">' + v.quantidade + 'x &bull; ' + dataStr + '</div>' +
        '</div>' +
        '<div class="venda-item-right">' +
          '<div class="venda-valor">' + formatarDinheiro(v.total) + '</div>' +
          '<span class="badge ' + badgeClass + '">' + badgeTexto + '</span>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

// ============================================================
// NOVA VENDA
// ============================================================
function atualizarSelectVenda() {
  var select = document.getElementById('venda-produto');
  var valorAtual = select.value;

  select.innerHTML = '<option value="">Selecione um produto...</option>';

  produtos.forEach(function (p) {
    var opt = document.createElement('option');
    opt.value = p.id;
    var textoEstoque = p.estoque > 0 ? '(estoque: ' + p.estoque + ')' : '❌ SEM ESTOQUE';
    opt.textContent = p.nome + ' — ' + formatarDinheiro(p.precoVenda) + ' ' + textoEstoque;
    if (p.estoque === 0) opt.disabled = true;
    select.appendChild(opt);
  });

  if (valorAtual) select.value = valorAtual;
}

function changeQty(delta) {
  var input = document.getElementById('venda-qty');
  var novoValor = Math.max(1, (parseInt(input.value) || 1) + delta);
  input.value = novoValor;
  updateVendaPreview();
}

function setPayment(status) {
  paymentStatus = status;
  document.getElementById('btn-pago').className =
    'pay-btn' + (status === 'pago' ? ' pay-btn-active' : '');
  document.getElementById('btn-prazo').className =
    'pay-btn' + (status === 'prazo' ? ' pay-btn-active' : '');
}

function updateVendaPreview() {
  var produtoId = document.getElementById('venda-produto').value;
  var qty = parseInt(document.getElementById('venda-qty').value) || 0;

  if (!produtoId || qty <= 0) {
    document.getElementById('venda-preview').classList.add('hidden');
    return;
  }

  var produto = produtos.find(function (p) { return p.id === produtoId; });
  if (!produto) return;

  var total = produto.precoVenda * qty;
  var lucroPreview = (produto.precoVenda - produto.precoCusto) * qty;

  document.getElementById('preview-total').textContent = formatarDinheiro(total);
  document.getElementById('preview-lucro').textContent = formatarDinheiro(lucroPreview);
  document.getElementById('venda-preview').classList.remove('hidden');
}

async function registrarVenda() {
  var produtoId = document.getElementById('venda-produto').value;
  var qty = parseInt(document.getElementById('venda-qty').value) || 0;
  var dataStr = document.getElementById('venda-data').value;

  if (!produtoId) {
    showToast('Selecione um produto');
    return;
  }

  if (qty <= 0) {
    showToast('Informe uma quantidade válida');
    return;
  }

  if (!dataStr) {
    showToast('Informe a data da venda');
    return;
  }

  var produto = produtos.find(function (p) { return p.id === produtoId; });
  if (!produto) return;

  if (produto.estoque < qty) {
    showToast('Estoque insuficiente! Disponível: ' + produto.estoque);
    return;
  }

  // Cria a data sem problemas de fuso horário
  var partes = dataStr.split('-');
  var dataVenda = new Date(
    parseInt(partes[0]),
    parseInt(partes[1]) - 1,
    parseInt(partes[2]),
    12, 0, 0
  );

  var venda = {
    produtoId: produtoId,
    produtoNome: produto.nome,
    quantidade: qty,
    precoVenda: produto.precoVenda,
    precoCusto: produto.precoCusto,
    status: paymentStatus,
    data: firebase.firestore.Timestamp.fromDate(dataVenda),
    total: produto.precoVenda * qty,
    lucro: (produto.precoVenda - produto.precoCusto) * qty
  };

  var btn = document.getElementById('btn-registrar');

  try {
    btn.disabled = true;
    btn.textContent = 'Registrando...';

    // Usa "batch" para salvar a venda e atualizar o estoque ao mesmo tempo
    var batch = db.batch();

    var vendaRef = db.collection('vendas').doc();
    batch.set(vendaRef, venda);

    var produtoRef = db.collection('produtos').doc(produtoId);
    batch.update(produtoRef, {
      estoque: firebase.firestore.FieldValue.increment(-qty)
    });

    await batch.commit();

    showToast('✅ Venda registrada! Total: ' + formatarDinheiro(venda.total));

    // Limpa o formulário
    document.getElementById('venda-produto').value = '';
    document.getElementById('venda-qty').value = '1';
    document.getElementById('venda-preview').classList.add('hidden');
    setPayment('pago');

    navigate('dashboard');

  } catch (erro) {
    console.error('Erro ao registrar venda:', erro);
    showToast('Erro ao registrar venda. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Registrar Venda';
  }
}

// ============================================================
// PRODUTOS
// ============================================================
function renderizarProdutos() {
  var container = document.getElementById('lista-produtos');

  if (produtos.length === 0) {
    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">🍫</div>' +
        '<p>Nenhum produto cadastrado ainda.<br>Clique em "+ Novo Produto" para começar!</p>' +
      '</div>';
    return;
  }

  container.innerHTML = produtos.map(function (p) {
    var lucroUnitario = p.precoVenda - p.precoCusto;
    var badgeClass = p.estoque === 0 ? 'estoque-zero' :
                     p.estoque <= (p.estoqueMinimo || 5) ? 'estoque-baixo' : 'estoque-ok';
    var badgeTexto = p.estoque + ' un.';

    return (
      '<div class="produto-item">' +
        '<div class="produto-header">' +
          '<div class="produto-nome">' + escaparHTML(p.nome) + '</div>' +
          '<span class="estoque-badge ' + badgeClass + '">' + badgeTexto + '</span>' +
        '</div>' +
        '<div class="produto-precos">' +
          '<span>Custo: <strong>' + formatarDinheiro(p.precoCusto) + '</strong></span>' +
          '<span>Venda: <strong>' + formatarDinheiro(p.precoVenda) + '</strong></span>' +
          '<span>Lucro: <strong class="green">' + formatarDinheiro(lucroUnitario) + '</strong></span>' +
        '</div>' +
        '<div class="produto-actions">' +
          '<button class="btn-secondary" onclick="openProdutoModal(\'' + p.id + '\')">Editar</button>' +
          '<button class="btn-danger" onclick="deletarProduto(\'' + p.id + '\', \'' + escaparHTML(p.nome) + '\')">Excluir</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function openProdutoModal(produtoId) {
  editingProdutoId = produtoId || null;

  if (produtoId) {
    var p = produtos.find(function (x) { return x.id === produtoId; });
    if (p) {
      document.getElementById('produto-nome').value = p.nome;
      document.getElementById('produto-custo').value = p.precoCusto;
      document.getElementById('produto-venda').value = p.precoVenda;
      document.getElementById('produto-estoque').value = p.estoque;
      document.getElementById('produto-estoque-min').value = p.estoqueMinimo || 5;
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

async function salvarProduto() {
  var nome = document.getElementById('produto-nome').value.trim();
  var precoCusto = parseFloat(document.getElementById('produto-custo').value) || 0;
  var precoVenda = parseFloat(document.getElementById('produto-venda').value) || 0;
  var estoque = parseInt(document.getElementById('produto-estoque').value) || 0;
  var estoqueMinimo = parseInt(document.getElementById('produto-estoque-min').value) || 5;

  if (!nome) {
    showToast('Informe o nome do produto');
    return;
  }
  if (precoVenda <= 0) {
    showToast('Informe o preço de venda');
    return;
  }

  var dados = {
    nome: nome,
    precoCusto: precoCusto,
    precoVenda: precoVenda,
    estoque: estoque,
    estoqueMinimo: estoqueMinimo
  };

  try {
    if (editingProdutoId) {
      await db.collection('produtos').doc(editingProdutoId).update(dados);
      showToast('✅ Produto atualizado!');
    } else {
      await db.collection('produtos').add(dados);
      showToast('✅ Produto cadastrado!');
    }
    closeModal('modal-produto');
  } catch (erro) {
    console.error('Erro ao salvar produto:', erro);
    showToast('Erro ao salvar. Tente novamente.');
  }
}

async function deletarProduto(id, nome) {
  if (!confirm('Excluir "' + nome + '"?\n\nIsso não apagará as vendas já registradas.')) return;

  try {
    await db.collection('produtos').doc(id).delete();
    showToast('Produto excluído');
  } catch (erro) {
    console.error('Erro ao excluir:', erro);
    showToast('Erro ao excluir produto');
  }
}

// ============================================================
// ESTOQUE
// ============================================================
function renderizarEstoque() {
  var alertasContainer = document.getElementById('alertas-estoque');
  var listaContainer = document.getElementById('lista-estoque');

  var baixos = produtos.filter(function (p) {
    return p.estoque <= (p.estoqueMinimo || 5);
  });

  if (baixos.length > 0) {
    alertasContainer.innerHTML =
      '<div class="section-title">⚠️ Atenção: Estoque Baixo</div>' +
      baixos.map(function (p) {
        var texto = p.estoque === 0
          ? 'Estoque <strong>zerado!</strong> Hora de repor.'
          : 'Restam apenas <strong>' + p.estoque + '</strong> unidade' + (p.estoque !== 1 ? 's' : '') + '.';
        return '<div class="alerta"><strong>' + escaparHTML(p.nome) + '</strong>' + texto + '</div>';
      }).join('');
  } else {
    alertasContainer.innerHTML = '';
  }

  if (produtos.length === 0) {
    listaContainer.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">📦</div>' +
        '<p>Nenhum produto cadastrado ainda</p>' +
      '</div>';
    return;
  }

  listaContainer.innerHTML =
    '<div class="section-title">Todos os Produtos</div>' +
    produtos.map(function (p) {
      var badgeClass = p.estoque === 0 ? 'estoque-zero' :
                       p.estoque <= (p.estoqueMinimo || 5) ? 'estoque-baixo' : 'estoque-ok';
      return (
        '<div class="estoque-item">' +
          '<div>' +
            '<div class="estoque-nome">' + escaparHTML(p.nome) + '</div>' +
            '<div class="estoque-info">Mínimo configurado: ' + (p.estoqueMinimo || 5) + ' un.</div>' +
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
  document.querySelectorAll('.modal').forEach(function (m) {
    m.classList.add('hidden');
  });
  document.getElementById('overlay').classList.add('hidden');
}

// ============================================================
// UTILITÁRIOS
// ============================================================
function formatarDinheiro(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor || 0);
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

  setTimeout(function () {
    if (toast.parentNode) toast.remove();
  }, duracao);
}

function esconderLoading() {
  document.getElementById('loading').style.display = 'none';
}

function showError(mensagem) {
  document.getElementById('loading').innerHTML =
    '<div style="text-align:center;padding:24px;color:#ef4444;max-width:300px">' +
      '<div style="font-size:2.5rem;margin-bottom:14px">⚠️</div>' +
      '<p style="font-size:0.95rem;line-height:1.5">' + mensagem + '</p>' +
    '</div>';
}
