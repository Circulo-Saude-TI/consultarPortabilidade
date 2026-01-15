import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Middleware para parsing JSON
app.use(express.json());

// Configuração segura carregada do .env (não exposta no cliente)
const API_BASE_URL = process.env['API_BASE_URL'];
const AUTH_TOKEN = process.env['API_AUTH_TOKEN'];

if (!API_BASE_URL || !AUTH_TOKEN) {
  console.error('❌ Erro: API_BASE_URL ou API_AUTH_TOKEN não configurados no .env');
  process.exit(1);
}

/**
 * Endpoint seguro para listar declarações
 */
app.post('/api/listar-declaracoes', async (req, res) => {
  try {
    const { chaveUnica } = req.body;

    if (!chaveUnica) {
      return res.status(400).json({ error: 'chaveUnica é obrigatório' });
    }

    console.log(`[listar-declaracoes] Requisição com chaveUnica: ${chaveUnica}`);

    const response = await fetch(`${API_BASE_URL}/listarDeclaracoes/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chaveUnica }),
    });

    console.log(`[listar-declaracoes] Status da resposta: ${response.status}`);

    const data = await response.json();

    if (!response.ok) {
      console.error(`[listar-declaracoes] Erro na API: ${JSON.stringify(data)}`);
      return res.status(response.status).json(data);
    }

    console.log(`[listar-declaracoes] Sucesso`);
    res.json(data);
  } catch (error) {
    console.error('[listar-declaracoes] Erro:', error);
    res.status(500).json({ error: 'Erro ao processar solicitação', details: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * Endpoint seguro para obter declaração em PDF
 */
app.post('/api/declaracao-pdf', async (req, res) => {
  try {
    const { chaveUnica, idDeclaracao } = req.body;

    if (!chaveUnica || !idDeclaracao) {
      return res.status(400).json({ error: 'chaveUnica e idDeclaracao são obrigatórios' });
    }

    console.log(`[declaracao-pdf] Requisição com chaveUnica: ${chaveUnica}, idDeclaracao: ${idDeclaracao}`);

    const response = await fetch(`${API_BASE_URL}/declaracaoPdf/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chaveUnica, idDeclaracao }),
    });

    console.log(`[declaracao-pdf] Status da resposta: ${response.status}`);

    const data = await response.json();

    if (!response.ok) {
      console.error(`[declaracao-pdf] Erro na API: ${JSON.stringify(data)}`);
      return res.status(response.status).json(data);
    }

    console.log(`[declaracao-pdf] Sucesso - documento gerado`);
    res.json(data);
  } catch (error) {
    console.error('[declaracao-pdf] Erro:', error);
    res.status(500).json({ error: 'Erro ao processar solicitação', details: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
