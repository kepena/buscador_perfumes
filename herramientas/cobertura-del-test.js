/*
 * ¿Hay perfumes que nunca salen en el Top 4?
 *
 * Recorre TODAS las combinaciones de respuestas que el test puede producir
 * y anota qué perfumes aparecen alguna vez. Reusa el motor de puntaje tal
 * como está escrito en app.js, no una versión parecida.
 */
const fs = require('fs');
process.chdir('/home/user/buscador_perfumes');

const PERFUMES = new Function(fs.readFileSync('data.js', 'utf8') + '; return PERFUMES;')();
const src = fs.readFileSync('app.js', 'utf8');

// Saca un `const NOMBRE = {...};` de app.js contando llaves.
function extraer(nombre) {
  const i = src.indexOf(`const ${nombre} = {`);
  if (i < 0) throw new Error('no encuentro ' + nombre);
  let j = src.indexOf('{', i), nivel = 0, k = j;
  for (; k < src.length; k++) {
    if (src[k] === '{') nivel++;
    else if (src[k] === '}') { nivel--; if (nivel === 0) break; }
  }
  return new Function('return ' + src.slice(j, k + 1))();
}

const P1 = extraer('PREGUNTA_1');
const P2 = extraer('PREGUNTA_2');
const SUB = extraer('SUBPREGUNTAS');
const SUBSUB = extraer('SUBSUBPREGUNTAS');
const P3 = extraer('PREGUNTA_3');
const P4 = extraer('PREGUNTA_4');
const P5 = extraer('PREGUNTA_5');
const P6 = extraer('PREGUNTA_6');
const P7 = extraer('PREGUNTA_7');

const val = q => q.opciones.map(o => o.valor);

// --- motor, copiado literal de app.js ---
const ORDEN_PRESUPUESTO = ['Económico', 'Medio', 'Sin límite'];
function presupuestoCompatible(cat, elegido) {
  return ORDEN_PRESUPUESTO.indexOf(cat) <= ORDEN_PRESUPUESTO.indexOf(elegido);
}
function calcularScore(p, cat, r) {
  let s = 0;
  if (p.aromaPrincipal === r.aromaPrincipal) s += 25;
  if (p.subAroma === r.subAroma) s += 15;
  if (r.notaEspecifica && p.notaEspecifica === r.notaEspecifica) s += 15;
  if (r.tipo === 'Cualquiera' || p.tipo === r.tipo) s += 15;
  if (p.momento === r.momento) s += 12;
  if (p.clima === r.clima) s += 10;
  if (p.potencia === r.potencia) s += 8;
  if (p.estilo === r.estilo) s += 5;
  if (r.presupuesto === 'Sin límite' || cat === r.presupuesto) s += 3;
  return s;
}

const activos = PERFUMES.filter(p => p.activo);
// Supuesto: la categoría de precio de cada perfume es la de data.js.
const cat = p => p.presupuesto;

function top4(r) {
  const dentro = activos.filter(p => presupuestoCompatible(cat(p), r.presupuesto));
  const puntuados = dentro.map(p => ({ p, score: calcularScore(p, cat(p), r) }));
  puntuados.sort((a, b) => b.score - a.score);   // orden estable: empata el que va antes en data.js
  return puntuados.slice(0, 4);
}

const visto = new Map();       // id -> veces que sale
const mejorScore = new Map();  // id -> mejor puntaje que llega a sacar
activos.forEach(p => { visto.set(p.id, 0); mejorScore.set(p.id, 0); });

let combos = 0;
for (const tipo of val(P1))
  for (const aroma of val(P2)) {
    const subs = SUB[aroma] ? val(SUB[aroma]) : [null];
    for (const subAroma of subs) {
      const notas = SUBSUB[subAroma] ? val(SUBSUB[subAroma]) : [null];
      for (const notaEspecifica of notas)
        for (const momento of val(P3))
          for (const clima of val(P4))
            for (const estilo of val(P5))
              for (const potencia of val(P6))
              for (const presupuesto of val(P7)) {
                const r = { tipo, aromaPrincipal: aroma, subAroma, notaEspecifica, momento, clima, estilo, potencia, presupuesto };
                combos++;
                top4(r).forEach(x => visto.set(x.p.id, visto.get(x.p.id) + 1));
                // el mejor puntaje alcanzable se mide aparte del top 4
                activos.forEach(p => {
                  if (!presupuestoCompatible(cat(p), presupuesto)) return;
                  const s = calcularScore(p, cat(p), r);
                  if (s > mejorScore.get(p.id)) mejorScore.set(p.id, s);
                });
              }
    }
  }

console.log('combinaciones simuladas:', combos.toLocaleString('es'));
console.log('perfumes activos:', activos.length);

const nunca = activos.filter(p => visto.get(p.id) === 0);
console.log('\n=== NUNCA SALEN EN EL TOP 4:', nunca.length, '===');
nunca.forEach(p => console.log(
  '  ', String(p.id).padStart(3), p.nombre.padEnd(50),
  '| mejor puntaje posible:', mejorScore.get(p.id),
  '|', p.aromaPrincipal, '/', p.subAroma, '/', p.notaEspecifica || '-', '|', p.presupuesto
));

const raros = activos
  .filter(p => visto.get(p.id) > 0)
  .sort((a, b) => visto.get(a.id) - visto.get(b.id))
  .slice(0, 12);
console.log('\n=== LOS 12 QUE MENOS SALEN ===');
raros.forEach(p => console.log(
  '  ', String(p.id).padStart(3), p.nombre.padEnd(50),
  '|', String(visto.get(p.id)).padStart(6), 'veces  (', (visto.get(p.id) / combos * 100).toFixed(2) + '% )'
));

const top = activos.sort((a, b) => visto.get(b.id) - visto.get(a.id)).slice(0, 8);
console.log('\n=== LOS 8 QUE MAS SALEN ===');
top.forEach(p => console.log(
  '  ', String(p.id).padStart(3), p.nombre.padEnd(50),
  '|', String(visto.get(p.id)).padStart(6), 'veces  (', (visto.get(p.id) / combos * 100).toFixed(2) + '% )'
));

console.log('\n=== LOS QUE ESTABAN CASI INVISIBLES ===');
[50, 134, 100, 40, 116, 92, 49, 115, 37, 90].forEach(id => {
  const p = activos.find(x => x.id === id);
  if (p) console.log('  ', String(id).padStart(3), p.nombre.padEnd(50), '|',
    String(visto.get(id)).padStart(5), 'veces  (', (visto.get(id) / combos * 100).toFixed(2) + '% )');
});
