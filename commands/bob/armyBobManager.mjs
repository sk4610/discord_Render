import { GameState, User } from '../taisen/game.js';
import { processKillWithRandom } from '../kaikyu/kaikyu_main.js';
import { getArmyNames } from '../armyname/armyname.js';
import {
  determineATK, processBeastAction, executeBeastBreak, manageDuelNotifications
} from '../beast/beast.mjs';
import {
  processPassiveAction, applySkillEffects, processSkillGet, processSkillBreak, processPoisonEffect
} from '../PassiveSkill/PassiveSkill.mjs';
import { resolveFightingRoll, applyPunchEffect } from '../fighting/fighting_common.js';
import { SKILL_MAP, rollPower, resolveSkillActivations } from '../Skillgein/action.mjs';
import {
  parseComrades, serializeComrades, performSenyuuTurn, applySenyuuResult, formatComradeLine
} from '../senyuu/senyuu_main.js';
import { buildCoinStatusFixed } from '../coin/coin_common.js';
import { checkAutoStatus } from '../taisen/autostatus.mjs';

const BOB_EMOJI = "<:custom_emoji:1350367513271341088>";

// 階級テーブル（kaikyu.mjsと同一）
const ranks = ['二等兵🔸', '一等兵🔺', '軍曹🔶', '曹長♦️', '大尉⚡', '大佐💠', '准将🔆', '大将🔱', '元帥🎖️'];
const weight = [28, 24, 20, 13, 8, 4, 1.5, 1, 0.5];

// 属性コイン制：属性定義
const ELEMENTS = [
  { key: 'fire',    name: '火', emoji: '🔥', erases: 'wood',    eraseEmoji: '🌲' },
  { key: 'wood',    name: '木', emoji: '🌲', erases: 'earth',   eraseEmoji: ':rock:' },
  { key: 'earth',   name: '土', emoji: ':rock:', erases: 'thunder', eraseEmoji: '⚡' },
  { key: 'thunder', name: '雷', emoji: '⚡', erases: 'water',   eraseEmoji: '💧' },
  { key: 'water',   name: '水', emoji: '💧', erases: 'fire',    eraseEmoji: '🔥' },
];

// BOBに使う名前リスト（日本語・洋名ミックス）
const BOB_NAMES = [
  '琥珀', '羽二重', '餅蔵', 'ベイク・D・タルト', 'ビスカ', 'モン・ブラヌ', '氷室', 'ハーゲン・D・ダッシュ',
  '水無月', 'バウム・クーヘン三世', '餡蜜', 'カシス', 'ネモレイト', 'サッカロイド', 'オズ', '九頭モチ',
  '柿之種', 'ボーロ', 'ドンモーア', 'ハッカ', 'パニエル', 'グミ', 'ヨック', 'シガール',
  'Tom', 'Helen', 'Jack', 'Emma', 'Mike', 'Sara', 'Bob', 'Alice',
  'Chris', 'Anna', 'James', 'Lisa', 'Ben', 'Maria', 'Leo', 'Nina',
  'Max', 'Luna', 'Rex', 'Ivy', 'Ace', 'Nova', 'Sam', 'Ruby',
  'Zoe', 'Liam', 'Ella', 'Owen', 'Mia', 'Evan',
];

// 着任時の挨拶メッセージリスト
const BOB_GREETINGS = [
  'よろしくお願いします！必ず勝利をもたらします！',
  'ただいま着任しました。全力で戦います！',
  'お任せください！この戦、勝ちに行きます！',
  '皆さんと戦えて光栄です。頑張ります！',
  '微力ながら、共に戦い抜きましょう！',
  '着任しました。最後まで粘ります！',
  'この軍に命を預けます。突撃！',
  'よし、やってやりましょう！',
  '敵に情けは無用です。行きます！',
  '一緒に勝利を掴みましょう！',
];

// BOB性格タイプ定義
const BOB_TYPES = {
  assault:   { key: 'assault',   name: '猪突型', emoji: '🔥', greeting: '突撃あるのみ！遠慮はいらない！' },
  guardian:  { key: 'guardian',  name: '守護型', emoji: '💧', greeting: '仲間を守ることが私の使命です。' },
  tactician: { key: 'tactician', name: '策士型', emoji: '🧠', greeting: '状況を見極めて動きます。' },
  ambush:    { key: 'ambush',    name: '奇襲型', emoji: '⚡', greeting: '敵の戦略を崩すのが私の仕事です！' },
};
const BOB_TYPE_KEYS = Object.keys(BOB_TYPES);
export { BOB_TYPES };

// BOB投稿間隔（秒）：Discordレート制限対策＋視認性向上
const BOB_ACTION_DELAY_MS = 4000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let bobTimerHandle = null;

// ─────────────────────────────────────────────
// タイマー管理
// ─────────────────────────────────────────────

export function startArmyBobTimer(client) {
  if (bobTimerHandle) clearInterval(bobTimerHandle);
  bobTimerHandle = setInterval(() => checkAndActBobs(client), 60 * 1000);
  console.log('✅ 軍BOBタイマー開始（毎分チェック）');
}

export function stopArmyBobTimer() {
  if (bobTimerHandle) {
    clearInterval(bobTimerHandle);
    bobTimerHandle = null;
    console.log('🛑 軍BOBタイマー停止');
  }
}

// ─────────────────────────────────────────────
// メインループ
// ─────────────────────────────────────────────

// タイマー1回分の処理。テストや手動トリガーからも呼べるよう公開している
export async function checkAndActBobs(client) {
  try {
    const gameState = await GameState.findOne({ where: { id: 1 } });
    if (!gameState) return;
    if (!gameState.armybob_enabled) return;
    if (gameState.isGameOver) return;

    const rule = gameState.rule_type;
    if (!rule || rule === 'none') return;

    // 対応ルールチェック
    const SUPPORTED_RULES = ['ranked', 'coin', 'beast', 'passive', 'fighting', 'skillgein', 'senyuu'];
    if (!SUPPORTED_RULES.includes(rule)) return;

    const now = new Date();
    const lastAction = gameState.armybob_last_action ? new Date(gameState.armybob_last_action) : null;
    const intervalMs = gameState.armybob_interval * 60 * 1000;
    if (lastAction && (now - lastAction) < intervalMs) return;

    await gameState.update({ armybob_last_action: now });

    const channel = gameState.armybob_channel_id
      ? client.channels.cache.get(gameState.armybob_channel_id)
      : null;

    await adjustBobCounts(gameState, channel);

    for (const army of ['A', 'B']) {
      switch (rule) {
        case 'ranked':   await executeRankedBobsForArmy(army, client, channel); break;
        case 'coin':     await executeCoinBobsForArmy(army, client, channel); break;
        case 'beast':    await executeBeastBobsForArmy(army, client, channel); break;
        case 'passive':  await executePassiveBobsForArmy(army, client, channel); break;
        case 'fighting': await executeFightingBobsForArmy(army, client, channel); break;
        case 'skillgein':await executeSkillgeinBobsForArmy(army, client, channel); break;
        case 'senyuu':   await executeSenyuuBobsForArmy(army, client, channel); break;
      }
    }

    // BOBの行動でもレス数・兵力が動くので戦況の自動表示を判定する
    await checkAutoStatus(client);

  } catch (error) {
    console.error('❌ 軍BOBタイマーエラー:', error);
  }
}

// ─────────────────────────────────────────────
// BOB数調整（着任・撤退メッセージ付き）
// ─────────────────────────────────────────────

async function adjustBobCounts(gameState, channel) {
  const target = gameState.armybob_target_size;
  const armyNames = await getArmyNames();

  for (const army of ['A', 'B']) {
    const allInArmy = await User.findAll({ where: { army } });
    const humanCount = allInArmy.filter(
      u => !u.id.startsWith('armybob-') && !u.id.startsWith('bob-')
    ).length;
    const currentBobs = allInArmy.filter(u => u.id.startsWith(`armybob-${army}-`));
    const needed = Math.max(0, target - humanCount);

    if (currentBobs.length < needed) {
      for (let i = currentBobs.length + 1; i <= needed; i++) {
        const bobId = `armybob-${army}-${i}`;
        const exists = await User.findOne({ where: { id: bobId } });
        if (!exists) {
          const bobRank = weightedRandomRank();
          const bobName = randomBobName();
          const bobTypeKey = randomBobType();
          const bobTypeInfo = BOB_TYPES[bobTypeKey];
          const armyLabel = armyNames[army];
          await User.create({
            id: bobId, username: bobName, army, rank: bobRank, total_kills: 0,
            bob_type: bobTypeKey,
            // 技能習得制は skills_data を配列として使うため、必ず空配列で初期化する
            skills_data: '[]'
          });
          console.log(`✅ 軍BOB配置: ${bobId} "${bobName}" (${bobRank}) [${bobTypeInfo.name}]`);

          if (channel) {
            const rule = gameState.rule_type;
            const rankLine = rule === 'ranked' ? `-# >>> 🎖️ 初期階級: **${bobRank}**\n` : '';
            try {
              await channel.send(
                `${BOB_EMOJI} **[軍BOB着任]** ${armyLabel} に **${bobName}** が着任しました！\n` +
                rankLine +
                `-# >>> 🧬 性格タイプ: **${bobTypeInfo.name}${bobTypeInfo.emoji}**\n` +
                `-# >>> 「${bobTypeInfo.greeting}」`
              );
            } catch (err) {
              console.error(`❌ BOB着任メッセージエラー (${bobId}):`, err);
            }
          }
        }
      }
    } else if (currentBobs.length > needed) {
      const excess = currentBobs
        .sort((a, b) => parseInt(b.id.split('-').pop(), 10) - parseInt(a.id.split('-').pop(), 10))
        .slice(0, currentBobs.length - needed);
      for (const bob of excess) {
        if (channel) {
          try {
            await channel.send(
              `${BOB_EMOJI} **[軍BOB撤退]** ${armyNames[army]} の **${bob.username}** が撤退しました。\n` +
              `-# >>> 最終戦績: 行動 ${bob.gekiha_counts}回 / 撃破 ${bob.total_kills}`
            );
          } catch (err) {
            console.error(`❌ BOB撤退メッセージエラー (${bob.id}):`, err);
          }
        }
        await bob.destroy();
        console.log(`🗑️ 軍BOB撤退: ${bob.id} "${bob.username}"`);
      }
    }
  }
}

// ─────────────────────────────────────────────
// 階級制 BOB行動
// ─────────────────────────────────────────────

async function executeRankedBobsForArmy(army, client, channel) {
  const gameState = await GameState.findOne({ where: { id: 1 } });
  if (!gameState || gameState.isGameOver) return;

  const allInArmy = await User.findAll({ where: { army } });
  const armyBobs = allInArmy.filter(u => u.id.startsWith(`armybob-${army}-`));
  if (armyBobs.length === 0) return;

  const armyNames = await getArmyNames();
  const armyNameA = armyNames.A;
  const armyNameB = armyNames.B;
  const armyName = armyNames[army];
  const countMode = gameState.countMode;

  for (const bob of armyBobs) {
    const { newRank, kills, rankUp, displayMessage } = processKillWithRandom(bob.rank);
    bob.rank = newRank;
    bob.total_kills += kills;
    bob.gekiha_counts += 1;
    await bob.save();

    if (kills > 0) {
      army === 'A'
        ? await gameState.increment('a_team_kills', { by: kills })
        : await gameState.increment('b_team_kills', { by: kills });
      await gameState.reload();
    }

    if (!channel) continue;

    let msg = `-# ${BOB_EMOJI} **[軍BOB]** ${armyName} **${bob.username}** が行動！\n`;
    msg += displayMessage;
    if (rankUp) msg += `### 🔥 **新階級: ${bob.rank}** へ昇格！\n`;

    if (kills > 0) {
      await gameState.reload();
      if (countMode === 'down') {
        msg += `-# >>> ⚔️ 戦況: 🟡 ${armyNameA} 兵力${gameState.initialArmyHP - gameState.b_team_kills} | 🟢 ${armyNameB} 兵力${gameState.initialArmyHP - gameState.a_team_kills}\n`;
      } else {
        const tA = (await User.sum('total_kills', { where: { army: 'A' } })) || 0;
        const tB = (await User.sum('total_kills', { where: { army: 'B' } })) || 0;
        msg += `-# >>> ⚔️ 戦況: 🟡 ${armyNameA} 兵力${tA} | 🟢 ${armyNameB} 兵力${tB}\n`;
      }
      msg += `-# >>> 🏅 ${armyName} ${bob.username}  階級:${bob.rank}　|　行動数: **${bob.gekiha_counts}回** 撃破数: **${bob.total_kills}撃破**\n`;
    }

    try { await channel.send(msg); } catch (err) { console.error(`❌ BOB投稿エラー:`, err); }

    await sleep(BOB_ACTION_DELAY_MS);

    await gameState.reload();
    if (gameState.isGameOver) break;
  }
}

// ─────────────────────────────────────────────
// 属性コイン制 BOB行動
// ─────────────────────────────────────────────

async function executeCoinBobsForArmy(army, client, channel) {
  const gameState = await GameState.findOne({ where: { id: 1 } });
  if (!gameState || gameState.isGameOver) return;

  const allInArmy = await User.findAll({ where: { army } });
  const armyBobs = allInArmy.filter(u => u.id.startsWith(`armybob-${army}-`));
  if (armyBobs.length === 0) return;

  const armyNames = await getArmyNames();
  const armyName = armyNames[army];

  for (const bob of armyBobs) {
    await gameState.reload();
    if (gameState.isGameOver) break;

    // 性格タイプに応じた属性選択
    const bobTypeKey = getBobType(bob);
    const bobTypeInfo = BOB_TYPES[bobTypeKey] || BOB_TYPES.tactician;
    const { element, reason } = selectElement(army, gameState, bobTypeKey);

    const { acquired, displayMessage } = rollCoin();

    const coinCol = `${army.toLowerCase()}_${element.key}_coin`;
    const before = gameState[coinCol];
    const after = before + acquired;
    gameState[coinCol] = after;

    // 個人戦績更新
    bob[`personal_${element.key}_coin`] = (bob[`personal_${element.key}_coin`] || 0) + acquired;
    bob.gekiha_counts += 1;

    let msg = `-# ${BOB_EMOJI} **[軍BOB]** ${armyName} **${bob.username}**【${bobTypeInfo.name}${bobTypeInfo.emoji}】が【${element.name}】コインを狙う！\n`;
    msg += `-# 　（${reason}）\n`;
    msg += displayMessage;

    if (acquired > 0) {
      msg += `-# **${armyName}　${element.name}属性コイン ${acquired}枚獲得！(${before} → ${after}枚)**\n`;
    }

    // スキル発動チェック
    const beforeMultiple = Math.floor(before / 5);
    const afterMultiple = Math.floor(after / 5);

    if (acquired > 0 && afterMultiple > beforeMultiple) {
      const skillResult = applyElementSkill(army, element, after, gameState, armyNames);
      msg += skillResult.message;
      bob.total_kills += skillResult.damage;
    }

    await bob.save();
    await gameState.save();
    await gameState.reload();

    // コイン状況表示
    msg += buildCoinStatus(army, gameState, armyNames);
    if (acquired > 0) {
      msg += `\n-# >>> 🏅 ${armyName} ${bob.username}　行動数: **${bob.gekiha_counts}回** 撃破数: **${bob.total_kills}撃破**\n`;
    }

    if (channel) {
      try { await channel.send(msg); } catch (err) { console.error(`❌ BOBコイン投稿エラー:`, err); }
      await sleep(BOB_ACTION_DELAY_MS);
    }
  }
}

// ─────────────────────────────────────────────
// 属性コイン制：スキル発動処理（全5属性）
// ─────────────────────────────────────────────

function applyElementSkill(army, element, amount, gameState, armyNames) {
  const enemyArmy = army === 'A' ? 'B' : 'A';
  const myHPKey = army === 'A' ? 'b_team_kills' : 'a_team_kills'; // 自軍HP = initialHP - これ
  const enemyHPKey = army === 'A' ? 'a_team_kills' : 'b_team_kills';
  const myHP = gameState.initialArmyHP - gameState[myHPKey];
  const enemyHP = gameState.initialArmyHP - gameState[enemyHPKey];

  let damage = 0;
  let message = `### :boom: **${armyNames[army]}の${element.name}属性スキル発動！（BOB）** (${amount}枚) :boom: \n`;

  switch (element.key) {
    case 'fire': {
      damage = amount * 2;
      message += `-# 　${element.emoji} 燃え盛る炎: ${amount} × 2 = **${damage}ダメージ！**\n`;
      break;
    }
    case 'wood': {
      const mult = myHP < enemyHP ? 3 : myHP > enemyHP ? 1 : 2;
      damage = amount * mult;
      const situation = myHP < enemyHP ? '劣勢 → ×3' : myHP > enemyHP ? '優勢 → ×1' : '互角 → ×2';
      message += `-# 　${element.emoji} 生命の木: ${situation}  **${damage}ダメージ！**\n`;
      break;
    }
    case 'earth': {
      const mult = myHP > enemyHP ? 3 : myHP < enemyHP ? 1 : 2;
      damage = amount * mult;
      const situation = myHP > enemyHP ? '優勢 → ×3' : myHP < enemyHP ? '劣勢 → ×1' : '互角 → ×2';
      message += `-# 　${element.emoji} 大地の守護: ${situation}  **${damage}ダメージ！**\n`;
      break;
    }
    case 'thunder': {
      const rand = Math.floor(Math.random() * 100) + 1;
      message += `-# 　雷スキル判定: ${rand}\n`;
      if (rand % 2 === 0) {
        damage = amount * 4;
        message += `-# 　　偶数 → ⚡ **成功！轟雷: ${damage}ダメージ！**\n`;
      } else {
        damage = 0;
        message += `-# 　　奇数 → 発動失敗…（0ダメージ）\n`;
      }
      break;
    }
    case 'water': {
      damage = amount;
      const heal = amount;
      message += `-# 　${element.emoji} 水の治癒: **${damage}ダメージ** + **${heal}回復！**\n`;
      // 回復処理
      const currentMyHP = gameState.initialArmyHP - gameState[myHPKey];
      const healedHP = Math.min(currentMyHP + heal, gameState.initialArmyHP);
      const actualHeal = healedHP - currentMyHP;
      gameState[myHPKey] = Math.max(0, gameState[myHPKey] - actualHeal);
      message += `-# 　　:chocolate_bar: ${armyNames[army]}の兵力が **${actualHeal} 回復！**\n`;
      break;
    }
  }

  // ダメージ適用
  if (damage > 0) {
    gameState[enemyHPKey] += damage;
    message += `　　➡️ ${armyNames[enemyArmy]}に **${damage} ダメージ！**\n`;
  }

  // 敵コイン消去
  const eraseCol = `${enemyArmy.toLowerCase()}_${element.erases}_coin`;
  gameState[eraseCol] = 0;
  message += `-# 　💨 ${armyNames[enemyArmy]}の**【${ELEMENTS.find(e => e.key === element.erases).name}】コイン**を全て吹き飛ばした！\n`;

  // 戦況表示
  const aHP = gameState.initialArmyHP - gameState.b_team_kills;
  const bHP = gameState.initialArmyHP - gameState.a_team_kills;
  message += `-# >>> ⚔️ 戦況: 🟡 ${armyNames.A} 兵力${aHP} | 🟢 ${armyNames.B} 兵力${bHP}\n`;

  return { message, damage };
}

// ─────────────────────────────────────────────
// ビースト制 BOB行動
// ※ 判定は人間と同一。性格タイプはビースト名の傾向にのみ反映する
// ─────────────────────────────────────────────

const BEAST_NAME_POOL = {
  assault:   ['ガルム', 'イフリート', 'ベヒモス', 'グリフォン', 'ケルベロス'],
  guardian:  ['ユニコーン', 'ケットシー', 'フェニックス', 'セイレーン', 'ペガサス'],
  tactician: ['スフィンクス', 'バジリスク', 'キマイラ', 'ワイバーン', 'ヒュドラ'],
  ambush:    ['シャドウキャット', 'ナイトメア', 'ジャバウォック', 'ラタトスク', 'ファントム'],
};

function generateBeastName(typeKey) {
  const pool = BEAST_NAME_POOL[typeKey] || BEAST_NAME_POOL.tactician;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function executeBeastBobsForArmy(army, client, channel) {
  const gameState = await GameState.findOne({ where: { id: 1 } });
  if (!gameState || gameState.isGameOver) return;

  const allInArmy = await User.findAll({ where: { army } });
  const armyBobs = allInArmy.filter(u => u.id.startsWith(`armybob-${army}-`));
  if (armyBobs.length === 0) return;

  const armyNames = await getArmyNames();
  const armyName = armyNames[army];

  for (const bob of armyBobs) {
    await gameState.reload();
    if (gameState.isGameOver) break;

    const typeKey = getBobType(bob);
    const typeInfo = BOB_TYPES[typeKey] || BOB_TYPES.tactician;

    const randomNum = Math.floor(Math.random() * 1000);
    const randomStr = randomNum.toString().padStart(3, '0');
    const lastDigit = randomNum % 10;

    let msg = `-# ${BOB_EMOJI} **[軍BOB]** ${armyName} **${bob.username}**【${typeInfo.name}${typeInfo.emoji}】の行動判定！\n`;
    msg += `** :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${randomStr}__**`;

    // ビースト召喚 or 復活（人間と違い名前は自動生成）
    let isNewBeast = false;
    if (!bob.beast_name || !bob.beast_is_active) {
      const prevName = bob.beast_name;
      const newATK = determineATK(lastDigit);
      const newName = generateBeastName(typeKey);
      await bob.update({
        beast_name: newName,
        beast_atk: newATK,
        beast_is_active: true,
        beast_has_fed: false,
        last_action_time: new Date(),
      });
      isNewBeast = true;
      msg += prevName
        ? `\n :dragon_face: 新しいビースト **"${newName}"** が復活！ATK: ${newATK}（前任 "${prevName}" は戦闘不能）\n`
        : `\n :dragon_face: 初のビースト **"${newName}"** が誕生！ATK: ${newATK}\n`;
    }

    const action = processBeastAction(randomNum);
    msg += isNewBeast ? ` → さらに ${action.message}\n` : ` → ${action.message}\n`;

    // ビーストブレイク
    if (action.type === 'beast_break') {
      const breakResult = await executeBeastBreak(army, armyNames);
      msg += `** ${breakResult}**\n`;
    }

    // 餌やり（ATKアップ）
    if (action.atkUp > 0) {
      const oldATK = bob.beast_atk;
      const newATK = oldATK + action.atkUp;
      await bob.update({ beast_atk: newATK, beast_has_fed: true });
      msg += ` :up: "${bob.beast_name}" のATKが **${oldATK} → ${newATK}** にアップ！\n`;
    }

    // 撃破処理
    const kills = action.kills;
    if (kills > 0) {
      army === 'A'
        ? await gameState.increment('a_team_kills', { by: kills })
        : await gameState.increment('b_team_kills', { by: kills });
      bob.total_kills += kills;
    }

    bob.gekiha_counts += 1;
    bob.last_action_time = new Date();
    await bob.save();
    await gameState.reload();

    msg += `-# >>> :dragon_face: ビースト: **${bob.beast_name}** (ATK: ${bob.beast_atk})\n`;

    if (kills > 0) {
      const aHP = gameState.initialArmyHP - gameState.b_team_kills;
      const bHP = gameState.initialArmyHP - gameState.a_team_kills;
      msg += `-# >>> :crossed_swords: 現在の戦況: ${armyNames.A} ${aHP} vs ${armyNames.B} ${bHP}\n`;
      msg += `-# >>> 🏅 ${armyName} ${bob.username}　行動数: **${bob.gekiha_counts}回** 撃破数: **${bob.total_kills}撃破**\n`;
    }

    if (!channel) continue;

    try { await channel.send(msg); } catch (err) { console.error('❌ BOBビースト投稿エラー:', err); }

    // 決闘カウントダウン／決闘実行（人間の行動時と同じ頻度でチェック）
    try {
      await manageDuelNotifications(m => channel.send(m), armyNames);
    } catch (err) {
      console.error('❌ BOB決闘処理エラー:', err);
    }

    await sleep(BOB_ACTION_DELAY_MS);
  }
}

// ─────────────────────────────────────────────
// パッシブスキル制 BOB行動
// ※ 判定は人間と同一。スキルは軍で共有されるためBOBの取得も軍に貢献する
// ─────────────────────────────────────────────

async function executePassiveBobsForArmy(army, client, channel) {
  const gameState = await GameState.findOne({ where: { id: 1 } });
  if (!gameState || gameState.isGameOver) return;

  const allInArmy = await User.findAll({ where: { army } });
  const armyBobs = allInArmy.filter(u => u.id.startsWith(`armybob-${army}-`));
  if (armyBobs.length === 0) return;

  const armyNames = await getArmyNames();
  const armyName = armyNames[army];

  for (const bob of armyBobs) {
    await gameState.reload();
    if (gameState.isGameOver) break;

    const typeKey = getBobType(bob);
    const typeInfo = BOB_TYPES[typeKey] || BOB_TYPES.tactician;

    const randomNum = Math.floor(Math.random() * 100);
    const randomStr = randomNum.toString().padStart(2, '0');

    let msg = `-# ${BOB_EMOJI} **[軍BOB]** ${armyName} **${bob.username}**【${typeInfo.name}${typeInfo.emoji}】の行動判定！\n`;
    msg += `** :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${randomStr}__**`;

    const action = processPassiveAction(randomNum);
    msg += ` → ${action.message}\n`;

    let totalDamage = action.kills || 0;
    let totalHeal = 0;

    if (action.type === 'skill_get') {
      const r = await processSkillGet(bob, army, gameState, armyNames);
      msg += r.message;
      totalDamage += r.bonusDamage;
    } else if (action.type === 'skill_break') {
      const r = await processSkillBreak(bob, army, gameState, armyNames);
      msg += r.message;
      totalDamage += r.bonusDamage;
    }

    if (action.type === 'normal_kill' || action.type === 'massive_kill') {
      const eff = await applySkillEffects(army, action, gameState, armyNames);
      totalDamage += eff.additionalDamage;
      totalHeal += eff.selfHeal;
      if (eff.skillEffects.length > 0) {
        msg += eff.skillEffects.map(e => `** ${e}`).join('\n') + '\n';
      }
    }

    // ダメージ適用
    if (totalDamage > 0) {
      if (army === 'A') gameState.a_team_kills += totalDamage;
      else gameState.b_team_kills += totalDamage;
      bob.total_kills += totalDamage;
    }

    // 回復適用
    if (totalHeal > 0) {
      if (army === 'A') gameState.b_team_kills = Math.max(0, gameState.b_team_kills - totalHeal);
      else gameState.a_team_kills = Math.max(0, gameState.a_team_kills - totalHeal);
      msg += `### 💚 自軍が${totalHeal}回復！\n`;
    }

    bob.gekiha_counts += 1;
    await bob.save();
    await gameState.save();
    await gameState.reload();

    if (totalDamage > 0) {
      const aHP = gameState.initialArmyHP - gameState.b_team_kills;
      const bHP = gameState.initialArmyHP - gameState.a_team_kills;
      msg += `-# >>> :crossed_swords: 現在の戦況: ${armyNames.A} ${aHP} vs ${armyNames.B} ${bHP}\n`;
      msg += `-# >>> 🏅 ${armyName} ${bob.username}　行動数: **${bob.gekiha_counts}回** 撃破数: **${bob.total_kills}撃破**\n`;
    }

    // 軍スキル一覧（常時）
    const armySkillsField = `${army.toLowerCase()}_passive_skills`;
    const armySkills = gameState[armySkillsField] ? JSON.parse(gameState[armySkillsField]) : {};
    const skillList = Object.entries(armySkills).map(([type, level]) => `${type}Lv${level}`).join(', ');
    msg += `-# >>> :gear: ${armyName}のスキル: ${skillList || 'なし'}\n`;

    if (!channel) continue;

    try { await channel.send(msg); } catch (err) { console.error('❌ BOBパッシブ投稿エラー:', err); }

    // 猛毒（100レス到達時）
    try {
      await processPoisonEffect(m => channel.send(m), armyNames);
    } catch (err) {
      console.error('❌ BOB猛毒処理エラー:', err);
    }

    await sleep(BOB_ACTION_DELAY_MS);
  }
}

// ─────────────────────────────────────────────
// ファイティング制 BOB行動
// ※ 判定は人間と同一。性格タイプは charge/punch/burst の選択に反映する
// ─────────────────────────────────────────────

// 敵軍で最もファイト値が高い相手を返す
function strongestEnemy(enemies) {
  let best = null;
  for (const e of enemies) {
    if (!best || (e.fight_value || 1) > (best.fight_value || 1)) best = e;
  }
  return best;
}

function chooseFightingAction(typeKey, myFight, topEnemy) {
  const enemyFight = topEnemy ? (topEnemy.fight_value || 1) : 1;

  switch (typeKey) {
    // 猪突型：とにかく撃つ。ファイト値が低いときだけ溜める
    case 'assault':
      return myFight >= 3 ? 'burst' : (Math.random() < 0.35 ? 'charge' : 'burst');

    // 守護型：じっくり溜めてから大きく撃つ
    case 'guardian':
      return myFight < 6 ? 'charge' : 'burst';

    // 奇襲型：伸びた敵を潰すのが仕事
    case 'ambush':
      if (enemyFight >= 3) return 'punch';
      return myFight < 3 ? 'charge' : 'burst';

    // 策士型：戦局を見て判断
    default:
      if (myFight <= 2) return 'charge';
      if (enemyFight > myFight) return 'punch';
      return 'burst';
  }
}

async function executeFightingBobsForArmy(army, client, channel) {
  const gameState = await GameState.findOne({ where: { id: 1 } });
  if (!gameState || gameState.isGameOver) return;

  const allInArmy = await User.findAll({ where: { army } });
  const armyBobs = allInArmy.filter(u => u.id.startsWith(`armybob-${army}-`));
  if (armyBobs.length === 0) return;

  const enemyArmy = army === 'A' ? 'B' : 'A';
  const armyNames = await getArmyNames();
  const armyName = armyNames[army];

  const ACTION_LABEL = { charge: 'チャージ', punch: 'パンチ', burst: 'バースト' };

  for (const bob of armyBobs) {
    await gameState.reload();
    if (gameState.isGameOver) break;

    // ファイト値の初期化
    if (!bob.fight_value || bob.fight_value < 1) {
      await bob.update({ fight_value: 1 });
    }

    const typeKey = getBobType(bob);
    const typeInfo = BOB_TYPES[typeKey] || BOB_TYPES.tactician;

    const enemies = await User.findAll({ where: { army: enemyArmy } });
    const topEnemy = strongestEnemy(enemies);
    const actionType = chooseFightingAction(typeKey, bob.fight_value, topEnemy);

    const randomNum = Math.floor(Math.random() * 100);
    const randomStr = randomNum.toString().padStart(2, '0');

    let msg = `-# ${BOB_EMOJI} **[軍BOB]** ${armyName} **${bob.username}**【${typeInfo.name}${typeInfo.emoji}】が **${ACTION_LABEL[actionType]}** を選択！\n`;
    msg += `** :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${randomStr}__ **`;

    const roll = resolveFightingRoll(actionType, randomNum, bob.fight_value);
    let totalDamage = roll.damage;
    msg += roll.text;

    // チャージ成功
    if (roll.newFightValue !== null) {
      await bob.update({ fight_value: roll.newFightValue });
    }

    // パンチ成功（対象は最もファイト値が高い敵）
    if (roll.punchEffect) {
      if (!topEnemy) {
        msg += ` ❌ **対象が見つかりません** 敵軍に兵士がいません\n`;
      } else {
        msg += await applyPunchEffect(topEnemy, roll.punchEffect, topEnemy.username);
      }
    }

    // ダメージ適用
    if (totalDamage > 0) {
      if (army === 'A') gameState.a_team_kills += totalDamage;
      else gameState.b_team_kills += totalDamage;
      bob.total_kills += totalDamage;
    }

    bob.gekiha_counts += 1;
    await bob.save();
    await gameState.save();
    await gameState.reload();

    if (totalDamage > 0) {
      const aHP = gameState.initialArmyHP - gameState.b_team_kills;
      const bHP = gameState.initialArmyHP - gameState.a_team_kills;
      msg += `-# >>> :crossed_swords: 現在の戦況: ${armyNames.A} ${aHP} vs ${armyNames.B} ${bHP}\n`;
      msg += `-# >>> 🏅 ${armyName} ${bob.username}　行動数: **${bob.gekiha_counts}回** 撃破数: **${bob.total_kills}撃破**\n`;
    }

    msg += `-# >>> 💪 ${bob.username} のファイト値: ${bob.fight_value}\n`;

    if (!channel) continue;
    try { await channel.send(msg); } catch (err) { console.error('❌ BOBファイティング投稿エラー:', err); }
    await sleep(BOB_ACTION_DELAY_MS);
  }
}

// ─────────────────────────────────────────────
// 技能習得制 BOB行動
// ※ 判定は人間と同一。性格タイプは狙撃を撃つ判断と対象選びに反映する
// ─────────────────────────────────────────────

function parseSkills(user) {
  try {
    const data = JSON.parse(user.skills_data || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// 最も脅威の高い敵（技能数優先、次いでステータス合計）
function pickSnipeTarget(enemies) {
  let best = null;
  for (const e of enemies) {
    const skillCount = parseSkills(e).length;
    const stat = (e.skill_atk ?? 1) + (e.skill_magic ?? 1) + (e.skill_spirit ?? 1);
    const score = skillCount * 10 + stat;
    if (!best || score > best.score) best = { user: e, skillCount, stat, score };
  }
  return best;
}

function shouldSnipe(typeKey, threat, myHP, enemyHP) {
  if (!threat) return false;
  // 何も持っていない相手を撃っても無駄なので撃たない
  if (threat.skillCount === 0 && threat.stat <= 3) return false;

  switch (typeKey) {
    case 'assault':  return true;                      // 撃てるなら即撃つ
    case 'ambush':   return threat.skillCount >= 2;    // 技能を溜めた相手を狙う
    case 'guardian': return myHP < enemyHP;            // 劣勢時の起死回生に温存
    default:         return threat.score >= 23;        // 策士型：脅威度で判断
  }
}

async function executeSkillgeinBobsForArmy(army, client, channel) {
  const gameState = await GameState.findOne({ where: { id: 1 } });
  if (!gameState || gameState.isGameOver) return;

  const allInArmy = await User.findAll({ where: { army } });
  const armyBobs = allInArmy.filter(u => u.id.startsWith(`armybob-${army}-`));
  if (armyBobs.length === 0) return;

  const enemyArmy = army === 'A' ? 'B' : 'A';
  const armyNames = await getArmyNames();
  const armyName = armyNames[army];

  for (const bob of armyBobs) {
    await gameState.reload();
    if (gameState.isGameOver) break;

    const typeKey = getBobType(bob);
    const typeInfo = BOB_TYPES[typeKey] || BOB_TYPES.tactician;

    const initialHP = gameState.initialArmyHP;
    const armyA_HP = initialHP - gameState.b_team_kills;
    const armyB_HP = initialHP - gameState.a_team_kills;
    const myHP = army === 'A' ? armyA_HP : armyB_HP;
    const enemyHP = army === 'A' ? armyB_HP : armyA_HP;

    // ── 狙撃するか判断（人間の /snipe に相当） ──
    const snipePoints = bob.skill_snipe ?? 0;
    if (snipePoints >= 1) {
      const enemies = await User.findAll({ where: { army: enemyArmy } });
      const threat = pickSnipeTarget(enemies);

      if (shouldSnipe(typeKey, threat, myHP, enemyHP)) {
        const target = threat.user;
        const oldAtk = target.skill_atk ?? 1;
        const oldMagic = target.skill_magic ?? 1;
        const oldSpirit = target.skill_spirit ?? 1;
        const oldSkills = parseSkills(target);

        await target.update({
          skill_atk: 1, skill_magic: 1, skill_spirit: 1, skills_data: '[]',
        });
        await bob.update({ skill_snipe: snipePoints - 1 });

        let sMsg = `-# ${BOB_EMOJI} **[軍BOB]** ${armyName} **${bob.username}**【${typeInfo.name}${typeInfo.emoji}】の狙撃！\n`;
        sMsg += `### 🎯 **${armyNames[enemyArmy]} ${target.username}** を狙撃した！\n`;
        sMsg += `攻撃: **${oldAtk}** → **1**　魔力: **${oldMagic}** → **1**　精神: **${oldSpirit}** → **1**\n`;
        sMsg += oldSkills.length > 0
          ? `喪失した技能: **${oldSkills.length}個**（${oldSkills.map(s => s.name).join(', ')}）\n`
          : `技能: なし（喪失なし）\n`;
        sMsg += `-# 残り狙撃ポイント（${bob.username}）: **${snipePoints - 1}**\n`;

        if (channel) {
          try { await channel.send(sMsg); } catch (err) { console.error('❌ BOB狙撃投稿エラー:', err); }
          await sleep(BOB_ACTION_DELAY_MS);
        }
        // 狙撃したターンは通常行動をしない（人間も /snipe と /action は別行動）
        continue;
      }
    }

    // ── 通常行動（人間の /action に相当） ──
    const randomNum = Math.floor(Math.random() * 100);
    const randomStr = randomNum.toString().padStart(2, '0');

    const skills = parseSkills(bob);
    const curAtk0 = bob.skill_atk ?? 1;
    const curMagic0 = bob.skill_magic ?? 1;
    const curSpirit0 = bob.skill_spirit ?? 1;

    let msg = `-# ${BOB_EMOJI} **[軍BOB]** ${armyName} **${bob.username}**【${typeInfo.name}${typeInfo.emoji}】の行動！\n`;
    msg += `### 🎲 ジャッジナンバー: __${randomStr}__\n\n`;

    let totalDamage = 0, totalHeal = 0;
    let totalAtkUp = 0, totalMagicUp = 0, totalSpiritUp = 0;
    let newSkillsData = skills;
    const bobUpdate = {};

    if (randomNum === 0) {
      const newSnipe = (bob.skill_snipe ?? 0) + 1;
      bobUpdate.skill_snipe = newSnipe;
      msg += `🎯 **狙撃スキルアップ！**\n`;
      msg += `> 狙撃ポイント: **${bob.skill_snipe ?? 0}** → **${newSnipe}**\n`;

    } else if (randomNum % 10 === 0) {
      const power = rollPower();
      const skillName = SKILL_MAP[randomNum];
      newSkillsData = [...skills, { name: skillName, type: randomNum, power }];
      msg += `✨ **技能習得！**\n`;
      msg += `> 【${skillName}】 威力: **${power}**\n`;
      msg += `> （技能数: ${skills.length} → **${newSkillsData.length}** 個）\n`;

    } else if (Math.floor(randomNum / 10) === randomNum % 10) {
      if (skills.length === 0) {
        msg += `⚡ **ゾロ目！** しかし習得した技能がない…\n`;
      } else {
        msg += `⚡ **ゾロ目！ 習得技能が順番に発動チャンス！**\n\n`;
        const result = resolveSkillActivations(skills, {
          myHP, enemyHP, initialHP,
          atk: curAtk0, magic: curMagic0, spirit: curSpirit0,
        });
        msg += result.message;
        totalDamage = result.totalDamage;
        totalHeal = result.totalHeal;
        totalAtkUp = result.totalAtkUp;
        totalMagicUp = result.totalMagicUp;
        totalSpiritUp = result.totalSpiritUp;
      }
    }

    // ステータス更新
    if (totalAtkUp > 0) bobUpdate.skill_atk = curAtk0 + totalAtkUp;
    if (totalMagicUp > 0) bobUpdate.skill_magic = curMagic0 + totalMagicUp;
    if (totalSpiritUp > 0) bobUpdate.skill_spirit = curSpirit0 + totalSpiritUp;
    bobUpdate.skills_data = JSON.stringify(newSkillsData);
    bobUpdate.gekiha_counts = bob.gekiha_counts + 1;
    if (totalDamage > 0) bobUpdate.total_kills = bob.total_kills + totalDamage;
    await bob.update(bobUpdate);

    // ダメージ・回復を反映
    if (totalDamage > 0 || totalHeal > 0) {
      const gsUpdate = {};
      if (army === 'A') {
        if (totalDamage > 0) gsUpdate.a_team_kills = gameState.a_team_kills + totalDamage;
        if (totalHeal > 0) gsUpdate.b_team_kills = Math.max(0, gameState.b_team_kills - totalHeal);
      } else {
        if (totalDamage > 0) gsUpdate.b_team_kills = gameState.b_team_kills + totalDamage;
        if (totalHeal > 0) gsUpdate.a_team_kills = Math.max(0, gameState.a_team_kills - totalHeal);
      }
      await gameState.update(gsUpdate);
      await gameState.reload();

      const newHP_A = gameState.initialArmyHP - gameState.b_team_kills;
      const newHP_B = gameState.initialArmyHP - gameState.a_team_kills;
      msg += `\n**📊 戦況**\n`;
      msg += `🟡 ${armyNames.A}: **${newHP_A}** / ${initialHP}　　🟢 ${armyNames.B}: **${newHP_B}** / ${initialHP}\n`;

      if (totalAtkUp > 0 || totalMagicUp > 0 || totalSpiritUp > 0) {
        msg += `\n**⚡ ${bob.username} のステータス**\n`;
        msg += `攻撃: **${bob.skill_atk}**　魔力: **${bob.skill_magic}**　精神: **${bob.skill_spirit}**\n`;
      }

      // 終戦判定
      if (newHP_A <= 0 || newHP_B <= 0) {
        const winnerTeam = newHP_A > newHP_B ? armyNames.A : armyNames.B;
        const loserTeam = newHP_A > newHP_B ? armyNames.B : armyNames.A;
        await gameState.update({ isGameOver: true });
        msg += `\n**📢 ${loserTeam}の兵力が0になった！**\n`;
        msg += `# 🎖 ${winnerTeam}の勝利だ！\n`;
        msg += `**今次大戦は終戦した！次の大戦でまた会おう！**`;
      }
    }

    if (!channel) continue;
    try { await channel.send(msg); } catch (err) { console.error('❌ BOB技能習得投稿エラー:', err); }
    await sleep(BOB_ACTION_DELAY_MS);
  }
}

// ─────────────────────────────────────────────
// 戦友制 BOB行動
// ※ 行動が乱数のみで決まるルールのため、人間と同じ確率で動く
//    （性格タイプは表示上の味付けのみ。BOBだけ有利にならないようにするため）
// ─────────────────────────────────────────────

async function executeSenyuuBobsForArmy(army, client, channel) {
  const gameState = await GameState.findOne({ where: { id: 1 } });
  if (!gameState || gameState.isGameOver) return;

  const allInArmy = await User.findAll({ where: { army } });
  const armyBobs = allInArmy.filter(u => u.id.startsWith(`armybob-${army}-`));
  if (armyBobs.length === 0) return;

  const armyNames = await getArmyNames();
  const armyName = armyNames[army];

  for (const bob of armyBobs) {
    await gameState.reload();
    if (gameState.isGameOver) break;

    const typeKey = getBobType(bob);
    const typeInfo = BOB_TYPES[typeKey] || BOB_TYPES.tactician;

    const initialHP = gameState.initialArmyHP;
    const myHP    = initialHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
    const enemyHP = initialHP - (army === 'A' ? gameState.a_team_kills : gameState.b_team_kills);

    const randomNum = Math.floor(Math.random() * 100);
    const randomStr = randomNum.toString().padStart(2, '0');

    let msg = `-# ${BOB_EMOJI} **[軍BOB]** ${armyName} **${bob.username}**【${typeInfo.name}${typeInfo.emoji}】の行動！\n`;
    msg += `** :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${randomStr}__**\n`;

    const comrades = parseComrades(bob.comrades_data);
    const result = performSenyuuTurn({ comrades, randomNum, myHP, enemyHP, initialHP });
    msg += result.message;

    // BOB更新
    bob.comrades_data = serializeComrades(result.comrades);
    bob.gekiha_counts += 1;
    bob.total_kills += result.totalDamage;
    await bob.save();

    // 戦況反映
    await applySenyuuResult(gameState, army, result.totalDamage, result.totalHeal);
    await gameState.reload();

    // 部隊編成（常時表示）
    msg += `-# >>> 🪖 **${bob.username} の部隊**\n`;
    msg += formatComradeLine(result.comrades);

    if (result.totalDamage > 0 || result.totalHeal > 0) {
      const aHP = gameState.initialArmyHP - gameState.b_team_kills;
      const bHP = gameState.initialArmyHP - gameState.a_team_kills;
      msg += `-# >>> ⚔️ 戦況: 🟡 ${armyNames.A} 兵力${aHP} | 🟢 ${armyNames.B} 兵力${bHP}\n`;
      msg += `-# >>> 🏅 ${armyName} ${bob.username}　行動数: **${bob.gekiha_counts}回** 撃破数: **${bob.total_kills}撃破**\n`;

      // 終戦判定
      if (aHP <= 0 || bHP <= 0) {
        const winnerTeam = aHP > bHP ? armyNames.A : armyNames.B;
        const loserTeam  = aHP > bHP ? armyNames.B : armyNames.A;
        await gameState.update({ isGameOver: true });
        msg += `\n**📢 ${loserTeam}の兵力が0になった！**\n`;
        msg += `# 🎖 ${winnerTeam}の勝利だ！\n`;
        msg += `**今次大戦は終戦した！次の大戦でまた会おう！**`;
      }
    }

    if (!channel) continue;
    try { await channel.send(msg); } catch (err) { console.error('❌ BOB戦友投稿エラー:', err); }
    await sleep(BOB_ACTION_DELAY_MS);
  }
}

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

// 性格タイプ別・戦局を読んだ属性選択（{ element, reason } を返す）
function selectElement(army, gameState, bobType = 'tactician') {
  const enemyArmy = army === 'A' ? 'B' : 'A';

  const myKillsReceived    = army === 'A' ? gameState.b_team_kills : gameState.a_team_kills;
  const enemyKillsReceived = army === 'A' ? gameState.a_team_kills : gameState.b_team_kills;
  const myHP    = gameState.initialArmyHP - myKillsReceived;
  const enemyHP = gameState.initialArmyHP - enemyKillsReceived;
  const myHPRatio = myHP / gameState.initialArmyHP;

  const reasonMap = {};
  const weights = ELEMENTS.map(el => {
    const myCoinCount    = gameState[`${army.toLowerCase()}_${el.key}_coin`] || 0;
    const myMod          = myCoinCount % 5;
    const erasedEnemyCnt = gameState[`${enemyArmy.toLowerCase()}_${el.erases}_coin`] || 0;
    const erasedEnemyMod = erasedEnemyCnt % 5;
    const erasedName     = ELEMENTS.find(e => e.key === el.erases).name;

    // 基本重み（スキル発動に近いほど高い）
    let w = myMod === 0 ? 1 : myMod + 1;
    let reason = myMod >= 3
      ? `${el.name}スキルまであと${5 - myMod}枚`
      : `${el.name}コイン蓄積中`;

    switch (bobType) {

      case 'assault': // 猪突型：火・雷を常に高重み、HP状況を無視して攻撃
        if (el.key === 'fire')    { w += 5; reason = '猪突本能（火力重視）'; }
        if (el.key === 'thunder') { w += 4; reason = '猪突本能（雷撃重視）'; }
        break;

      case 'guardian': // 守護型：水を常に高重み、HP50%以下で木も強化
        if (el.key === 'water') {
          w += 8;
          reason = myHPRatio <= 0.5 ? '守護本能（危機！回復最優先）' : '守護本能（水の癒し）';
        }
        if (myHPRatio <= 0.5 && el.key === 'wood') { w += 3; reason = '守護本能（劣勢フォロー）'; }
        break;

      case 'ambush': // 奇襲型：敵コイン消去量に比例して重みを大幅増加
        if (erasedEnemyMod >= 1) {
          w += erasedEnemyMod * 2;
          reason = `奇襲本能（敵の${erasedName}コイン${erasedEnemyCnt}枚を消す）`;
        }
        break;

      default: // 策士型：全戦局を総合判断（旧ロジック踏襲）
        if (myHPRatio <= 0.3 && el.key === 'water') { w += 8; reason = '危機回避（回復優先）'; }
        if (erasedEnemyMod >= 3) { w += 3; reason = `敵スキル阻止（敵${erasedName}${erasedEnemyCnt}枚）`; }
        if (myHP > enemyHP + 20 && el.key === 'earth') { w += 3; reason = '優勢維持（土×3狙い）'; }
        if (enemyHP > myHP + 20 && el.key === 'wood')  { w += 3; reason = '逆転狙い（木×3狙い）'; }
        break;
    }

    reasonMap[el.key] = reason;
    return w;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    if (rand < weights[i]) return { element: ELEMENTS[i], reason: reasonMap[ELEMENTS[i].key] };
    rand -= weights[i];
  }
  return { element: ELEMENTS[0], reason: reasonMap[ELEMENTS[0].key] };
}

// コイン判定ロール
function rollCoin() {
  const randomNum = Math.floor(Math.random() * 1000);
  const randomStr = randomNum.toString().padStart(3, '0');
  const first  = Math.floor(randomNum / 100);
  const second = Math.floor((randomNum % 100) / 10);
  const third  = randomNum % 10;

  let acquired = 0;
  let displayMessage = `** :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${randomStr}__**`;

  if (first === second && second === third) {
    acquired = 5;
    displayMessage += ` 🌟 **全桁ゾロ目！大量取得！** 🌟  **${acquired}枚GET!**\n`;
  } else if (second === third) {
    acquired = 1;
    displayMessage += ` ➡️ **下2桁ゾロ目！**  **${acquired}枚GET!**\n`;
  } else {
    acquired = 0;
    displayMessage += ` → ざんねん、GETならず…\n`;
  }
  return { acquired, displayMessage };
}

// 両軍コイン状況テキスト生成
// 表示順は誰の行動でも A軍 → B軍 で固定（人間側の表示と統一）
function buildCoinStatus(army, gameState, armyNames) {
  return buildCoinStatusFixed(gameState, armyNames);
}

// 加重ランダム階級
function weightedRandomRank() {
  const totalWeight = weight.reduce((s, w) => s + w, 0);
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < weight.length; i++) {
    if (rand < weight[i]) return ranks[i];
    rand -= weight[i];
  }
  return ranks[0];
}

// ランダム名前
function randomBobName() {
  return BOB_NAMES[Math.floor(Math.random() * BOB_NAMES.length)];
}

// ランダムタイプ
function randomBobType() {
  return BOB_TYPE_KEYS[Math.floor(Math.random() * BOB_TYPE_KEYS.length)];
}

// BOBのタイプキー取得（bob_type カラム。旧データは skills_data からも読む）
export function getBobType(bob) {
  if (bob.bob_type) return bob.bob_type;
  try {
    const data = JSON.parse(bob.skills_data || '{}');
    if (!Array.isArray(data) && data.bobtype) return data.bobtype;
  } catch {
    // 破損データは既定タイプにフォールバック
  }
  return 'tactician';
}
