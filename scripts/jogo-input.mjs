// @ts-check

const MARCADOR = "/* pse-gui-css-scale */";

/**
 * O runner converte coordenadas GUI sem descontar a escala CSS do canvas.
 * Corrige apenas as duas funcoes exportadas, inclusive em builds ofuscados.
 * @param {string} javascript
 * @returns {string}
 */
export function corrigirEscalaGui(javascript) {
  let resultado = javascript;
  for (const [eixo, borda, escala] of [
    ["x", "left", "scaleX"],
    ["y", "top", "scaleY"],
  ]) {
    const nome = `device_mouse_${eixo}_to_gui`;
    const alias = new RegExp(`${nome}\\s*:\\s*"([\\w$]+)"`).exec(resultado)?.[1];
    const simbolo = (alias || nome).replace(/\$/g, "\\$");
    const funcao = new RegExp(
      `function\\s+${simbolo}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?(?=\\bfunction\\s|$)`,
    );
    const trecho = funcao.exec(resultado)?.[0];
    if (!trecho) throw new Error(`Runner HTML5: funcao ${nome} nao encontrada.`);
    if (trecho.includes(MARCADOR)) continue;

    const origem = new RegExp(`\\b${eixo}\\s*-=\\s*([\\w$]+)\\.${borda}\\s*;`, "g");
    const ocorrencias = [...trecho.matchAll(origem)];
    if (ocorrencias.length !== 1) {
      throw new Error(`Runner HTML5: conversao de ${nome} mudou; revise o patch de escala.`);
    }
    // Converte para pixels nativos antes do offset do viewport e da escala GUI.
    const corrigido = trecho.replace(
      origem,
      (_, retangulo) =>
        `${MARCADOR}${eixo}=(${eixo}-${retangulo}.${borda})/${retangulo}.${escala};`,
    );
    resultado = resultado.replace(trecho, corrigido);
  }
  return resultado;
}
