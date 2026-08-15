-- Categoría 'animales' para NECESIDADES: comida, atención veterinaria e insumos
-- para animales (mascotas y ganado). Es una categoría de necesidad, distinta de
-- la sección "Mascotas perdidas/encontradas" (que es su propia entidad).
-- Nota: se ejecuta como statement suelto (no dentro de un CREATE que use el valor).
alter type categoria_necesidad add value if not exists 'animales';
