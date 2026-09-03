const fs = require('fs');
process.chdir('/home/user/buscador_perfumes');
const PERFUMES = new Function(fs.readFileSync('data.js', 'utf8') + '; return PERFUMES;')();
const src = fs.readFileSync('app.js', 'utf8');
function extraer(n) {
  const i = src.indexOf(`const ${n} = {`);
  let j = src.indexOf('{', i), nivel = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === '{') nivel++; else if (src[k] === '}') { nivel--; if (!nivel) break; } }
  return new Function('return ' + src.slice(j, k + 1))();
}
const SUBSUB = extraer('SUBSUBPREGUNTAS');
const activos = PERFUMES.filter(p => p.activo);

console.log('Subfamilia'.padEnd(24) + 'lo que ofrece la pregunta 2.6'.padEnd(58) + 'perfumes que no pueden ganar esos +15');
console.log('-'.repeat(150));
Object.keys(SUBSUB).forEach(sub => {
  const ofrece = SUBSUB[sub].opciones.map(o => o.valor);
  const enSub = activos.filter(p => p.subAroma === sub);
  const fuera = enSub.filter(p => !p.notaEspecifica || !ofrece.includes(p.notaEspecifica));
  console.log(sub.padEnd(24) + ofrece.join(', ').padEnd(58) + `${fuera.length} de ${enSub.length}`);
  fuera.forEach(p => console.log('   '.padEnd(24) + `  · ${p.id} ${p.nombre}  [${p.notaEspecifica || 'sin nota'}]`));
});
