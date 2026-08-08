// 属性コイン制の共通表示処理
// コイン状況は「誰が書き込んでも必ず A軍 → B軍 の順」で表示する。
// （以前は自軍→敵軍の順だったため、書き込む人によって並びが入れ替わり見づらかった）

const ELEMENT_ROW = [
  { key: 'fire',    name: '火',  emoji: '🔥' },
  { key: 'wood',    name: '木',  emoji: '🌲' },
  { key: 'earth',   name: '土',  emoji: ':rock:' },
  { key: 'thunder', name: '雷',  emoji: '⚡' },
  { key: 'water',   name: '水',  emoji: '💧' },
];

// 1軍分のコイン状況テキスト
function formatArmyCoins(armyKey, gameState, armyNames) {
  const cells = ELEMENT_ROW
    .map(el => `${el.emoji} ${el.name}: ${gameState[`${armyKey.toLowerCase()}_${el.key}_coin`]}枚`)
    .join(' ');
  return `-# >>> 【${armyNames[armyKey]}のコイン状況】${cells}\n`;
}

/**
 * 両軍のコイン状況を A軍 → B軍 の固定順で返す
 * @param {object} gameState
 * @param {{A:string,B:string}} armyNames
 */
export function buildCoinStatusFixed(gameState, armyNames) {
  return formatArmyCoins('A', gameState, armyNames) + formatArmyCoins('B', gameState, armyNames);
}

export { ELEMENT_ROW };
