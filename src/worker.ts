interface Env {
  CLOUD_API_KEY: string;
  CLOUD_API_URL: string;
  LOCAL_INFERENCE_URL: string;
  MODELS_KV: KVNamespace;
}

interface ModelRegistration {
  name: string;
  version: string;
  provider: 'ollama' | 'vllm';
  endpoint: string;
  capabilities: string[];
  fallbackThreshold: number;
  registeredAt: string;
}

interface InferenceRequest {
  model: string;
  prompt: string;
  parameters?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  };
}

interface InferenceResponse {
  result: string;
  confidence: number;
  usedLocal: boolean;
  modelVersion: string;
  processingTime: number;
  costSaved: number;
}

interface HealthResponse {
  status: string;
  timestamp: string;
  localInferenceAvailable: boolean;
  cloudAvailable: boolean;
}

const HTML_HEADER = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self';">
  <meta http-equiv="X-Frame-Options" content="DENY">
  <title>Local Inference Bridge</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0a0a0f;
      color: #e2e8f0;
      line-height: 1.6;
      min-height: 100vh;
    }
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url('https://rsms.me/inter/font-files/Inter-Regular.woff2') format('woff2');
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    header {
      border-bottom: 2px solid #10b981;
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    h1 {
      color: #10b981;
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      color: #94a3b8;
      font-size: 1.1rem;
    }
    .card {
      background: #1a1a2e;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border-left: 4px solid #10b981;
    }
    h2 {
      color: #10b981;
      margin-bottom: 1rem;
    }
    .endpoint {
      background: #0f172a;
      padding: 1rem;
      border-radius: 6px;
      margin: 1rem 0;
      font-family: 'Monaco', monospace;
    }
    .method {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-weight: bold;
      margin-right: 1rem;
    }
    .get { background: #10b981; color: #0a0a0f; }
    .post { background: #3b82f6; color: white; }
    .footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid #334155;
      text-align: center;
      color: #64748b;
      font-size: 0.9rem;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
    }
    .stat-card {
      background: #1e293b;
      padding: 1.5rem;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value {
      font-size: 2rem;
      color: #10b981;
      font-weight: bold;
    }
    .stat-label {
      color: #94a3b8;
      font-size: 0.9rem;
      margin-top: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Local Inference Bridge</h1>
      <p class="subtitle">Run locally first, cloud only when needed</p>
    </header>`;

const HTML_FOOTER = `    <div class="footer">
      <p>Local Inference Bridge v1.0 • Powered by Cloudflare Workers</p>
      <p>Security: CSP Enabled • X-Frame-Options: DENY • Zero Dependencies</p>
    </div>
  </div>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'GET' && path === '/') {
      return this.handleRoot();
    }

    if (request.method === 'GET' && path === '/health') {
      return this.handleHealth(env);
    }

    if (request.method === 'POST' && path === '/api/register') {
      return this.handleRegister(request, env);
    }

    if (request.method === 'GET' && path === '/api/models') {
      return this.handleGetModels(env);
    }

    if (request.method === 'POST' && path === '/api/infer') {
      return this.handleInference(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },

  async handleRoot(): Promise<Response> {
    const html = `${HTML_HEADER}
      <div class="card">
        <h2>Local Inference Bridge</h2>
        <p>Bridge for Jetson Ollama/vLLM local inference with fallback to cloud on low confidence.</p>
      </div>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-value">Local First</div>
          <div class="stat-label">Primary inference runs on local hardware</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">Confidence Fallback</div>
          <div class="stat-label">Cloud only when confidence is low</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">Cost Tracking</div>
          <div class="stat-label">Real-time savings calculation</div>
        </div>
      </div>

      <div class="card">
        <h2>API Endpoints</h2>
        
        <div class="endpoint">
          <span class="method post">POST</span>
          <strong>/api/register</strong>
          <p>Register a local inference model (Ollama/vLLM)</p>
        </div>

        <div class="endpoint">
          <span class="method get">GET</span>
          <strong>/api/models</strong>
          <p>List all registered models with versions</p>
        </div>

        <div class="endpoint">
          <span class="method post">POST</span>
          <strong>/api/infer</strong>
          <p>Perform inference with local fallback to cloud</p>
        </div>

        <div class="endpoint">
          <span class="method get">GET</span>
          <strong>/health</strong>
          <p>Health check endpoint</p>
        </div>
      </div>${HTML_FOOTER}`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' https://rsms.me;"
      }
    });
  },

  async handleHealth(env: Env): Promise<Response> {
    const health: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      localInferenceAvailable: !!env.LOCAL_INFERENCE_URL,
      cloudAvailable: !!(env.CLOUD_API_KEY && env.CLOUD_API_URL)
    };

    return new Response(JSON.stringify(health, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'X-Frame-Options': 'DENY'
      }
    });
  },

  async handleRegister(request: Request, env: Env): Promise<Response> {
    try {
      const data = await request.json() as ModelRegistration;
      
      if (!data.name || !data.version || !data.endpoint) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const modelKey = `model:${data.name}:${data.version}`;
      const modelData: ModelRegistration = {
        ...data,
        registeredAt: new Date().toISOString()
      };

      await env.MODELS_KV.put(modelKey, JSON.stringify(modelData));

      return new Response(JSON.stringify({
        success: true,
        message: `Model ${data.name} v${data.version} registered successfully`,
        modelKey
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async handleGetModels(env: Env): Promise<Response> {
    try {
      const models: ModelRegistration[] = [];
      const list = await env.MODELS_KV.list();
      
      for (const key of list.keys) {
        const modelData = await env.MODELS_KV.get(key.name, 'json') as ModelRegistration;
        if (modelData) {
          models.push(modelData);
        }
      }

      return new Response(JSON.stringify({ models }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch models' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async handleInference(request: Request, env: Env): Promise<Response> {
    const startTime = Date.now();
    
    try {
      const data = await request.json() as InferenceRequest;
      
      if (!data.model || !data.prompt) {
        return new Response(JSON.stringify({ error: 'Missing model or prompt' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let localResult: InferenceResponse | null = null;
      let usedLocal = false;
      let confidence = 0;
      let result = '';
      let modelVersion = 'unknown';

      try {
        const modelKey = `model:${data.model}:latest`;
        const modelData = await env.MODELS_KV.get(modelKey, 'json') as ModelRegistration;
        
        if (modelData && env.LOCAL_INFERENCE_URL) {
          const localResponse = await fetch(`${env.LOCAL_INFERENCE_URL}/infer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });

          if (localResponse.ok) {
            localResult = await localResponse.json() as InferenceResponse;
            confidence = localResult.confidence || this.calculateConfidence(localResult.result);
            usedLocal = true;
            result = localResult.result;
            modelVersion = modelData.version;
          }
        }
      } catch (localError) {
        console.log('Local inference failed, falling back to cloud');
      }

      if (!usedLocal || confidence < 0.7) {
        usedLocal = false;
        
        if (!env.CLOUD_API_KEY || !env.CLOUD_API_URL) {
          return new Response(JSON.stringify({ error: 'Cloud inference not configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const cloudResponse = await fetch(env.CLOUD_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.CLOUD_API_KEY}`
          },
          body: JSON.stringify(data)
        });

        if (!cloudResponse.ok) {
          throw new Error('Cloud inference failed');
        }

        const cloudResult = await cloudResponse.json();
        result = cloudResult.choices?.[0]?.text || cloudResult.result || '';
        confidence = 0.9;
        modelVersion = 'cloud-latest';
      }

      const processingTime = Date.now() - startTime;
      const costSaved = usedLocal ? this.estimateCostSavings(result.length) : 0;

      const response: InferenceResponse = {
        result,
        confidence,
        usedLocal,
        modelVersion,
        processingTime,
        costSaved
      };

      return new Response(JSON.stringify(response, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Inference failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  calculateConfidence(text: string): number {
    if (!text || text.length < 10) return 0.3;
    
    const hasCompleteSentence = /[.!?]$/.test(text.trim());
    const hasReasonableLength = text.length > 20;
    const hasNoErrors = !/(error|failed|undefined|null)/i.test(text);
    
    let score = 0.5;
    if (hasCompleteSentence) score += 0.2;
    if (hasReasonableLength) score += 0.2;
    if (hasNoErrors) score += 0.1;
    
    return Math.min(Math.max(score, 0), 1);
  },

  estimateCostSavings(chars: number): number {
    const cloudCostPerChar = 0.00002;
    const localCostPerChar = 0.000001;
    return (cloudCostPerChar - localCostPerChar) * chars;
  }
};