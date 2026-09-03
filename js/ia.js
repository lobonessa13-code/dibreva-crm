// ===== Cliente da API Claude (chamada direta do navegador) =====
// A chave fica no localStorage deste navegador (configurada em setup.html).
// Mesmo padrão usado pelo antigo módulo de Vistoria.

const IA = {
  MODEL: 'claude-opus-5',
  STORAGE_KEY: 'dibreva_claude_key',
  ENDPOINT: 'https://api.anthropic.com/v1/messages',

  getKey() {
    return localStorage.getItem(this.STORAGE_KEY) || '';
  },

  hasKey() {
    return this.getKey().startsWith('sk-ant-');
  },

  /**
   * Chama a Messages API.
   * @param {Object} opts
   * @param {string|Array} opts.system  - prompt de sistema (string ou blocos com cache_control)
   * @param {Array} opts.messages       - histórico [{role, content}]
   * @param {Array} [opts.tools]        - definições de ferramentas
   * @param {number} [opts.maxTokens]   - padrão 16000
   * @param {string} [opts.effort]      - low | medium | high
   * @returns {Promise<Object>} resposta completa da API
   */
  async chat({ system, messages, tools = [], maxTokens = 16000, effort = 'medium' }) {
    const key = this.getKey();
    if (!key) {
      throw new Error('Chave da API Claude não configurada. Vá em Configurações e salve a chave.');
    }

    const body = {
      model: this.MODEL,
      max_tokens: maxTokens,
      system,
      messages,
      output_config: { effort },
    };
    if (tools.length) {
      body.tools = tools;
      body.tool_choice = { type: 'auto' };
    }

    let resp;
    try {
      resp = await fetch(this.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error('Erro de rede ao chamar a API Claude:', err);
      throw new Error('Falha de conexão com a API Claude. Verifique sua internet.');
    }

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const msg = err?.error?.message || `HTTP ${resp.status}`;
      console.error('Erro da API Claude:', err);
      if (resp.status === 401) throw new Error('Chave da API inválida. Confira em Configurações.');
      if (resp.status === 429) throw new Error('Limite de requisições atingido. Aguarde alguns segundos e tente de novo.');
      if (resp.status === 529) throw new Error('API Claude sobrecarregada no momento. Tente novamente em instantes.');
      throw new Error(`Erro da API Claude: ${msg}`);
    }

    const data = await resp.json();
    if (data.stop_reason === 'refusal') {
      throw new Error('A IA recusou esta solicitação. Reformule o pedido.');
    }
    return data;
  },

  /** Extrai o texto dos blocos de uma resposta */
  textOf(response) {
    return (response?.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();
  },

  /** Extrai os blocos tool_use de uma resposta */
  toolUsesOf(response) {
    return (response?.content || []).filter(b => b.type === 'tool_use');
  },
};
