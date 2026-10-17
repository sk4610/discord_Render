import { GameState, User } from '../taisen/game.js';
import { getArmyNames } from '../armyname/armyname.js';
import { checkShusen } from '../taisen/game.js';

// スペルカード制のコアロジック
// 人間（/a /b /c）と軍BOBの双方から同じ関数を使う（判定の二重実装を避けるため）
// ※ このファイルは .js なので main.mjs のコマンド自動読み込み対象にはならない

// ─── 属性定義 ────────────────────────────────────────────────
// next: その属性のカードが成功率を書き換える相手の属性（火→木→土→雷→水→火）
export const ELEMENTS = {
  fire:    { name: '火', emoji: '🔥',     next: 'wood' },
  wood:    { name: '木', emoji: '🌲',     next: 'earth' },
  earth:   { name: '土', emoji: ':rock:', next: 'thunder' },
  thunder: { name: '雷', emoji: '⚡',     next: 'water' },
  water:   { name: '水', emoji: '💧',     next: 'fire' },
};
export const ELEMENT_KEYS = Object.keys(ELEMENTS);

// ─── カード定義（全10種） ────────────────────────────────────
// effect: 'debuff' = 敵軍の next 属性の成功率を33%にする
//         'buff'   = 自軍の next 属性の成功率を100%にする
export const CARDS = {
  fire:      { name: 'ファイア',       element: 'fire',    effect: 'debuff' },
  ifrit:     { name: 'イフリート',     element: 'fire',    effect: 'buff' },
  bamboo:    { name: 'バンブー',       element: 'wood',    effect: 'debuff' },
  orochi:    { name: 'ヤマキノオロチ', element: 'wood',    effect: 'buff' },
  quake:     { name: 'クエイク',       element: 'earth',   effect: 'debuff' },
  titan:     { name: 'タイタン',       element: 'earth',   effect: 'buff' },
  thunder:   { name: 'サンダー',       element: 'thunder', effect: 'debuff' },
  ramuh:     { name: 'ラムウ',         element: 'thunder', effect: 'buff' },
  water:     { name: 'ウォータ',       element: 'water',   effect: 'debuff' },
  leviathan: { name: 'リヴァイアサン', element: 'water',   effect: 'buff' },
};
export const CARD_KEYS = Object.keys(CARDS);

export const SLOT_LABELS = ['A', 'B', 'C'];   // /a /b /c に対応

const DEFAULT_LV = 1;
// 成功率は 33 / 66 / 100 の三段階
//   初期値66%、弱体カードで33%、強化カードで100%
export const DEFAULT_RATE = 66;
export const DEBUFF_RATE = 33;
export const BUFF_RATE = 100;

// ─── データの読み書き ────────────────────────────────────────
function safeParse(raw, fallback) {
  try {
    const d = JSON.parse(raw || '');
    return d ?? fallback;
  } catch {
    return fallback;
  }
}

// 個人の属性Lv（初期値1）
export function parseLevels(raw) {
  const d = safeParse(raw, {});
  const out = {};
  for (const k of ELEMENT_KEYS) out[k] = Number.isInteger(d[k]) && d[k] > 0 ? d[k] : DEFAULT_LV;
  return out;
}

// 軍の属性成功率（初期値50%）
export function parseRates(raw) {
  const d = safeParse(raw, {});
  const out = {};
  for (const k of ELEMENT_KEYS) out[k] = Number.isInteger(d[k]) ? d[k] : DEFAULT_RATE;
  // 移行措置：旧ルール（25/50/100）で保存された値を新ルール（33/66/100）に読み替える。
  // 新ルールでは25と50が出ないので取り違えは起きない。大戦の途中で更新しても破綻しないため
  for (const k of ELEMENT_KEYS) {
    if (out[k] === 50) out[k] = DEFAULT_RATE;
    if (out[k] === 25) out[k] = DEBUFF_RATE;
  }
  return out;
}

// 手札（カードキー3つ）。壊れていたら空として扱い、配り直させる
export function parseHand(raw) {
  const d = safeParse(raw, []);
  if (!Array.isArray(d) || d.length !== 3 || !d.every(k => CARDS[k])) return [];
  return d;
}

// 10種から重複なしで3枚配る
export function dealHand(rng = Math.random) {
  const pool = [...CARD_KEYS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

// ─── 表示用 ──────────────────────────────────────────────────
export function cardLabel(key) {
  const c = CARDS[key];
  return `${ELEMENTS[c.element].emoji}${c.name}`;
}

export function formatHand(hand) {
  return hand.map((k, i) => `**${SLOT_LABELS[i]}** ${cardLabel(k)}`).join(' / ');
}

// カード1枚の効果を、今のLvと成功率で計算した数値で1行にまとめる
// 例: 🔥ファイア〔成功66%〕4ダメージ ／ 敵の木成功率→33%
export function describeCard(key, lv, myRates) {
  const card = CARDS[key];
  const el = ELEMENTS[card.element];
  const L = lv[card.element];

  let effect;
  switch (card.element) {
    case 'fire':    effect = `${L * 2}ダメージ`; break;
    case 'wood':    effect = `${L}ダメージ（敵が優勢なら+${L * 2}）`; break;
    case 'earth':   effect = `${L}ダメージ（自軍が優勢なら+${L * 2}）`; break;
    case 'thunder': effect = `${L}〜${L * 4}ダメージ`; break;
    case 'water':   effect = `${L}ダメージ＋${L}回復`; break;
  }

  const next = ELEMENTS[el.next].name;
  const tail = card.effect === 'debuff'
    ? `敵の${next}成功率→${DEBUFF_RATE}%`
    : `自軍の${next}成功率→${BUFF_RATE}%`;

  return `${cardLabel(key)}〔成功${myRates[card.element]}%〕${effect} ／ ${tail}`;
}

// 手札3枚を効果つきで1枚1行ずつ
export function formatHandDetailed(hand, lv, myRates) {
  return hand.map((k, i) => `-# >>> **${SLOT_LABELS[i]}** ${describeCard(k, lv, myRates)}\n`).join('');
}

// レス下段のステータス欄
// detailed=true  : 手札を効果つきで表示（人間向け。どのカードを選ぶかの判断材料）
// detailed=false : 手札は名前だけの1行（軍BOB向け。投稿が長くなりすぎないように）
export function buildSpellStatusLines(displayName, hand, lv, myRates, armyName, { detailed = true } = {}) {
  const lvText = ELEMENT_KEYS.map(k => `${ELEMENTS[k].name}${lv[k]}`).join(' ');
  const rateText = ELEMENT_KEYS.map(k => `${ELEMENTS[k].name}${myRates[k]}%`).join(' ');
  let s = detailed
    ? `-# >>> 🃏 ${displayName} の手札\n` + formatHandDetailed(hand, lv, myRates)
    : `-# >>> 🃏 ${displayName} の手札: ${formatHand(hand)}\n`;
  s += `-# >>> 📈 Lv: ${lvText}　|　🎯 ${armyName}の成功率: ${rateText}\n`;
  return s;
}

// ─── 雷の倍率抽選: 40%→1 / 30%→2 / 20%→3 / 10%→4 ─────────
export function rollThunderMultiplier(rng = Math.random) {
  const r = rng() * 100;
  if (r < 40) return 1;
  if (r < 70) return 2;
  if (r < 90) return 3;
  return 4;
}

// ─── カード1枚の発動 ─────────────────────────────────────────
// state を直接更新する（同じターン内で次のカードの判定に反映させるため）
// state: { lv, myRates, enemyRates, myHP, enemyHP, initialHP }
// 戻り値: { message, damage, heal, success }
export function resolveCard(cardKey, state, rng = Math.random) {
  const card = CARDS[cardKey];
  const el = ELEMENTS[card.element];
  const rate = state.myRates[card.element];
  const lv = state.lv[card.element];

  let message = `> ${el.emoji} **【${card.name}】** ${el.name}成功率${rate}%`;

  // 成功判定（0〜99 が成功率未満なら成功）
  const roll = Math.floor(rng() * 100);
  if (roll >= rate) {
    message += ` → 判定${String(roll).padStart(2, '0')} **失敗…** 呪文は霧散した\n`;
    return { message, damage: 0, heal: 0, success: false };
  }
  message += ` → 判定${String(roll).padStart(2, '0')} **成功！**\n`;

  let damage = 0;
  let heal = 0;

  const hit = (d) => {
    damage += d;
    state.enemyHP = Math.max(0, state.enemyHP - d);
  };

  switch (card.element) {
    case 'fire': {
      hit(lv * 2);
      message += `-# 　　敵軍に 火Lv${lv}×2 = **${lv * 2}** ダメージ！\n`;
      break;
    }
    case 'wood': {
      hit(lv);
      message += `-# 　　敵軍に 木Lv${lv}×1 = **${lv}** ダメージ！\n`;
      // 「その後」なので1段目を与えた後の兵力で比べる
      if (state.enemyHP > state.myHP) {
        hit(lv * 2);
        message += `-# 　　敵軍が優勢 → 追撃 木Lv${lv}×2 = **${lv * 2}** ダメージ！\n`;
      }
      break;
    }
    case 'earth': {
      hit(lv);
      message += `-# 　　敵軍に 土Lv${lv}×1 = **${lv}** ダメージ！\n`;
      if (state.myHP > state.enemyHP) {
        hit(lv * 2);
        message += `-# 　　自軍が優勢 → 追撃 土Lv${lv}×2 = **${lv * 2}** ダメージ！\n`;
      }
      break;
    }
    case 'thunder': {
      const mult = rollThunderMultiplier(rng);
      hit(lv * mult);
      message += `-# 　　落雷${mult}倍！ 敵軍に 雷Lv${lv}×${mult} = **${lv * mult}** ダメージ！\n`;
      break;
    }
    case 'water': {
      hit(lv);
      const before = state.myHP;
      state.myHP = Math.min(state.initialHP, state.myHP + lv);
      heal = state.myHP - before;
      message += `-# 　　敵軍に 水Lv${lv}×1 = **${lv}** ダメージ！ 自軍を **${heal}** 回復！\n`;
      break;
    }
  }

  // その後：成功率の書き換え
  // ※ カード使用によるLv+1は廃止（Lvは10の倍数でのみ上がる）。
  //   当たった人だけが強くなり独走する「雪だるま」を抑えるため
  const target = ELEMENTS[el.next];
  if (card.effect === 'debuff') {
    state.enemyRates[el.next] = DEBUFF_RATE;
    message += `-# 　　敵軍の${target.name}成功率を **${DEBUFF_RATE}%** に下げた！\n`;
  } else {
    state.myRates[el.next] = BUFF_RATE;
    message += `-# 　　自軍の${target.name}成功率を **${BUFF_RATE}%** に上げた！\n`;
  }

  return { message, damage, heal, success: true };
}

// ─── 1ターン分の処理 ─────────────────────────────────────────
// 11〜99のゾロ目   → 選んだカードを発動し、手札3枚を配り直す
// 00              → 手札3枚を A→B→C の順に全て発動し、手札3枚を配り直す
//                   （00は10の倍数でもあるが、Lv+1は付かない）
// 10,20,…,90      → 選んだカードの属性Lv+1（手札はそのまま）
// それ以外         → 何も起きない（手札もそのまま）
// 発動したら（成功率判定の成否にかかわらず）手札を配り直す
// DBへの保存は呼び出し側が行う
export function performSpellTurn({ hand, slot, randomNum, lv, myRates, enemyRates, myHP, enemyHP, initialHP, rng = Math.random }) {
  const state = { lv, myRates, enemyRates, myHP, enemyHP, initialHP };
  const isZorome = randomNum !== 0 && Math.floor(randomNum / 10) === randomNum % 10;
  const isTen = randomNum !== 0 && randomNum % 10 === 0;

  let message = '';
  let totalDamage = 0;
  let totalHeal = 0;
  let activated = false;
  let trained = null;   // 10の倍数で鍛えた属性

  const fire = (key) => {
    const r = resolveCard(key, state, rng);
    message += r.message;
    totalDamage += r.damage;
    totalHeal += r.heal;
  };

  if (randomNum === 0) {
    activated = true;
    message += ` → 🌟 **00！ 全カード連続発動！**\n`;
    hand.forEach(k => fire(k));
  } else if (isZorome) {
    activated = true;
    message += ` → ✨ **ゾロ目！ ${SLOT_LABELS[slot]}:【${CARDS[hand[slot]].name}】発動！**\n`;
    fire(hand[slot]);
  } else if (isTen) {
    trained = CARDS[hand[slot]].element;
    const el = ELEMENTS[trained];
    const before = state.lv[trained];
    state.lv[trained] = before + 1;
    message += ` → 📈 **10の倍数！ ${SLOT_LABELS[slot]}:【${CARDS[hand[slot]].name}】で${el.name}属性を鍛えた！**\n`;
    message += `-# 　　${el.emoji} ${el.name}Lv ${before}→**${before + 1}**（手札はそのまま）\n`;
  } else {
    message += ` → ざんねん、カードは反応しなかった…\n`;
  }

  const newHand = activated ? dealHand(rng) : hand;
  if (activated) message += `-# 🔄 手札を配り直した\n`;

  return {
    message, totalDamage, totalHeal, activated, trained, newHand,
    lv: state.lv, myRates: state.myRates, enemyRates: state.enemyRates,
  };
}

// ─── 戦況・成功率をGameStateへ反映 ───────────────────────────
// army が与えたダメージは「自軍のkills」に加算、回復は「敵軍のkills」を減らす
export async function applySpellResult(gameState, army, result) {
  const myKillsField    = army === 'A' ? 'a_team_kills' : 'b_team_kills';
  const enemyKillsField = army === 'A' ? 'b_team_kills' : 'a_team_kills';
  const myRatesField    = army === 'A' ? 'a_spell_rates' : 'b_spell_rates';
  const enemyRatesField = army === 'A' ? 'b_spell_rates' : 'a_spell_rates';

  if (result.totalDamage > 0) gameState[myKillsField] += result.totalDamage;
  if (result.totalHeal > 0)   gameState[enemyKillsField] = Math.max(0, gameState[enemyKillsField] - result.totalHeal);
  gameState[myRatesField] = JSON.stringify(result.myRates);
  gameState[enemyRatesField] = JSON.stringify(result.enemyRates);
  await gameState.save();
}

// 手札が無ければ配って保存する（初回・データ破損時）
export async function ensureHand(user) {
  let hand = parseHand(user.spell_hand);
  if (hand.length === 0) {
    hand = dealHand();
    user.spell_hand = JSON.stringify(hand);
    await user.save();
  }
  return hand;
}

export function getArmyRates(gameState, army) {
  return parseRates(army === 'A' ? gameState.a_spell_rates : gameState.b_spell_rates);
}

// ─── /action：手札とステータスの確認（サイコロは振らない） ─────
export async function showSpellHand(interaction) {
  const player = await User.findOne({ where: { id: interaction.user.id } });
  if (!player) {
    return await interaction.reply('まず /start でチームに参加してください。');
  }
  const gameState = await GameState.findOne();
  const armyNames = await getArmyNames();
  const hand = await ensureHand(player);
  const lv = parseLevels(player.spell_levels);
  const myRates = getArmyRates(gameState, player.army);

  let msg = `-#  :military_helmet: ${armyNames[player.army]} ${interaction.member.displayName} の手札確認\n`;
  msg += buildSpellStatusLines(interaction.member.displayName, hand, lv, myRates, armyNames[player.army]);
  msg += `-# カードを \`/a\` \`/b\` \`/c\` で選ぼう（ゾロ目で発動／10の倍数でその属性Lv+1／00なら3枚すべて発動）`;
  await interaction.reply(msg);
}

// ─── 人間プレイヤーの /a /b /c 処理 ──────────────────────────
export async function executeSpellCard(interaction, slot) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const username = interaction.member.displayName;
  const customMessage = interaction.options.getString('message') || '';

  const player = await User.findOne({ where: { id: userId } });
  if (!player) {
    return await interaction.editReply('まず /start でチームに参加してください。');
  }

  const gameState = await GameState.findOne();
  const armyNames = await getArmyNames();

  if (!gameState || gameState.rule_type !== 'spellcard') {
    return await interaction.editReply('現在はスペルカード制ルールではありません。');
  }
  if (gameState.isGameOver) {
    return await interaction.editReply('大戦はすでに終戦した！次回の号砲を待て！');
  }

  try {
    const army = player.army;
    const enemy = army === 'A' ? 'B' : 'A';
    const initialHP = gameState.initialArmyHP;
    const myHP    = initialHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
    const enemyHP = initialHP - (army === 'A' ? gameState.a_team_kills : gameState.b_team_kills);

    const hand = await ensureHand(player);
    const lv = parseLevels(player.spell_levels);
    const myRates = getArmyRates(gameState, army);
    const enemyRates = getArmyRates(gameState, enemy);

    const randomNum = Math.floor(Math.random() * 100);
    const randomStr = randomNum.toString().padStart(2, '0');

    let message = `-#  :military_helmet: ${armyNames[army]} ${username} の行動判定！ ${SLOT_LABELS[slot]}:【${CARDS[hand[slot]].name}】を選択\n`;
    message += `** :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${randomStr}__**`;

    const result = performSpellTurn({ hand, slot, randomNum, lv, myRates, enemyRates, myHP, enemyHP, initialHP });
    message += result.message;

    // プレイヤー更新
    player.spell_levels = JSON.stringify(result.lv);
    player.spell_hand = JSON.stringify(result.newHand);
    player.gekiha_counts += 1;
    player.total_kills += result.totalDamage;
    await player.save();

    // 戦況・成功率を反映
    await applySpellResult(gameState, army, result);
    await gameState.reload();

    // 戦況表示（ダメージ・回復時のみ）
    if (result.totalDamage > 0 || result.totalHeal > 0) {
      const aHP = gameState.initialArmyHP - gameState.b_team_kills;
      const bHP = gameState.initialArmyHP - gameState.a_team_kills;
      message += `-# >>> :crossed_swords: 現在の戦況: :yellow_circle: ${armyNames.A} 兵力${aHP} 　|　 :green_circle: ${armyNames.B} 兵力${bHP}\n`;
      message += `-# >>> 🏅 戦績: ${armyNames[army]} ${username}　行動数: **${player.gekiha_counts}回** 撃破数: **${player.total_kills}撃破**\n`;
    }

    // ステータス欄（常時表示）：次に選ぶ手札と現在のLv・成功率
    message += buildSpellStatusLines(username, result.newHand, result.lv, result.myRates, armyNames[army]);

    if (customMessage) {
      message += `\`\`\`${customMessage}\`\`\`\n`;
    }

    await interaction.editReply(message);

    // 終戦判定
    const loserTeam = await checkShusen();
    if (loserTeam) {
      const finalGameState = await GameState.findOne({ where: { id: 1 } });
      const remainingHP_A = finalGameState.initialArmyHP - finalGameState.b_team_kills;
      const remainingHP_B = finalGameState.initialArmyHP - finalGameState.a_team_kills;
      const winnerTeam = loserTeam === armyNames.A ? armyNames.B : armyNames.A;

      await interaction.followUp(
        `** 📢 ${loserTeam}の兵力が0になった。**\n# 🎖 ${winnerTeam}の勝利だ！\n\n` +
        `🏆 大戦結果:\n 【${armyNames.A}の残存兵力】${remainingHP_A} \n 【${armyNames.B}の残存兵力】${remainingHP_B}\n\n` +
        `**今次大戦は終戦した！次の大戦でまた会おう！**`
      );
    }

  } catch (error) {
    console.error('スペルカード制処理エラー:', error);
    await interaction.editReply('エラー: スペルカード制処理に失敗しました');
  }
}
