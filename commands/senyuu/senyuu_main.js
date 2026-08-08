import { GameState, User } from '../taisen/game.js';
import { getArmyNames } from '../armyname/armyname.js';
import { checkShusen } from '../taisen/game.js';

// 戦友制のコアロジック
// 人間（/action）と軍BOBの双方から同じ関数を使う（判定の二重実装を避けるため）
// ※ このファイルは .js なので main.mjs のコマンド自動読み込み対象にはならない

// ─── 隊列定義 ────────────────────────────────────────────────
export const POSITIONS = [
  { key: 'front', name: '前衛', emoji: '🛡️' },
  { key: 'mid',   name: '中衛', emoji: '⚔️' },
  { key: 'rear',  name: '後衛', emoji: '🏹' },
];
const POS_INFO = Object.fromEntries(POSITIONS.map(p => [p.key, p]));

// ─── 戦友スキル定義（各20%） ─────────────────────────────────
export const COMRADE_SKILLS = [
  { key: '連撃', emoji: '💥', desc: '自軍が優勢ならダメージ2倍' },
  { key: '逆襲', emoji: '🔥', desc: '自軍が劣勢ならダメージ2倍' },
  { key: '熱血', emoji: '☀️', desc: '0/20/40分台ならダメージ2倍' },
  { key: '冷静', emoji: '🌙', desc: '10/30/50分台ならダメージ2倍' },
  { key: '治療', emoji: '💚', desc: '50%で与ダメージ分だけ自軍を回復' },
];
const SKILL_EMOJI = Object.fromEntries(COMRADE_SKILLS.map(s => [s.key, s.emoji]));

// ─── 戦友の名前生成 ──────────────────────────────────────────
const EPITHETS = [
  '疾風', '轟雷', '紅蓮', '蒼天', '白銀', '黒鉄', '烈火', '氷結', '雷鳴', '静寂',
  '不屈', '無双', '閃光', '暁', '黄昏', '孤高', '豪腕', '韋駄天', '鉄壁', '刹那',
  '極寒', '灼熱', '大地', '暴風', '月影',
];
const GIVEN_NAMES = [
  'ゲンジ', 'ムサシ', 'リョウマ', 'コジロウ', 'ベンケイ', 'シンゲン', 'ケンシン', 'ノブナガ',
  'ヒデヨシ', 'マサムネ', 'ユキムラ', 'カンベエ', 'サスケ', 'ゴエモン', 'ジュウベエ', 'テツヤ',
  'Viktor', 'Sasha', 'Dmitri', 'Klaus', 'Erika', 'Hans', 'Ivan', 'Lena',
  'Marco', 'Rosa', 'Felix', 'Nadia', 'Oscar', 'Vera', 'Bruno', 'Alma',
  'ガロン', 'ザイル', 'ドルガ', 'ヴェルグ', 'ライゼ', 'クーガ', 'バルド', 'ネロ',
];

export function randomComradeName() {
  const given = GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)];
  // 5割で二つ名を付ける（例: 疾風のゲンジ）
  if (Math.random() < 0.5) {
    const epithet = EPITHETS[Math.floor(Math.random() * EPITHETS.length)];
    return `${epithet}の${given}`;
  }
  return given;
}

// ─── ステータス抽選 ──────────────────────────────────────────
// ATK: 52%→1 / 27%→2 / 14%→4 / 7%→8
export function rollComradeAtk() {
  const r = Math.random() * 100;
  if (r < 52) return 1;
  if (r < 79) return 2;
  if (r < 93) return 4;
  return 8;
}

// スキル: 5種から均等に1つ
export function rollComradeSkill() {
  return COMRADE_SKILLS[Math.floor(Math.random() * COMRADE_SKILLS.length)].key;
}

export function createComrade() {
  return { name: randomComradeName(), atk: rollComradeAtk(), skill: rollComradeSkill() };
}

// ─── 戦友データの読み書き ────────────────────────────────────
export function parseComrades(raw) {
  let data;
  try {
    data = JSON.parse(raw || '{}');
  } catch {
    data = {};
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  return {
    front: data.front || null,
    mid:   data.mid   || null,
    rear:  data.rear  || null,
  };
}

export function serializeComrades(comrades) {
  return JSON.stringify({
    front: comrades.front || null,
    mid:   comrades.mid   || null,
    rear:  comrades.rear  || null,
  });
}

// 戦友の表示用テキスト
export function formatComrade(c) {
  if (!c) return '（空き）';
  return `**${c.name}** ATK${c.atk} ${SKILL_EMOJI[c.skill] || ''}【${c.skill}】`;
}

export function formatComradeLine(comrades) {
  return POSITIONS
    .map(p => `-# >>> ${p.emoji} ${p.name}: ${formatComrade(comrades[p.key])}`)
    .join('\n') + '\n';
}

// ─── 行動判定 ────────────────────────────────────────────────
// 00 → 全隊列が攻撃 / 10,20,30系 → 加入 / ゾロ目 → 該当隊列が攻撃
export function resolveSenyuuAction(n) {
  if (n === 0) return { type: 'all_attack' };
  if ([10, 20, 30].includes(n)) return { type: 'join',   pos: 'front' };
  if ([40, 50, 60].includes(n)) return { type: 'join',   pos: 'mid' };
  if ([70, 80, 90].includes(n)) return { type: 'join',   pos: 'rear' };
  if ([11, 22, 33].includes(n)) return { type: 'attack', pos: 'front' };
  if ([44, 55, 66].includes(n)) return { type: 'attack', pos: 'mid' };
  if ([77, 88, 99].includes(n)) return { type: 'attack', pos: 'rear' };
  return { type: 'miss' };
}

// ─── ダメージ計算（スキル効果込み） ──────────────────────────
// myHP/enemyHP は「その攻撃を行う時点」の兵力
export function computeComradeDamage(comrade, myHP, enemyHP, now = new Date()) {
  let damage = comrade.atk;
  let heal = 0;
  let note = '';
  const tens = Math.floor(now.getMinutes() / 10); // 分の十の位（0〜5）

  switch (comrade.skill) {
    case '連撃':
      if (myHP > enemyHP) { damage *= 2; note = '自軍優勢 → ダメージ2倍！'; }
      break;
    case '逆襲':
      if (myHP < enemyHP) { damage *= 2; note = '自軍劣勢 → ダメージ2倍！'; }
      break;
    case '熱血':
      if (tens === 0 || tens === 2 || tens === 4) { damage *= 2; note = `${tens * 10}分台 → ダメージ2倍！`; }
      break;
    case '冷静':
      if (tens === 1 || tens === 3 || tens === 5) { damage *= 2; note = `${tens * 10}分台 → ダメージ2倍！`; }
      break;
    case '治療':
      if (Math.random() < 0.5) { heal = damage; note = `治療成功 → 自軍を${heal}回復！`; }
      break;
  }
  return { damage, heal, note };
}

// ─── 1ターン分の処理 ─────────────────────────────────────────
// DBへの保存は呼び出し側が行う（人間/BOBで保存タイミングが異なるため）
// 戻り値: { message, totalDamage, totalHeal, comrades, action }
export function performSenyuuTurn({ comrades, randomNum, myHP, enemyHP, initialHP, now = new Date() }) {
  const action = resolveSenyuuAction(randomNum);
  let message = '';
  let totalDamage = 0;
  let totalHeal = 0;

  // 攻撃中に変動する兵力（同一ターン内の後続攻撃に影響する）
  let curMyHP = myHP;
  let curEnemyHP = enemyHP;

  // 1隊列分の攻撃処理
  const attackAt = (posKey) => {
    const info = POS_INFO[posKey];
    const c = comrades[posKey];

    if (!c) {
      // 戦友がいない隊列は本人が攻撃（1ダメージ）
      totalDamage += 1;
      curEnemyHP = Math.max(0, curEnemyHP - 1);
      message += `-# ${info.emoji} ${info.name}に戦友なし → **自分で攻撃！** 敵軍に **1** ダメージ\n`;
      return;
    }

    const { damage, heal, note } = computeComradeDamage(c, curMyHP, curEnemyHP, now);
    totalDamage += damage;
    curEnemyHP = Math.max(0, curEnemyHP - damage);

    message += `-# ${info.emoji} ${info.name} ${formatComrade(c)} の攻撃！ 敵軍に **${damage}** ダメージ\n`;
    if (note) message += `-# 　　${SKILL_EMOJI[c.skill]}【${c.skill}】${note}\n`;

    if (heal > 0) {
      totalHeal += heal;
      curMyHP = Math.min(initialHP, curMyHP + heal);
    }
  };

  switch (action.type) {
    case 'join': {
      const info = POS_INFO[action.pos];
      if (comrades[action.pos]) {
        // 既にいる場合は負傷して除隊
        const leaving = comrades[action.pos];
        comrades[action.pos] = null;
        message += `### 🩸 ${info.name}の戦友が負傷！\n`;
        message += `-# ${formatComrade(leaving)} は負傷し、除隊した…\n`;
      } else {
        const c = createComrade();
        comrades[action.pos] = c;
        message += `### 🎖️ ${info.emoji} ${info.name}に戦友が加わった！\n`;
        message += `-# ${formatComrade(c)}\n`;
        const skillDesc = COMRADE_SKILLS.find(s => s.key === c.skill);
        if (skillDesc) message += `-# 　　【${c.skill}】${skillDesc.desc}\n`;
      }
      break;
    }

    case 'attack': {
      message += `### ⚔️ ${POS_INFO[action.pos].name}が攻撃！\n`;
      attackAt(action.pos);
      break;
    }

    case 'all_attack': {
      message += `### 🌟 **00！ 総攻撃！** 全隊列が攻撃する！\n`;
      for (const p of POSITIONS) attackAt(p.key);
      break;
    }

    default:
      message += `→ ざんねん、何も起こらなかった…\n`;
  }

  return { message, totalDamage, totalHeal, comrades, action };
}

// ─── 戦況・回復をGameStateへ反映 ─────────────────────────────
// army が与えたダメージは「自軍のkills」に加算、回復は「敵軍のkills」を減らす
export async function applySenyuuResult(gameState, army, totalDamage, totalHeal) {
  const myKillsField    = army === 'A' ? 'a_team_kills' : 'b_team_kills';
  const enemyKillsField = army === 'A' ? 'b_team_kills' : 'a_team_kills';

  if (totalDamage > 0) gameState[myKillsField] += totalDamage;
  if (totalHeal > 0)   gameState[enemyKillsField] = Math.max(0, gameState[enemyKillsField] - totalHeal);
  await gameState.save();
}

// ─── 人間プレイヤーの /action 処理 ───────────────────────────
export async function executeSenyuu(interaction) {
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

  if (gameState.rule_type !== 'senyuu') {
    return await interaction.editReply('現在は戦友制ルールではありません。');
  }
  if (gameState.isGameOver) {
    return await interaction.editReply('大戦はすでに終戦した！次回の号砲を待て！');
  }

  try {
    const army = player.army;
    const initialHP = gameState.initialArmyHP;
    const myHP    = initialHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
    const enemyHP = initialHP - (army === 'A' ? gameState.a_team_kills : gameState.b_team_kills);

    const randomNum = Math.floor(Math.random() * 100);
    const randomStr = randomNum.toString().padStart(2, '0');

    let message = `-# :military_helmet: ${armyNames[army]} **${username}** の行動！\n`;
    message += `** :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${randomStr}__**\n`;

    const comrades = parseComrades(player.comrades_data);
    const result = performSenyuuTurn({ comrades, randomNum, myHP, enemyHP, initialHP });
    message += result.message;

    // プレイヤー更新
    player.comrades_data = serializeComrades(result.comrades);
    player.gekiha_counts += 1;
    player.total_kills += result.totalDamage;
    await player.save();

    // 戦況反映
    await applySenyuuResult(gameState, army, result.totalDamage, result.totalHeal);
    await gameState.reload();

    // 現在の部隊編成（常時表示）
    message += `-# >>> 🪖 **${username} の部隊**\n`;
    message += formatComradeLine(result.comrades);

    // 戦況表示（ダメージ・回復時のみ）
    if (result.totalDamage > 0 || result.totalHeal > 0) {
      const aHP = gameState.initialArmyHP - gameState.b_team_kills;
      const bHP = gameState.initialArmyHP - gameState.a_team_kills;
      message += `-# >>> :crossed_swords: 現在の戦況: :yellow_circle: ${armyNames.A} 兵力${aHP} 　|　 :green_circle: ${armyNames.B} 兵力${bHP}\n`;
      message += `-# >>> 🏅 戦績: ${armyNames[army]} ${username}　行動数: **${player.gekiha_counts}回** 撃破数: **${player.total_kills}撃破**\n`;
    }

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
    console.error('戦友制処理エラー:', error);
    if (interaction.deferred) {
      await interaction.editReply('エラー: 戦友制処理に失敗しました');
    } else {
      await interaction.reply('エラー: 戦友制処理に失敗しました');
    }
  }
}
