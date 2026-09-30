-- ===================================================================
-- Padroniza a grafia das cidades já gravadas (leads, obras, clientes)
-- "Criciuma" / "CRICIÚMA" -> "Criciúma", "Ararangua" -> "Araranguá" etc.
-- Cidades fora da lista (ex.: "Arroio", "qq") não são alteradas.
-- ===================================================================
WITH mapa(chave, cidade) AS (VALUES
  ('balneario rincao', 'Balneário Rincão'), ('rincao', 'Balneário Rincão'),
  ('cocal do sul', 'Cocal do Sul'), ('criciuma', 'Criciúma'), ('forquilhinha', 'Forquilhinha'),
  ('icara', 'Içara'), ('lauro muller', 'Lauro Müller'), ('morro da fumaca', 'Morro da Fumaça'),
  ('nova veneza', 'Nova Veneza'), ('orleans', 'Orleans'), ('sideropolis', 'Siderópolis'),
  ('treviso', 'Treviso'), ('urussanga', 'Urussanga'),
  ('ararangua', 'Araranguá'), ('maracaja', 'Maracajá'), ('sombrio', 'Sombrio'), ('sao joaquim', 'São Joaquim')
),
l AS (
  UPDATE leads t SET cidade = m.cidade FROM mapa m
  WHERE lower(translate(trim(t.cidade), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) = m.chave
    AND t.cidade IS DISTINCT FROM m.cidade
  RETURNING 1
),
o AS (
  UPDATE obras t SET cidade = m.cidade FROM mapa m
  WHERE lower(translate(trim(t.cidade), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) = m.chave
    AND t.cidade IS DISTINCT FROM m.cidade
  RETURNING 1
),
c AS (
  UPDATE clientes t SET endereco_cidade = m.cidade FROM mapa m
  WHERE lower(translate(trim(t.endereco_cidade), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) = m.chave
    AND t.endereco_cidade IS DISTINCT FROM m.cidade
  RETURNING 1
)
SELECT (SELECT count(*) FROM l) AS leads_corrigidos,
       (SELECT count(*) FROM o) AS obras_corrigidas,
       (SELECT count(*) FROM c) AS clientes_corrigidos;
