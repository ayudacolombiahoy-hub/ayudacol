-- Amplía el catálogo de municipios de los 5 departamentos afectados.
-- Códigos DANE (DIVIPOLA). Para producción conviene validar/completar con el
-- dataset oficial del DANE; esta lista cubre los municipios más relevantes.
insert into municipios (codigo_dane, nombre, departamento) values
  -- Caldas
  ('17013','Aguadas','Caldas'),
  ('17050','Aranzazu','Caldas'),
  ('17380','La Dorada','Caldas'),
  ('17433','Manzanares','Caldas'),
  ('17442','Marmato','Caldas'),
  ('17444','Marquetalia','Caldas'),
  ('17541','Pensilvania','Caldas'),
  ('17614','Riosucio','Caldas'),
  ('17653','Salamina','Caldas'),
  ('17662','Samaná','Caldas'),
  ('17665','San José','Caldas'),
  ('17777','Supía','Caldas'),
  ('17877','Viterbo','Caldas'),
  -- Risaralda
  ('66045','Apía','Risaralda'),
  ('66075','Balboa','Risaralda'),
  ('66088','Belén de Umbría','Risaralda'),
  ('66318','Guática','Risaralda'),
  ('66383','La Celia','Risaralda'),
  ('66456','Mistrató','Risaralda'),
  ('66572','Pueblo Rico','Risaralda'),
  ('66594','Quinchía','Risaralda'),
  ('66687','Santuario','Risaralda'),
  -- Quindío
  ('63111','Buenavista','Quindío'),
  ('63212','Córdoba','Quindío'),
  ('63302','Génova','Quindío'),
  ('63548','Pijao','Quindío'),
  -- Valle del Cauca
  ('76111','Guadalajara de Buga','Valle del Cauca'),
  ('76834','Tuluá','Valle del Cauca'),
  ('76147','Cartago','Valle del Cauca'),
  ('76736','Sevilla','Valle del Cauca'),
  ('76122','Caicedonia','Valle del Cauca'),
  ('76895','Zarzal','Valle del Cauca'),
  ('76622','Roldanillo','Valle del Cauca'),
  ('76130','Candelaria','Valle del Cauca'),
  ('76275','Florida','Valle del Cauca'),
  ('76563','Pradera','Valle del Cauca'),
  -- Chocó
  ('27006','Acandí','Chocó'),
  ('27073','Bagadó','Chocó'),
  ('27077','Bajo Baudó','Chocó'),
  ('27413','Lloró','Chocó'),
  ('27425','Medio Atrato','Chocó'),
  ('27495','Nuquí','Chocó'),
  ('27615','Riosucio','Chocó'),
  ('27800','Unión Panamericana','Chocó')
on conflict (codigo_dane) do nothing;
