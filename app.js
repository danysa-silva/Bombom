// ============================================================
// ESTADO DA APLICAÇÃO
// ============================================================
let produtos = [];
let vendas = [];
let currentFilter = 'hoje';
let paymentStatus = 'dinheiro';
let editingProdutoId = null;
let nomeUsuario = '';

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

  // Verifica nome salvo
  nomeUsuario = localStorage.getItem('nomeUsuario') || '';
  if (!nomeUsuario) {
    document.getElementById('modal-nome').classList.remove('hidden');
  } else {
    document.getElementById('label-comprador').textContent = nomeUsuario;
  }

  await carregarDados();
});

async function carregarDados() {
  await Promise.all([carregarProdutos(), carregarVendas()]);
  esconderLoading();
}

// ============================================================
// DADOS: PRODUTOS
// ============================================================
async function carregarProdutos() {
  const { data, error } = await window.db
    .from('produtos')
    .select('*')
    .order('nome');

  if (error) {
    console.error('Erro ao carregar produtos:', error);
    showToast('Erro ao carregar produtos');
    return;
  }

  produtos = data || [];
  renderizarProdutos();
  renderizarEstoque();
  atualizarSelectVenda();
}

// ============================================================
// DADOS: VENDAS
// ============================================================
async function carregarVendas() {
  const { data, error } = await window.db
    .from('vendas')
    .select('*')
    .order('data', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Erro ao carregar vendas:', error);
    return;
  }

  vendas = data || [];
  renderizarDashboard();
}

function salvarNomeUsuario() {
  var nome = document.getElementById('input-nome-usuario').value.trim();
  if (!nome) { showToast('Digite seu nome para continuar'); return; }
  nomeUsuario = nome;
  localStorage.setItem('nomeUsuario', nome);
  document.getElementById('modal-nome').classList.add('hidden');
  document.getElementById('label-comprador').textContent = nome;
}

function trocarNome() {
  var novoNome = prompt('Qual é o seu nome?', nomeUsuario);
  if (novoNome && novoNome.trim()) {
    nomeUsuario = novoNome.trim();
    localStorage.setItem('nomeUsuario', nomeUsuario);
    document.getElementById('label-comprador').textContent = nomeUsuario;
    showToast('Nome atualizado!');
  }
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
var paginaConfig = {
  dashboard: { titulo: 'Dashboard',  icone: '📊' },
  venda:     { titulo: 'Nova Venda', icone: '🛒' },
  produtos:  { titulo: 'Produtos',   icone: '🍫' },
  estoque:   { titulo: 'Estoque',    icone: '📦' }
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
  var hojeStr = agora.toISOString().split('T')[0];

  return vendas.filter(function (v) {
    var dataVenda = v.data; // formato 'YYYY-MM-DD'

    if (currentFilter === 'hoje') {
      return dataVenda === hojeStr;
    }
    if (currentFilter === 'semana') {
      var semanaAtras = new Date(agora);
      semanaAtras.setDate(semanaAtras.getDate() - 6);
      var semanaAtrasStr = semanaAtras.toISOString().split('T')[0];
      return dataVenda >= semanaAtrasStr;
    }
    // mês
    var mesAtual = hojeStr.substring(0, 7); // 'YYYY-MM'
    return dataVenda.startsWith(mesAtual);
  });
}

function renderizarDashboard() {
  var filtradas = getVendasFiltradas();

  var totalVendido = 0, recebido = 0, aReceber = 0, lucro = 0;

  filtradas.forEach(function (v) {
    totalVendido += parseFloat(v.total) || 0;
    lucro += parseFloat(v.lucro) || 0;
    if (v.status === 'prazo') {
      aReceber += parseFloat(v.total) || 0;
    } else {
      recebido += parseFloat(v.total) || 0;
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
      '<div class="empty-state"><div class="empty-icon">🛒</div>' +
      '<p>Nenhuma venda no período selecionado</p></div>';
    return;
  }

  container.innerHTML = recentes.map(function (v) {
    var partes = v.data.split('-');
    var dataStr = partes[2] + '/' + partes[1];
    var badgeInfo = {
      dinheiro: { classe: 'badge-pago', texto: '💵 Dinheiro' },
      pix:      { classe: 'badge-pago', texto: '📱 PIX' },
      credito:  { classe: 'badge-pago', texto: '💳 Crédito' },
      prazo:    { classe: 'badge-prazo', texto: '💰 Quando Receber' }
    };
    var badge = badgeInfo[v.status] || badgeInfo['prazo'];
    var badgeClass = badge.classe;
    var badgeTexto = badge.texto;
    return (
      '<div class="venda-item">' +
        '<div class="venda-item-left">' +
          '<div class="venda-nome">' + escaparHTML(v.produtonome) + '</div>' +
          '<div class="venda-info">' + v.quantidade + 'x &bull; ' + dataStr + (v.nomecomprador ? ' &bull; ' + escaparHTML(v.nomecomprador) : '') + '</div>' +
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
    opt.textContent = p.nome + ' — ' + formatarDinheiro(p.precovenda) + ' ' + textoEstoque;
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
  ['dinheiro', 'pix', 'credito', 'prazo'].forEach(function (s) {
    document.getElementById('btn-' + s).className =
      'pay-btn' + (status === s ? ' pay-btn-active' : '');
  });
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

  var total = parseFloat(produto.precovenda) * qty;
  var lucroPreview = (parseFloat(produto.precovenda) - parseFloat(produto.precocusto)) * qty;

  document.getElementById('preview-total').textContent = formatarDinheiro(total);
  document.getElementById('preview-lucro').textContent = formatarDinheiro(lucroPreview);
  document.getElementById('venda-preview').classList.remove('hidden');
}

async function registrarVenda() {
  var produtoId = document.getElementById('venda-produto').value;
  var qty = parseInt(document.getElementById('venda-qty').value) || 0;
  var dataStr = document.getElementById('venda-data').value;

  if (!produtoId) { showToast('Selecione um produto'); return; }
  if (qty <= 0)   { showToast('Informe uma quantidade válida'); return; }
  if (!dataStr)   { showToast('Informe a data da venda'); return; }

  var produto = produtos.find(function (p) { return p.id === produtoId; });
  if (!produto) return;

  if (produto.estoque < qty) {
    showToast('Estoque insuficiente! Disponível: ' + produto.estoque);
    return;
  }

  var btn = document.getElementById('btn-registrar');

  try {
    btn.disabled = true;
    btn.textContent = 'Registrando...';

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
      nomecomprador: nomeUsuario || 'Sem nome'
    };

    var { error: vendaError } = await window.db.from('vendas').insert([venda]);
    if (vendaError) throw vendaError;

    var { error: stockError } = await window.db
      .from('produtos')
      .update({ estoque: produto.estoque - qty })
      .eq('id', produtoId);
    if (stockError) throw stockError;

    showToast('✅ Venda registrada! Total: ' + formatarDinheiro(venda.total));

    document.getElementById('venda-produto').value = '';
    document.getElementById('venda-qty').value = '1';
    document.getElementById('venda-preview').classList.add('hidden');
    setPayment('dinheiro');

    await carregarDados();
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
      '<div class="empty-state"><div class="empty-icon">🍫</div>' +
      '<p>Nenhum produto cadastrado ainda.<br>Clique em "+ Novo Produto" para começar!</p></div>';
    return;
  }

  container.innerHTML = produtos.map(function (p) {
    var lucroUnitario = parseFloat(p.precovenda) - parseFloat(p.precocusto);
    var badgeClass = p.estoque === 0 ? 'estoque-zero' :
                     p.estoque <= (p.estoqueminimo || 5) ? 'estoque-baixo' : 'estoque-ok';
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

  // Reset imagem
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
        var preview = document.getElementById('produto-imagem-preview');
        preview.src = p.imagem_url;
        preview.classList.remove('hidden');
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
      var preview = document.getElementById('produto-imagem-preview');
      preview.src = e.target.result;
      preview.classList.remove('hidden');
      document.getElementById('upload-placeholder').classList.add('hidden');
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function uploadImagem(file, produtoId) {
  var extensao = file.name.split('.').pop() || 'jpg';
  var nomeArquivo = 'produtos/' + produtoId + '-' + Date.now() + '.' + extensao;

  var { error } = await window.db.storage
    .from('imagens')
    .upload(nomeArquivo, file, { upsert: true });

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

  var dados = { nome, precocusto, precovenda, estoque, estoqueminimo };

  try {
    var produtoId = editingProdutoId;

    if (editingProdutoId) {
      var { error } = await window.db.from('produtos').update(dados).eq('id', editingProdutoId);
      if (error) throw error;
    } else {
      var { data: novo, error } = await window.db.from('produtos').insert([dados]).select().single();
      if (error) throw error;
      produtoId = novo.id;
    }

    if (imagemInput.files && imagemInput.files[0]) {
      var imagemUrl = await uploadImagem(imagemInput.files[0], produtoId);
      await window.db.from('produtos').update({ imagem_url: imagemUrl }).eq('id', produtoId);
    }

    showToast(editingProdutoId ? '✅ Produto atualizado!' : '✅ Produto cadastrado!');
    closeModal('modal-produto');
    await carregarProdutos();
  } catch (erro) {
    console.error('Erro ao salvar produto:', erro);
    showToast('Erro ao salvar. Tente novamente.');
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
    return p.estoque <= (p.estoqueminimo || 5);
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
      '<div class="empty-state"><div class="empty-icon">📦</div>' +
      '<p>Nenhum produto cadastrado ainda</p></div>';
    return;
  }

  listaContainer.innerHTML =
    '<div class="section-title">Todos os Produtos</div>' +
    produtos.map(function (p) {
      var badgeClass = p.estoque === 0 ? 'estoque-zero' :
                       p.estoque <= (p.estoqueminimo || 5) ? 'estoque-baixo' : 'estoque-ok';
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
