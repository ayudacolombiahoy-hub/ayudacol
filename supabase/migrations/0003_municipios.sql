insert into municipios (codigo_dane, nombre, departamento) values
  -- Caldas
  ('17001','Manizales','Caldas'),
  ('17174','Chinchiná','Caldas'),
  ('17873','Villamaría','Caldas'),
  ('17486','Neira','Caldas'),
  ('17524','Palestina','Caldas'),
  ('17042','Anserma','Caldas'),
  -- Risaralda
  ('66001','Pereira','Risaralda'),
  ('66170','Dosquebradas','Risaralda'),
  ('66682','Santa Rosa de Cabal','Risaralda'),
  ('66400','La Virginia','Risaralda'),
  ('66440','Marsella','Risaralda'),
  -- Quindío
  ('63001','Armenia','Quindío'),
  ('63130','Calarcá','Quindío'),
  ('63470','Montenegro','Quindío'),
  ('63401','La Tebaida','Quindío'),
  ('63190','Circasia','Quindío'),
  ('63594','Quimbaya','Quindío'),
  ('63690','Salento','Quindío'),
  ('63272','Filandia','Quindío'),
  -- Valle del Cauca
  ('76001','Cali','Valle del Cauca'),
  ('76892','Yumbo','Valle del Cauca'),
  ('76364','Jamundí','Valle del Cauca'),
  ('76520','Palmira','Valle del Cauca'),
  ('76109','Buenaventura','Valle del Cauca'),
  -- Chocó
  ('27001','Quibdó','Chocó'),
  ('27361','Istmina','Chocó'),
  ('27787','Tadó','Chocó'),
  ('27205','Condoto','Chocó'),
  ('27075','Bahía Solano','Chocó'),
  ('27050','Atrato','Chocó')
on conflict (codigo_dane) do nothing;
