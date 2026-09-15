/* =====================================================================
   Gestão Rápida · Manutenções — quem entra vê o quê

   Mesmo desenho do Gestão Rápida (Pessoas): a lista de gente fica na
   tabela `usuarios`, cada pessoa tem um nome de login, uma marca de
   administrador, os módulos liberados e — quando se quer apertar mais —
   as telas de dentro de cada módulo.

   Administrador enxerga tudo e é o único que mexe nesta lista.
   As fazendas continuam valendo por cima disso: o perfil diz o que a
   pessoa pode fazer, o local diz sobre quais máquinas.
   ===================================================================== */

/* Os módulos do app. Para criar um módulo novo, basta acrescentar um item
   aqui com as telas que já existem em TELAS — o menu, a tela de
   configurações e as permissões passam a enxergá-lo sozinhos. */
const MODULOS = [
  { id: 'manutencao', nome: 'Manutenção', telas: [
    ['inicio', 'Painel'],
    ['vencimentos', 'Vencimentos'],
    ['manutencoes', 'Manutenções'],
    ['ordens', 'Ordens de serviço'],
    ['anomalias', 'Anomalias'],
  ] },
  { id: 'frota', nome: 'Frota', telas: [
    ['equipamentos', 'Bens'],
    ['horimetro', 'Horímetro'],
  ] },
  { id: 'checklist', nome: 'Check list', telas: [
    ['checklist', 'Check list'],
  ] },
  { id: 'pecas', nome: 'Peças', telas: [
    ['pecas', 'Peças'],
    ['vinculos', 'Peças por máquina'],
  ] },
  /* Cadastro de máquina, tipo, plano e fornecedor muda o app inteiro para
     todo mundo — por isso fica só para administrador. */
  { id: 'cadastros', nome: 'Cadastros', admin: true, telas: [
    ['cadastros', 'Cadastros'],
  ] },
];

/* Quem ainda não tiver módulo marcado entra com estes — assim ninguém fica
   trancado do lado de fora por esquecimento. */
const MODULOS_PADRAO = ['manutencao', 'checklist'];

const Acesso = {
  admin: false,
  modulos: [...MODULOS_PADRAO],
  telas: [],
  carregado: false,
};

const soAdmin = new Set(
  MODULOS.filter(m => m.admin).flatMap(m => m.telas.map(([t]) => t))
);

const moduloDe = tela => MODULOS.find(m => m.telas.some(([t]) => t === tela))?.id || null;

const pode = m => Acesso.admin || Acesso.modulos.includes(m);

/* Permissão por tela. A lista guarda 'modulo:tela'. Enquanto nenhuma tela de
   um módulo estiver marcada, a pessoa vê o módulo inteiro — que é o caso
   normal. Basta marcar uma para o resto sumir. */
const temRestricao = m => Acesso.telas.some(x => x.startsWith(m + ':'));

function podeTela(tela) {
  if (Acesso.admin) return true;
  if (soAdmin.has(tela)) return false;
  const m = moduloDe(tela);
  if (!m || !pode(m)) return false;
  return !temRestricao(m) || Acesso.telas.includes(m + ':' + tela);
}

const telasLiberadas = id => {
  const m = MODULOS.find(x => x.id === id);
  return m ? m.telas.filter(([t]) => podeTela(t)) : [];
};

const modulosLiberados = () =>
  MODULOS.filter(m => pode(m.id) && telasLiberadas(m.id).length);

/* ---------------------------------------------------------------- carga */

function carregarAcesso(u) {
  Acesso.admin = !!(u && (u.admin || u.perfil === 'ADMINISTRADOR'));
  Acesso.modulos = (u && u.modulos && u.modulos.length) ? [...u.modulos] : [...MODULOS_PADRAO];
  Acesso.telas = (u && u.telas) ? [...u.telas] : [];
  Acesso.carregado = true;
  return Acesso;
}

/* ---------------------------------------------------------------- menu */

let moduloAberto = null;

/** Monta a primeira faixa (módulos) e abre a tela de marca. */
function montarMenu() {
  const libs = modulosLiberados();
  $('#menu').innerHTML = libs.map(m =>
    `<button type="button" data-modulo="${m.id}">${esc(m.nome)}</button>`).join('')
    + (Acesso.admin
      ? '<button type="button" data-modulo="config">Configurações</button>' : '');
  $$('#menu button').forEach(b => b.onclick = () => abrirModulo(b.dataset.modulo));
  $('#menu').hidden = false;
  mostrarInicio();
}

/** A tela de entrada: nenhum módulo aberto, só SAKUMA e LOP. */
function mostrarInicio() {
  moduloAberto = null;
  $$('#menu button').forEach(b => b.classList.remove('ativo'));
  $('#menu2').hidden = true;
  $('#menu2').innerHTML = '';
  TELAS.marca($('#tela'));
}

function abrirModulo(id, tela) {
  if (!id) return;
  moduloAberto = id;
  $$('#menu button').forEach(b => b.classList.toggle('ativo', b.dataset.modulo === id));

  if (id === 'config') {
    document.body.classList.remove('sem-rodape');
    $('#menu2').hidden = true;
    $('#menu2').innerHTML = '';
    TELAS.config($('#tela'));
    return;
  }

  const telas = telasLiberadas(id);
  if (!telas.length) return;
  const alvo = telas.some(([t]) => t === tela) ? tela : telas[0][0];

  // Módulo de uma tela só não ganha segunda faixa: seria uma aba sozinha.
  $('#menu2').hidden = telas.length < 2;
  $('#menu2').innerHTML = telas.map(([t, rot]) =>
    `<button type="button" data-tela="${t}">${esc(rot)}</button>`).join('');
  $$('#menu2 button').forEach(b => b.onclick = () => irPara(b.dataset.tela));
  irPara(alvo);
}

/** Pinta as faixas quando a tela é aberta de fora (atalho, link, botão). */
function marcarMenu(tela) {
  const m = moduloDe(tela);
  if (!m) return;
  if (m !== moduloAberto) {
    moduloAberto = m;
    $$('#menu button').forEach(b => b.classList.toggle('ativo', b.dataset.modulo === m));
    const telas = telasLiberadas(m);
    $('#menu2').hidden = telas.length < 2;
    $('#menu2').innerHTML = telas.map(([t, rot]) =>
      `<button type="button" data-tela="${t}">${esc(rot)}</button>`).join('');
    $$('#menu2 button').forEach(b => b.onclick = () => irPara(b.dataset.tela));
  }
  $$('#menu2 button').forEach(b => b.classList.toggle('ativo', b.dataset.tela === tela));
}

/** A primeira tela que a pessoa pode ver, para atalhos e links. */
function primeiraTela() {
  const libs = modulosLiberados();
  return libs.length ? telasLiberadas(libs[0].id)[0][0] : null;
}

/* ---------------------------------------------------------------- tela de marca */

TELAS.marca = el => {
  // Na tela de entrada a assinatura da LOP é a grande, no meio: o rodapé fixo
  // sai de cena para a marca não aparecer duas vezes na mesma página.
  document.body.classList.add('sem-rodape');
  el.innerHTML = `
    <section class="marca-inicio">
      <img class="mi-sakuma" src="img/sakuma-marca-vertical.png" alt="SAKUMA Agronegócios">
      <h2>Gestão Rápida <span>Manutenções</span></h2>
      <p class="mi-dica">Escolha um módulo no menu acima para começar.</p>
      <img class="mi-lop" src="img/lop-assinatura-laser-escuro.png"
           alt="Desenvolvido por LOP — Inteligência para o agronegócio">
    </section>`;
};

/* ---------------------------------------------------------------- configurações */

let gente = [];          // linhas da tabela usuarios
let locaisPorUsuario = {};
let editando = null;

async function carregarGente() {
  const { data: us, error } = await App.sb.from('usuarios').select('*').order('nome');
  if (error) throw error;
  gente = us || [];
  const { data: ul } = await App.sb.from('usuario_locais').select('*');
  locaisPorUsuario = {};
  (ul || []).forEach(x => {
    (locaisPorUsuario[x.usuario_id] = locaisPorUsuario[x.usuario_id] || []).push(x.local_id);
  });
}

TELAS.config = async el => {
  if (!Acesso.admin) {
    el.innerHTML = '<h1>Configurações</h1><p class="sub">Só quem é administrador mexe nesta lista.</p>';
    return;
  }
  el.innerHTML = '<section class="carregando"><p>Buscando a lista de gente…</p></section>';
  if (!App.online) {
    el.innerHTML = `<h1>Configurações</h1>
      <p class="sub">Mexer em acesso precisa de internet — é o servidor que cria o login.</p>`;
    return;
  }
  try { await carregarGente(); }
  catch (e) {
    el.innerHTML = `<h1>Configurações</h1><p class="sub">Não consegui ler a lista: ${esc(e.message)}</p>`;
    return;
  }
  desenharConfig(el);
};

function desenharConfig(el) {
  const eu = (App.usuario || {}).id;
  const nomeLocal = id => (q.nome('locais', id) || '');

  el.innerHTML = `
    <h1>Configurações</h1>
    <p class="sub">Quem entra no app, por onde entra e o que enxerga.</p>
    <div class="acoes"><button type="button" class="btn" id="cf-novo">Adicionar pessoa</button></div>
    <div id="cf-aviso" class="aviso-linha oculto"></div>
    <div class="rolagem">
    <table class="tabela"><thead><tr>
      <th>Pessoa</th><th>Login</th><th>Fazendas</th><th class="ce">Admin</th>
      ${MODULOS.map(m => `<th class="ce">${esc(m.nome)}</th>`).join('')}
      <th></th>
    </tr></thead><tbody>
    ${gente.map(u => {
      const souEu = u.id === eu;
      const locais = (locaisPorUsuario[u.id] || []).map(nomeLocal).filter(Boolean);
      return `<tr>
        <td><strong>${esc(u.nome || u.email)}</strong>${souEu ? ' <span class="etq ok">você</span>' : ''}
          <br><small>${esc(u.email)}</small>
          ${u.ativo === false ? '<br><span class="etq inativo">inativo</span>' : ''}</td>
        <td>${u.usuario ? `<code>${esc(u.usuario)}</code>` : '<small>entra pelo e-mail</small>'}</td>
        <td><small>${u.admin || u.perfil === 'ADMINISTRADOR'
            ? 'todas' : (locais.join(' · ') || '—')}</small></td>
        <td class="ce"><input type="checkbox" class="cf-cx" data-id="${esc(u.id)}" data-campo="admin"
          ${u.admin ? 'checked' : ''} ${souEu ? 'disabled title="Você não pode tirar o próprio acesso de administrador"' : ''}></td>
        ${MODULOS.map(m => `<td class="ce"><input type="checkbox" class="cf-cx"
          data-id="${esc(u.id)}" data-modulo="${m.id}"
          ${u.admin || (u.modulos || []).includes(m.id) ? 'checked' : ''}
          ${u.admin ? 'disabled title="Administrador enxerga tudo"' : ''}></td>`).join('')}
        <td class="ce"><button type="button" class="btn-fantasma" data-editar="${esc(u.id)}">Editar</button></td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;

  $('#cf-novo').onclick = () => abrirPessoa(null);
  $$('.cf-cx').forEach(cx => cx.onchange = () => trocarPermissao(cx, el));
  $$('[data-editar]').forEach(b => b.onclick = () => abrirPessoa(b.dataset.editar));
}

function avisoConfig(texto, erro = true) {
  const a = $('#cf-aviso');
  if (!a) return aviso(texto, erro);
  a.textContent = texto;
  a.className = 'aviso-linha' + (erro ? ' erro' : '');
}

/** Marcar a caixinha na tabela grava na hora, como no Pessoas. */
async function trocarPermissao(cx, el) {
  const u = gente.find(x => x.id === cx.dataset.id);
  if (!u) return;
  const antes = { admin: u.admin, modulos: [...(u.modulos || [])] };
  if (cx.dataset.campo === 'admin') u.admin = cx.checked;
  else {
    const lista = new Set(u.modulos || []);
    cx.checked ? lista.add(cx.dataset.modulo) : lista.delete(cx.dataset.modulo);
    u.modulos = [...lista];
  }
  const ok = await gravarPessoa(u);
  if (!ok) { u.admin = antes.admin; u.modulos = antes.modulos; }
  desenharConfig(el);
  if (u.id === (App.usuario || {}).id) {   // mexeu no próprio acesso
    App.usuario = u;
    carregarAcesso(u);
    montarMenu();
    abrirModulo('config');
  }
}

async function gravarPessoa(u) {
  const { error } = await App.sb.from('usuarios').update({
    nome: u.nome, usuario: u.usuario || null, admin: !!u.admin,
    perfil: u.admin ? 'ADMINISTRADOR' : (u.perfil === 'ADMINISTRADOR' ? 'CONSULTA' : u.perfil),
    modulos: u.modulos || [], telas: u.telas || [], ativo: u.ativo !== false,
  }).eq('id', u.id);
  if (error) { avisoConfig(erroDeLogin(error) || ('Não consegui salvar: ' + error.message)); return false; }
  avisoConfig('', false);
  $('#cf-aviso')?.classList.add('oculto');
  return true;
}

/* O banco é quem garante que não existem dois logins iguais e que o formato
   está certo. Aqui só traduzimos o que ele reclama. */
function erroDeLogin(error) {
  const m = String(error?.message || '');
  if (/usuarios_usuario_unico|duplicate key/i.test(m)) {
    return 'Esse login já é de outra pessoa. Escolha outro.';
  }
  if (/usuarios_usuario_formato|violates check constraint/i.test(m)) {
    return 'Login inválido: use de 3 a 30 caracteres, só letras, números, '
      + 'ponto, traço ou sublinhado — sem espaço e sem acento.';
  }
  return null;
}

/* ---------------------------------------------------------------- ficha da pessoa */

function abrirPessoa(id) {
  const u = id ? gente.find(x => x.id === id) : null;
  editando = u
    ? { ...u, modulos: [...(u.modulos || [])], telas: [...(u.telas || [])],
        locais: [...(locaisPorUsuario[u.id] || [])], novo: false }
    : { id: null, nome: '', email: '', usuario: '', admin: false, perfil: 'CONSULTA',
        modulos: [...MODULOS_PADRAO], telas: [], locais: [], ativo: true, novo: true };

  const locais = q.ativos('locais');
  abrirModal(u ? 'Editar pessoa' : 'Adicionar pessoa', `
    <form id="us-form">
      <div class="campo"><label for="us-nome">Nome</label>
        <input type="text" id="us-nome" value="${esc(editando.nome || '')}" required></div>
      <div class="campo"><label for="us-email">E-mail do login</label>
        <input type="email" id="us-email" value="${esc(editando.email || '')}"
          ${u ? 'disabled' : 'required'}>
        <p class="ajuda">É por ele que o Supabase manda a senha nova. Não aparece para os outros.</p></div>
      <div class="campo"><label for="us-usuario">Nome de usuário</label>
        <input type="text" id="us-usuario" value="${esc(editando.usuario || '')}"
          autocapitalize="none" spellcheck="false" placeholder="ex.: joao.silva">
        <p class="ajuda">É o que a pessoa digita para entrar. De 3 a 30 caracteres,
          sem espaço e sem acento. Em branco, ela entra pelo e-mail.</p></div>

      <label class="us-admin"><input type="checkbox" id="us-admin"
        ${editando.admin ? 'checked' : ''}> <strong>Administrador</strong>
        <small>enxerga tudo e mexe nesta lista</small></label>

      <h2>Fazendas</h2>
      <p class="ajuda">Sem nenhuma marcada, a pessoa não vê máquina alguma —
        a não ser que seja administrador, que vê todas.</p>
      <div class="us-locais">${locais.map(l => `
        <label><input type="checkbox" class="us-local" value="${esc(l.id)}"
          ${editando.locais.includes(l.id) ? 'checked' : ''}> ${esc(l.nome)}</label>`).join('')}</div>

      <h2>O que ela enxerga</h2>
      <div id="us-permissoes"></div>

      <div class="acoes">
        <button type="submit" class="btn">${u ? 'Salvar' : 'Criar login e acesso'}</button>
        ${u ? '<button type="button" class="btn secundario" id="us-senha-nova">Gerar senha nova</button>' : ''}
        ${u && u.id !== (App.usuario || {}).id
          ? `<button type="button" class="btn-fantasma" id="us-tirar">${u.ativo === false ? 'Reativar' : 'Tirar acesso'}</button>` : ''}
      </div>
      <div id="us-senha" class="us-senha oculto"></div>
    </form>`, () => {
    desenharPermissoes();
    $('#us-admin').onchange = () => { editando.admin = $('#us-admin').checked; desenharPermissoes(); };
    $('#us-form').onsubmit = salvarPessoa;
    const bs = $('#us-senha-nova'); if (bs) bs.onclick = senhaNova;
    const bt = $('#us-tirar'); if (bt) bt.onclick = tirarAcesso;
  });
}

/* O que a pessoa enxerga: o módulo e, dentro dele, as telas. Deixar todas as
   telas desmarcadas quer dizer "o módulo inteiro" — é o caso normal. Marcar
   uma só é o que se faz para quem vem de fora. */
function desenharPermissoes() {
  const e = editando;
  const temModulo = m => e.admin || (e.modulos || []).includes(m);
  const marcada = (m, t) => (e.telas || []).includes(m + ':' + t);
  const restrito = m => (e.telas || []).some(x => x.startsWith(m + ':'));

  $('#us-permissoes').innerHTML = MODULOS.map(m => `
    <div class="us-mod ${temModulo(m.id) ? '' : 'desligado'}">
      <label class="us-mod-topo">
        <input type="checkbox" data-mod="${m.id}" ${temModulo(m.id) ? 'checked' : ''}
          ${e.admin ? 'disabled title="Administrador enxerga tudo"' : ''}>
        <strong>${esc(m.nome)}</strong>
        <small>${m.admin ? 'só administrador'
          : (restrito(m.id) ? 'só as telas marcadas' : 'todas as telas')}</small>
      </label>
      <div class="us-telas">${m.telas.map(([tid, rot]) => `
        <label><input type="checkbox" data-mod="${m.id}" data-tela="${tid}"
          ${marcada(m.id, tid) ? 'checked' : ''}
          ${temModulo(m.id) && !e.admin ? '' : 'disabled'}> ${esc(rot)}</label>`).join('')}</div>
    </div>`).join('');

  $$('#us-permissoes input[data-mod]').forEach(cx => cx.onchange = () => {
    const m = cx.dataset.mod;
    if (cx.dataset.tela) {
      const chave = m + ':' + cx.dataset.tela;
      const lista = new Set(e.telas || []);
      cx.checked ? lista.add(chave) : lista.delete(chave);
      e.telas = [...lista];
    } else {
      const lista = new Set(e.modulos || []);
      if (cx.checked) lista.add(m);
      else {
        lista.delete(m);
        e.telas = (e.telas || []).filter(x => !x.startsWith(m + ':'));  // tirou o módulo
      }
      e.modulos = [...lista];
    }
    desenharPermissoes();
  });
}

function lerFicha() {
  const usuario = $('#us-usuario').value.trim().toLowerCase();
  return {
    ...editando,
    nome: $('#us-nome').value.trim(),
    email: ($('#us-email').value || editando.email || '').trim().toLowerCase(),
    usuario: usuario || null,
    admin: $('#us-admin').checked,
    locais: $$('.us-local').filter(c => c.checked).map(c => c.value),
  };
}

function mostrarSenha(html, erro = false) {
  const caixa = $('#us-senha');
  caixa.className = 'us-senha' + (erro ? ' erro' : '');
  caixa.innerHTML = html;
  const b = $('#us-copiar');
  if (b) b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.senha); b.textContent = 'Copiada'; }
    catch { b.textContent = 'Selecione e copie'; }
  };
}

async function salvarPessoa(ev) {
  ev.preventDefault();
  const u = lerFicha();
  if (!u.nome) return aviso('Falta o nome.', true);
  if (u.usuario && !/^[a-z0-9._-]{3,30}$/.test(u.usuario)) {
    return aviso('Login inválido: de 3 a 30 caracteres, só letras, números, ponto, traço ou sublinhado.', true);
  }
  if (u.usuario && gente.some(x => x.usuario === u.usuario && x.id !== u.id)) {
    return aviso('Esse login já é de outra pessoa. Escolha outro.', true);
  }

  if (editando.novo) {
    // Pessoa nova: o login é criado no servidor, porque a chave que cria
    // login não pode existir no navegador.
    mostrarSenha('<p>Criando o acesso…</p>');
    try {
      const { data, error } = await App.sb.functions.invoke('criar-usuario', {
        body: { email: u.email, nome: u.nome, usuario: u.usuario, admin: u.admin,
                perfil: u.admin ? 'ADMINISTRADOR' : 'CONSULTA',
                modulos: u.modulos, telas: u.telas, locais: u.locais },
      });
      if (error) throw error;
      if (data?.erro) throw new Error(data.erro);
      mostrarSenha(data.jaExistia
        ? '<strong>Esse e-mail já tinha login.</strong> A senha continua a mesma; o que mudou foi o acesso.'
        : `<strong>Login criado.</strong> Anote a senha agora — ela não fica guardada
           e não dá para ver de novo:<br><br><code>${esc(data.senha)}</code>
           <div class="acoes"><button type="button" class="btn-fantasma" id="us-copiar"
             data-senha="${esc(data.senha)}">Copiar</button>
           <small>Peça para a pessoa trocar no primeiro acesso.</small></div>`);
      editando.novo = false;
      editando.id = data.id;
      $('#us-email').disabled = true;
      await carregarGente();
      return;   // o modal fica aberto para copiar a senha
    } catch (e) {
      mostrarSenha('<strong>Não consegui criar o acesso.</strong><br>' + esc(e.message || String(e)), true);
      return;
    }
  }

  if (!await gravarPessoa(u)) return;
  await salvarLocais(u);
  await carregarGente();
  fecharModal();
  TELAS.config($('#tela'));
  if (u.id === (App.usuario || {}).id) { App.usuario = u; carregarAcesso(u); montarMenu(); abrirModulo('config'); }
}

/** Troca a lista de fazendas da pessoa pela que está marcada na ficha. */
async function salvarLocais(u) {
  const antes = new Set(locaisPorUsuario[u.id] || []);
  const agora = new Set(u.locais || []);
  const entrar = [...agora].filter(x => !antes.has(x));
  const sair = [...antes].filter(x => !agora.has(x));
  if (sair.length) {
    await App.sb.from('usuario_locais').delete().eq('usuario_id', u.id).in('local_id', sair);
  }
  if (entrar.length) {
    await App.sb.from('usuario_locais')
      .insert(entrar.map(local_id => ({ usuario_id: u.id, local_id })));
  }
}

async function senhaNova() {
  if (!editando?.email) return;
  if (!confirm(`Gerar uma senha nova para ${editando.nome}?\n\n`
    + 'A senha atual deixa de funcionar na hora, e a nova aparece uma vez só.')) return;
  mostrarSenha('<p>Gerando…</p>');
  try {
    const { data, error } = await App.sb.functions.invoke('criar-usuario', {
      body: { acao: 'senha', email: editando.email },
    });
    if (error) throw error;
    if (data?.erro) throw new Error(data.erro);
    mostrarSenha(`<strong>Senha nova.</strong> Anote agora — ela não fica guardada:<br><br>
      <code>${esc(data.senha)}</code>
      <div class="acoes"><button type="button" class="btn-fantasma" id="us-copiar"
        data-senha="${esc(data.senha)}">Copiar</button>
      <small>A senha anterior já não funciona mais.</small></div>`);
  } catch (e) {
    mostrarSenha('<strong>Não consegui trocar a senha.</strong><br>' + esc(e.message || String(e)), true);
  }
}

/* Cadastro em uso é inativado, nunca apagado: o histórico de quem fez o quê
   continua apontando para a pessoa. */
async function tirarAcesso() {
  const u = gente.find(x => x.id === editando.id);
  if (!u) return;
  const desligar = u.ativo !== false;
  if (desligar && !confirm(`Tirar o acesso de ${u.nome}?\n\n`
    + 'A conta continua existindo e o histórico fica, mas o app deixa de abrir para ela.')) return;
  u.ativo = !desligar;
  if (!await gravarPessoa(u)) return;
  await carregarGente();
  fecharModal();
  TELAS.config($('#tela'));
}

/* Scripts clássicos: publico o que base.js e telas.js usam. */
Object.assign(window, {
  MODULOS, Acesso, carregarAcesso, pode, podeTela, montarMenu, abrirModulo,
  marcarMenu, mostrarInicio, primeiraTela, modulosLiberados,
});
