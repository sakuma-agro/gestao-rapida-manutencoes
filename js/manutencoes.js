/* ============================================================== MANUTENÇÕES
   O livro do que já foi feito na frota, e o lugar de lançar o que acabou de
   ser feito sem precisar abrir ordem de serviço.

   Por que existe: a OS serve para o serviço planejado, que sai da oficina com
   lista de peça. Muita coisa acontece fora disso — o técnico foi na máquina e
   ativou o sinal de GPS, que vence daqui um ano. Isso precisa entrar no
   histórico e passar a vencer, e ninguém vai abrir OS para isso.

   O que o registro faz, em uma gravação só:
   1. entra no histórico (tabela manutencoes, sem os_id);
   2. se o horímetro foi informado, vira leitura no histórico da máquina;
   3. atualiza a última troca do plano daquele item — é o que recalcula o
      vencimento no painel;
   4. se aquele item ainda não existia na máquina, cria o plano com a
      periodicidade informada na hora.

   Tudo funciona sem sinal: grava no aparelho e sobe pela fila. */

/* -------------------------------------------------------------- utilidades */

/* Rótulo da unidade da máquina, para o formulário não pedir "horímetro" a um
   caminhão que anda em quilômetro. */
function rotuloLeitura(e) {
  const u = unidadeDe(e);
  return u === 'km' ? 'Hodômetro no dia' : 'Horímetro no dia';
}

/* O plano daquele item naquela máquina — pode não existir ainda. */
function planoDe(idMaquina, idTipo) {
  return q.ativos('planos_manutencao').find(p =>
    p.equipamento_id === idMaquina && p.tipo_manutencao_id === idTipo);
}

function periodicidadeEmTexto(p) {
  if (!p) return null;
  const partes = [];
  if (p.periodicidade_horas) partes.push(nHoras(p.periodicidade_horas) + ' h');
  if (p.periodicidade_dias) partes.push(p.periodicidade_dias + ' dias');
  return partes.length ? 'a cada ' + partes.join(' ou ') : 'sem periodicidade';
}

/* -------------------------------------------------------------------- tela */

let filtroMan = { busca: '', tipo: '', periodo: '90' };

TELAS.manutencoes = el => {
  el.innerHTML = `
    <h1>Manutenções feitas</h1>
    <p class="sub">O histórico do que já foi executado na frota. Serviço que saiu de
       ordem de serviço entra aqui sozinho; o que foi feito na hora, você lança
       no botão ao lado — e o vencimento se recalcula.</p>
    <div class="filtros">
      <input type="search" id="mn-busca" placeholder="Buscar máquina" value="${esc(filtroMan.busca)}">
      <select id="mn-tipo"><option value="">Todos os itens</option>
        ${q.ordenado('tipos_manutencao').map(t =>
          `<option value="${esc(t.id)}">${esc(t.nome)}</option>`).join('')}
      </select>
      <select id="mn-periodo">
        <option value="30">Últimos 30 dias</option>
        <option value="90">Últimos 90 dias</option>
        <option value="365">Último ano</option>
        <option value="">Tudo</option>
      </select>
      <button type="button" class="btn" id="mn-nova">Registrar manutenção</button>
    </div>
    <div id="mn-lista"></div>`;

  $('#mn-tipo').value = filtroMan.tipo;
  $('#mn-periodo').value = filtroMan.periodo;
  ['mn-busca', 'mn-tipo', 'mn-periodo'].forEach(id => {
    const c = document.getElementById(id);
    c.oninput = c.onchange = () => {
      filtroMan = { busca: $('#mn-busca').value, tipo: $('#mn-tipo').value,
                    periodo: $('#mn-periodo').value };
      desenharManutencoes();
    };
  });
  $('#mn-nova').onclick = () => formManutencao();

  desenharManutencoes();
};

function desenharManutencoes() {
  const busca = (filtroMan.busca || '').toLowerCase();
  const limite = filtroMan.periodo
    ? new Date(Date.now() - Number(filtroMan.periodo) * 86400000).toISOString().slice(0, 10)
    : null;

  const linhas = q.todos('manutencoes')
    .map(m => ({ m, e: q.por_id('equipamentos', m.equipamento_id) }))
    .filter(({ m, e }) => {
      if (!e) return false;                       // máquina de outro local
      if (filtroMan.tipo && m.tipo_manutencao_id !== filtroMan.tipo) return false;
      if (limite && m.data_manutencao < limite) return false;
      if (busca && !(e.codigo + ' ' + e.descricao).toLowerCase().includes(busca)) return false;
      return true;
    })
    .sort((a, b) => String(b.m.data_manutencao).localeCompare(String(a.m.data_manutencao))
      || String(b.m.registrado_em || '').localeCompare(String(a.m.registrado_em || '')));

  if (linhas.length === 0) {
    $('#mn-lista').innerHTML = `<div class="vazio">
      <p>Nenhuma manutenção registrada com esses filtros.</p>
      <button type="button" class="btn" onclick="formManutencao()">Registrar a primeira</button>
    </div>`;
    return;
  }

  $('#mn-lista').innerHTML = `<p class="sub">${linhas.length}
      ${linhas.length === 1 ? 'registro' : 'registros'}</p>
    <table class="tabela"><thead><tr>
      <th>Data</th><th>Máquina</th><th>Item</th><th class="num">Leitura</th>
      <th>Quem fez</th><th>Observação</th><th>Origem</th>
    </tr></thead><tbody>` + linhas.map(({ m, e }) => {
      const os = m.os_id ? q.por_id('ordens_servico', m.os_id) : null;
      return `<tr>
        <td>${formatarData(m.data_manutencao)}</td>
        <td><span class="codigo">${esc(e.codigo)}</span><br><small>${esc(e.descricao)}</small></td>
        <td>${esc(q.nome('tipos_manutencao', m.tipo_manutencao_id))}</td>
        <td class="num">${m.leitura == null ? '—' : nHoras(m.leitura) + ' ' + unidadeDe(e)}</td>
        <td>${esc(m.mecanico_id ? q.nome('mecanicos', m.mecanico_id) : '—')}</td>
        <td><small>${esc(m.observacao || '')}</small></td>
        <td>${os ? '<span class="etq neutro">OS ' + esc(os.numero || '') + '</span>'
                 : '<span class="etq neutro">direto</span>'}</td>
      </tr>`;
    }).join('') + '</tbody></table>';
}

/* ------------------------------------------------------------- formulário */

/* Máquina já escolhida (idMaquina) e item já escolhido (idTipo) são opcionais:
   é assim que o painel de vencimentos poderá chamar esta mesma tela depois,
   com tudo preenchido. */
function formManutencao(idMaquina = '', idTipo = '') {
  const hoje = new Date().toISOString().slice(0, 10);
  const maquinas = q.ativos('equipamentos').slice().sort((a, b) =>
    String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }));
  const mecanicos = q.ordenado('mecanicos');

  abrirModal('Registrar manutenção', `
    <p class="sub">Para o que foi feito agora, sem ordem de serviço. O vencimento
       do item se recalcula na hora.</p>
    <div class="colunas">
      <div class="campo">
        <label for="mf-maquina">Máquina ou equipamento</label>
        <select id="mf-maquina" name="equipamento_id">
          <option value="">— selecione —</option>
          ${maquinas.map(e => `<option value="${esc(e.id)}"${e.id === idMaquina ? ' selected' : ''}
            >${esc(e.codigo)} — ${esc(e.descricao)}</option>`).join('')}
        </select>
      </div>
      <div class="campo">
        <label for="mf-tipo">Item de manutenção</label>
        <select id="mf-tipo" name="tipo_manutencao_id">
          <option value="">— selecione —</option>
          ${q.ordenado('tipos_manutencao').map(t => `<option value="${esc(t.id)}"${
            t.id === idTipo ? ' selected' : ''}>${esc(t.nome)}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Aqui o app responde: esse item já é controlado nessa máquina ou não. -->
    <div id="mf-plano"></div>

    <div class="colunas">
      ${campoTexto('Data do serviço', 'data_manutencao', hoje, 'date')}
      <div class="campo">
        <label for="mf-leitura" id="mf-rot-leitura">Horímetro no dia</label>
        <input type="number" step="0.1" id="mf-leitura" name="leitura">
        <p class="ajuda">O valor do painel no dia do serviço. Em branco quando o item
           é só de calendário.</p>
      </div>
    </div>

    ${mecanicos.length
      ? campoLista('Quem fez', 'mecanico_id', mecanicos, '', '— não informado —')
      : `<div class="campo"><label for="mf-executor">Quem fez</label>
         <input type="text" id="mf-executor" name="executor_nome" placeholder="Nome de quem executou">
         <p class="ajuda">Ainda não há mecânicos cadastrados; por enquanto vai como texto.</p></div>`}

    ${campoArea('O que foi feito', 'observacao', '')}

    <div class="campo">
      <label for="mf-foto">Foto (opcional)</label>
      <input type="file" id="mf-foto" accept="image/*" capture="environment">
      <p class="ajuda">Adesivo da troca, peça trocada, contador. Fica no aparelho e
         sobe sozinha quando houver sinal.</p>
    </div>

    <div class="acoes">
      <button type="button" class="btn" id="mf-salvar">Registrar</button>
      <button type="button" class="btn neutro" id="mf-cancelar">Cancelar</button>
    </div>`, corpo => {

    const sel = corpo.querySelector('#mf-maquina');
    const selT = corpo.querySelector('#mf-tipo');

    /* Mostra a situação do item na máquina e, quando não houver plano, pede a
       periodicidade ali mesmo — é o caso do GPS, que nasce no registro. */
    const pintarPlano = () => {
      const e = q.por_id('equipamentos', sel.value);
      const caixa = corpo.querySelector('#mf-plano');
      const rot = corpo.querySelector('#mf-rot-leitura');
      const campoL = corpo.querySelector('#mf-leitura');

      if (e) {
        rot.textContent = rotuloLeitura(e);
        if (!campoL.value && leituraDe(e) != null) campoL.value = leituraDe(e);
      }
      if (!sel.value || !selT.value) { caixa.innerHTML = ''; return; }

      const plano = planoDe(sel.value, selT.value);
      if (plano) {
        caixa.innerHTML = `<p class="ajuda" style="margin:0 0 12px">
          Item já controlado nesta máquina — <strong>${esc(periodicidadeEmTexto(plano))}</strong>.
          A última troca passa a ser esta data.</p>`;
        return;
      }
      caixa.innerHTML = `
        <div class="vazio" style="text-align:left;padding:10px 12px;margin:0 0 12px">
          <p style="margin:0 0 8px"><strong>Este item ainda não é controlado nesta máquina.</strong>
             Informe de quanto em quanto tempo ele se repete e o app passa a cobrar
             no painel de vencimentos.</p>
          <div class="colunas">
            ${campoTexto('A cada quantas horas', 'periodicidade_horas', '', 'number')}
            ${campoTexto('A cada quantos dias', 'periodicidade_dias', '', 'number')}
          </div>
          <label class="ajuda" style="display:flex;gap:6px;align-items:center;margin:0">
            <input type="checkbox" id="mf-avulso" name="avulso" value="1">
            Serviço avulso — só registrar no histórico, sem controlar vencimento
          </label>
        </div>`;
    };

    sel.onchange = pintarPlano;
    selT.onchange = pintarPlano;
    pintarPlano();

    corpo.querySelector('#mf-cancelar').onclick = fecharModal;
    corpo.querySelector('#mf-salvar').onclick = async () => {
      const d = lerForm(corpo);
      const avulso = !!corpo.querySelector('#mf-avulso')?.checked;

      if (!d.equipamento_id) return aviso('Escolha a máquina.', true);
      if (!d.tipo_manutencao_id) return aviso('Escolha o item de manutenção.', true);
      if (!d.data_manutencao) return aviso('Informe a data do serviço.', true);

      const e = q.por_id('equipamentos', d.equipamento_id);
      const plano = planoDe(d.equipamento_id, d.tipo_manutencao_id);
      const perH = num(d.periodicidade_horas), perD = num(d.periodicidade_dias);

      if (!plano && !avulso && !perH && !perD)
        return aviso('Informe a periodicidade em horas ou em dias, ou marque como serviço avulso.', true);

      const leitura = num(d.leitura);
      const atual = leituraDe(e);
      if (leitura != null && atual != null && leitura < atual &&
          !confirm('A leitura informada (' + nHoras(leitura) + ') é menor que a atual da máquina ('
            + nHoras(atual) + '). Registrar assim mesmo? O contador da máquina não será alterado.'))
        return;

      const btn = corpo.querySelector('#mf-salvar');
      btn.disabled = true; btn.textContent = 'Gravando…';

      try {
        const foto = corpo.querySelector('#mf-foto').files[0];
        const caminho = foto ? await guardarFoto(foto, 'manutencao-registros', d.equipamento_id) : null;

        // 1. o histórico da manutenção
        const man = {
          id: crypto.randomUUID(), uuid_dispositivo: crypto.randomUUID(),
          equipamento_id: e.id, tipo_manutencao_id: d.tipo_manutencao_id,
          local_id: e.local_id, data_manutencao: d.data_manutencao,
          leitura, mecanico_id: d.mecanico_id || null, os_id: null,
          observacao: [d.executor_nome ? 'Executado por ' + d.executor_nome : '', d.observacao]
            .filter(Boolean).join(' — ') || null,
          foto_adesivo_path: caminho,
          criado_por: App.usuario ? App.usuario.id : null,
          registrado_em: new Date().toISOString()
        };
        await gravar('manutencoes', man);

        // 2. a leitura entra no histórico da máquina e, se for a mais recente,
        //    vira o contador atual — mesma regra da tela de horímetro.
        if (leitura != null) {
          await gravar('leituras', {
            id: crypto.randomUUID(), uuid_dispositivo: crypto.randomUUID(),
            equipamento_id: e.id, data_leitura: d.data_manutencao, valor: leitura,
            origem: 'MANUTENCAO',
            observacao: 'Lançada no registro de manutenção — '
              + q.nome('tipos_manutencao', d.tipo_manutencao_id),
            criado_por: App.usuario ? App.usuario.id : null,
            registrado_em: new Date().toISOString()
          });
          if (e.unidade_controle !== 'ACUMULADO' &&
              (atual == null || leitura >= atual) &&
              (!e.leitura_data || d.data_manutencao >= e.leitura_data)) {
            /* gravarBem e não gravar('equipamentos'): horas_acumuladas e
               km_acumulados são colunas calculadas no banco e o Postgres recusa
               a gravação se elas forem junto. */
            await gravarBem(e, { leitura_atual: leitura, leitura_data: d.data_manutencao });
          }
        }

        // 3. o plano: atualiza a última troca ou nasce agora
        if (plano) {
          plano.ultima_troca_data = d.data_manutencao;
          plano.ultima_troca_leitura = leitura != null ? leitura : plano.ultima_troca_leitura;
          await gravar('planos_manutencao', plano);
        } else if (!avulso) {
          await gravar('planos_manutencao', {
            id: crypto.randomUUID(), equipamento_id: e.id,
            tipo_manutencao_id: d.tipo_manutencao_id,
            periodicidade_horas: perH, periodicidade_dias: perD,
            ultima_troca_data: d.data_manutencao, ultima_troca_leitura: leitura,
            ativo: true
          });
        }

        fecharModal();
        if (typeof desenharManutencoes === 'function' && $('#mn-lista')) desenharManutencoes();
        aviso(avulso || plano ? 'Manutenção registrada.'
          : 'Manutenção registrada e o item passou a ser controlado nesta máquina.');
      } catch (erro) {
        console.error(erro);
        btn.disabled = false; btn.textContent = 'Registrar';
        aviso('Não deu para gravar: ' + (erro.message || erro), true);
      }
    };
  });
}
