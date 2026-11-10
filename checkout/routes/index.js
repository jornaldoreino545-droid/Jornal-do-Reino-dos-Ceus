/* ==========================================================================
   CHECKOUT DO JORNAL (Stripe) — cartão e PIX
   - O PREÇO é calculado aqui no servidor (jornais.json + preço padrão do
     dashboard). O navegador nunca define o valor cobrado.
   - Cartão: o servidor cria o pagamento e o navegador confirma com o Stripe.
   - PIX: o servidor cria e confirma o pagamento e devolve o QR Code e o
     "copia e cola"; a página consulta o status até o PIX ser pago.
   - Download: o PDF só é entregue depois que o Stripe confirma o pagamento,
     por um link protegido (/api/download/arquivo).
   - A venda é registrada uma única vez em pagamentos.json.
   - Webhook (/api/stripe/webhook): o Stripe avisa o servidor quando um
     pagamento é aprovado — registra a venda mesmo se o cliente fechar a página
     depois de pagar o PIX.
   Chaves no arquivo .env: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY e
   STRIPE_WEBHOOK_SECRET (o "segredo de assinatura" do webhook, whsec_...)
   ========================================================================== */
const express = require('express');
const path = require('path');
const fs = require('fs-extra');

const router = express.Router();

const RAIZ = path.join(__dirname, '..', '..');
const JORNAIS_FILE = path.join(RAIZ, 'jornais.json');
const SITE_CONFIG_FILE = path.join(RAIZ, 'site-config.json');
const PAGAMENTOS_FILE = path.join(RAIZ, 'pagamentos.json');
const UPLOADS = path.join(RAIZ, 'dashboard-server');

const PIX_VALIDADE_SEGUNDOS = 30 * 60; // o QR Code do PIX vale 30 minutos

let stripeCliente = null;
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const erro = new Error('Pagamento não configurado: falta STRIPE_SECRET_KEY no arquivo .env');
    erro.status = 503;
    throw erro;
  }
  if (!stripeCliente) stripeCliente = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return stripeCliente;
}

function modoTeste() {
  return String(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_');
}

/* ---------------- Produto e preço (sempre do servidor) ---------------- */

async function precoPadrao() {
  try {
    const cfg = await fs.readJson(SITE_CONFIG_FILE);
    const v = Number(cfg && cfg.geral && cfg.geral.edicoes && cfg.geral.edicoes.precoPadrao);
    return v > 0 ? v : 10;
  } catch (e) {
    return 10;
  }
}

function idDoProduto(product) {
  const t = String(product || '').trim();
  return t.startsWith('jornal_') ? t.slice(7) : t;
}

async function buscarJornal(product) {
  const id = idDoProduto(product);
  if (!id) return null;
  const dados = await fs.readJson(JORNAIS_FILE).catch(() => ({ jornais: [] }));
  return (dados.jornais || []).find((j) => String(j.id) === String(id) && j.ativo !== false) || null;
}

async function montarProduto(jornal) {
  const preco = Number(jornal.preco) > 0 ? Number(jornal.preco) : await precoPadrao();
  return {
    id: jornal.id,
    product: 'jornal_' + jornal.id,
    nome: jornal.nome,
    mes: jornal.mes,
    ano: jornal.ano,
    descricao: jornal.descricao || '',
    capa: jornal.capa || '',
    preco,
    centavos: Math.round(preco * 100),
    temPdf: !!jornal.pdf
  };
}

/* ---------------- Registro da venda (uma vez por pagamento) ---------------- */

// As gravações entram numa fila, uma de cada vez: o webhook e a página de
// confirmação podem chegar no mesmo instante e não podem duplicar a venda.
let filaGravacao = Promise.resolve();

function registrarVenda(pi) {
  filaGravacao = filaGravacao.then(() => gravarVenda(pi), () => gravarVenda(pi));
  return filaGravacao;
}

async function gravarVenda(pi) {
  try {
    const dados = (await fs.readJson(PAGAMENTOS_FILE).catch(() => null)) || { pagamentos: [] };
    const lista = dados.pagamentos || [];
    if (lista.some((p) => p.paymentIntentId === pi.id)) return false; // já registrado
    const metodo = (pi.payment_method_types || [])[0] === 'pix' ? 'PIX' : 'Cartão';
    lista.push({
      id: lista.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1,
      paymentIntentId: pi.id,
      nome: pi.metadata.customerName || 'Cliente',
      email: pi.metadata.customerEmail || '',
      jornalId: pi.metadata.productId || '',
      jornalNome: pi.metadata.productName || '',
      valor: pi.amount / 100,
      moeda: String(pi.currency || 'brl').toUpperCase(),
      metodo,
      dataPagamento: new Date().toISOString(),
      dataCriacao: new Date().toISOString()
    });
    dados.pagamentos = lista;
    await fs.writeJson(PAGAMENTOS_FILE, dados, { spaces: 2 });
    return true;
  } catch (e) {
    console.error('Erro ao registrar a venda:', e.message);
    return false;
  }
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function responderErro(res, erro, padrao) {
  if (erro.type === 'StripeInvalidRequestError' && /No such payment_intent/i.test(erro.message)) {
    return res.status(404).json({ error: 'Pagamento não encontrado' });
  }
  console.error(padrao + ':', erro.message);
  const status = erro.status || (erro.type && erro.type.startsWith('Stripe') ? 400 : 500);
  res.status(status).json({ error: erro.status ? erro.message : padrao, detalhe: erro.message });
}

/* ---------------- Rotas ---------------- */

// Chave pública (o navegador usa para o formulário de cartão)
router.get('/api/stripe-config', (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '', modoTeste: modoTeste() });
});

// Dados do produto e preço calculado no servidor
router.get('/api/checkout/produto', async (req, res) => {
  try {
    const jornal = await buscarJornal(req.query.product);
    if (!jornal) return res.status(404).json({ error: 'Edição não encontrada' });
    res.json(await montarProduto(jornal));
  } catch (erro) {
    responderErro(res, erro, 'Erro ao carregar o produto');
  }
});

// Cria o pagamento. body: { product, nome, email, metodo: 'card' | 'pix' }
router.post('/api/checkout/pagamento', async (req, res) => {
  try {
    const { product, metodo } = req.body || {};
    const nome = String((req.body || {}).nome || '').trim();
    const email = String((req.body || {}).email || '').trim().toLowerCase();

    if (nome.length < 3) return res.status(400).json({ error: 'Informe seu nome completo.' });
    if (!emailValido(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
    if (metodo !== 'card' && metodo !== 'pix') return res.status(400).json({ error: 'Forma de pagamento inválida.' });

    const jornal = await buscarJornal(product);
    if (!jornal) return res.status(404).json({ error: 'Edição não encontrada.' });
    const produto = await montarProduto(jornal);
    if (produto.centavos < 50) return res.status(400).json({ error: 'Preço do jornal inválido.' });

    const base = {
      amount: produto.centavos,
      currency: 'brl',
      payment_method_types: [metodo],
      description: produto.nome + ' — Jornal do Reino (PDF)',
      receipt_email: email,
      metadata: {
        productId: String(produto.id),
        productName: produto.nome,
        customerName: nome,
        customerEmail: email
      }
    };

    if (metodo === 'card') {
      const pi = await stripe().paymentIntents.create(base);
      return res.json({ paymentIntentId: pi.id, clientSecret: pi.client_secret, valor: produto.preco });
    }

    // PIX: o servidor já confirma e devolve o QR Code
    const pi = await stripe().paymentIntents.create(Object.assign(base, {
      payment_method_data: { type: 'pix', billing_details: { name: nome, email } },
      payment_method_options: { pix: { expires_after_seconds: PIX_VALIDADE_SEGUNDOS } },
      confirm: true
    }));
    const qr = pi.next_action && pi.next_action.pix_display_qr_code;
    if (!qr) return res.status(500).json({ error: 'O Stripe não devolveu o QR Code do PIX. Tente novamente.' });

    res.json({
      paymentIntentId: pi.id,
      valor: produto.preco,
      pix: {
        codigo: qr.data,
        imagem: qr.image_url_png,
        expiraEm: qr.expires_at,
        // No modo teste, esta página do Stripe permite simular o pagamento
        simular: modoTeste() ? qr.hosted_instructions_url : null
      }
    });
  } catch (erro) {
    responderErro(res, erro, 'Não foi possível iniciar o pagamento');
  }
});

// Status do pagamento (a página do PIX consulta a cada poucos segundos)
router.get('/api/checkout/status', async (req, res) => {
  try {
    const id = String(req.query.payment_intent || '');
    if (!id.startsWith('pi_')) return res.status(400).json({ error: 'Pagamento inválido' });
    const pi = await stripe().paymentIntents.retrieve(id);
    if (pi.status === 'succeeded') await registrarVenda(pi);
    res.json({ status: pi.status });
  } catch (erro) {
    responderErro(res, erro, 'Erro ao consultar o pagamento');
  }
});

// Confirma o pagamento e devolve o link protegido do PDF
router.get('/api/download', async (req, res) => {
  try {
    const id = String(req.query.payment_intent || '');
    if (!id.startsWith('pi_')) return res.status(400).json({ error: 'Pagamento inválido' });
    const pi = await stripe().paymentIntents.retrieve(id);

    if (pi.status !== 'succeeded') {
      return res.status(402).json({ error: 'Pagamento ainda não confirmado', status: pi.status });
    }
    await registrarVenda(pi);

    const jornal = await buscarJornal(pi.metadata.productId);
    const produto = jornal ? await montarProduto(jornal) : null;
    res.json({
      status: pi.status,
      valor: pi.amount / 100,
      metodo: (pi.payment_method_types || [])[0] === 'pix' ? 'PIX' : 'Cartão',
      nome: pi.metadata.customerName,
      email: pi.metadata.customerEmail,
      jornal: produto ? { nome: produto.nome, capa: produto.capa, mes: produto.mes, ano: produto.ano } : { nome: pi.metadata.productName },
      downloadUrl: produto && produto.temPdf ? '/api/download/arquivo?payment_intent=' + encodeURIComponent(pi.id) : null
    });
  } catch (erro) {
    responderErro(res, erro, 'Erro ao verificar o pagamento');
  }
});

// Entrega o PDF (só se o pagamento estiver confirmado no Stripe)
router.get('/api/download/arquivo', async (req, res) => {
  try {
    const id = String(req.query.payment_intent || '');
    if (!id.startsWith('pi_')) return res.status(400).send('Pagamento inválido');
    const pi = await stripe().paymentIntents.retrieve(id);
    if (pi.status !== 'succeeded') return res.status(402).send('Pagamento ainda não confirmado.');

    const jornal = await buscarJornal(pi.metadata.productId);
    if (!jornal || !jornal.pdf) return res.status(404).send('O PDF desta edição ainda não foi enviado. Fale com a gente pelo WhatsApp.');

    const arquivo = path.join(UPLOADS, String(jornal.pdf).replace(/^\/+/, ''));
    if (!arquivo.startsWith(path.join(UPLOADS, 'uploads')) || !(await fs.pathExists(arquivo))) {
      return res.status(404).send('Arquivo do jornal não encontrado no servidor. Fale com a gente pelo WhatsApp.');
    }
    const nomeBonito = String(jornal.nome || 'Jornal do Reino').replace(/[^\wÀ-ú -]/g, '').trim() + (jornal.ano ? ' ' + jornal.ano : '') + '.pdf';
    res.download(arquivo, nomeBonito, { dotfiles: 'allow' });
  } catch (erro) {
    if (erro.type === 'StripeInvalidRequestError') return res.status(404).send('Pagamento não encontrado.');
    console.error('Erro no download:', erro.message);
    res.status(500).send('Erro ao baixar o arquivo. Tente novamente.');
  }
});

/* ---------------- Webhook do Stripe ----------------
   Montado no server.js ANTES do leitor de JSON, porque a assinatura do Stripe
   é conferida sobre o corpo "cru" da requisição. */
async function webhook(req, res) {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segredo) {
    console.error('Webhook do Stripe recebido, mas falta STRIPE_WEBHOOK_SECRET no .env');
    return res.status(503).send('Webhook não configurado');
  }

  let evento;
  try {
    evento = stripe().webhooks.constructEvent(req.body, req.headers['stripe-signature'], segredo);
  } catch (erro) {
    console.error('Webhook do Stripe com assinatura inválida:', erro.message);
    return res.status(400).send('Assinatura inválida');
  }

  try {
    const pi = evento.data && evento.data.object;
    if (evento.type === 'payment_intent.succeeded' && pi) {
      const nova = await registrarVenda(pi);
      console.log(nova ? 'Webhook: venda registrada' : 'Webhook: venda já estava registrada', pi.id, (pi.payment_method_types || [])[0]);
    } else if (evento.type === 'payment_intent.payment_failed' && pi) {
      console.log('Webhook: pagamento recusado', pi.id);
    }
    res.json({ recebido: true });
  } catch (erro) {
    console.error('Erro ao processar o webhook:', erro.message);
    res.status(500).send('Erro ao processar');
  }
}

module.exports = router;
module.exports.webhook = webhook;
