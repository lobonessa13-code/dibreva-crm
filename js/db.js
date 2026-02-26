// ===== CRUD Genérico para Supabase =====

const DB = {
  // Listar registros (com soft delete)
  async list(table, { orderBy = 'created_at', ascending = false, filters = {}, search = null, searchFields = [] } = {}) {
    let query = sb.from(table).select('*').is('deleted_at', null).order(orderBy, { ascending });

    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== '' && value !== 'todos') {
        query = query.eq(key, value);
      }
    }

    if (search && searchFields.length > 0) {
      const orClause = searchFields.map(f => `${f}.ilike.%${search}%`).join(',');
      query = query.or(orClause);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Buscar um registro por ID
  async get(table, id) {
    const { data, error } = await sb.from(table).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  // Criar registro
  async create(table, record) {
    const { data, error } = await sb.from(table).insert(record).select().single();
    if (error) throw error;
    return data;
  },

  // Atualizar registro
  async update(table, id, updates) {
    const { data, error } = await sb.from(table).update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // Soft delete
  async remove(table, id) {
    const { error } = await sb.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    return true;
  },

  // Chamar função RPC (ex: converter_lead_em_obra)
  async rpc(fnName, params = {}) {
    const { data, error } = await sb.rpc(fnName, params);
    if (error) throw error;
    return data;
  },

  // Buscar view/função de KPIs
  async kpis(viewName) {
    const { data, error } = await sb.from(viewName).select('*');
    if (error) throw error;
    return data?.[0] || {};
  },

  // Contagem
  async count(table, filters = {}) {
    let query = sb.from(table).select('*', { count: 'exact', head: true }).is('deleted_at', null);
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== '' && value !== 'todos') {
        query = query.eq(key, value);
      }
    }
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  // Inserir vários registros (para migração)
  async bulkCreate(table, records) {
    const { data, error } = await sb.from(table).insert(records).select();
    if (error) throw error;
    return data;
  }
};
