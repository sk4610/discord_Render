import { GameState, User } from '../taisen/game.js';
import { processKillWithRandom } from '../kaikyu/kaikyu_main.js';
import { getArmyNames } from '../armyname/armyname.js';

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
  '太郎', '花子', '次郎', '三郎', '健一', '美咲', '翔', '愛',
  '勇', '優', '誠', '恵', '剛', '葵', '蓮', '凛',
  '大輔', '奈々', '真司', '沙織', '拓也', '由美', '賢二', '千夏',
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

async function checkAndActBobs(client) {
  try {
    const gameState = await GameState.findOne({ where: { id: 1 } });
    if (!gameState) return;
    if (!gameState.armybob_enabled) return;
    if (gameState.isGameOver) return;

    const rule = gameState.rule_type;
    if (!rule || rule === 'none') return;

    // 対応ルールチェック
    if (rule !== 'ranked' && rule !== 'coin') return;

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
      if (rule === 'ranked') {
        await executeRankedBobsForArmy(army, client, channel);
      } else if (rule === 'coin') {
        await executeCoinBobsForArmy(army, client, channel);
      }
    }

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
          const armyLabel = armyNames[army];
          await User.create({ id: bobId, username: bobName, army, rank: bobRank, total_kills: 0 });
          console.log(`✅ 軍BOB配置: ${bobId} "${bobName}" (${bobRank})`);

          if (channel) {
            const greeting = BOB_GREETINGS[Math.floor(Math.random() * BOB_GREETINGS.length)];
            const rule = gameState.rule_type;
            const rankLine = rule === 'ranked' ? `-# >>> 🎖️ 初期階級: **${bobRank}**\n` : '';
            try {
              await channel.send(
                `${BOB_EMOJI} **[軍BOB着任]** ${armyLabel} に **${bobName}** が着任しました！\n` +
                rankLine +
                `-# >>> 「${greeting}」`
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

    // スキル発動に近い属性を優先して選択
    const element = selectElement(army, gameState);

    const { acquired, displayMessage } = rollCoin();

    const coinCol = `${army.toLowerCase()}_${element.key}_coin`;
    const before = gameState[coinCol];
    const after = before + acquired;
    gameState[coinCol] = after;

    // 個人戦績更新
    bob[`personal_${element.key}_coin`] = (bob[`personal_${element.key}_coin`] || 0) + acquired;
    bob.gekiha_counts += 1;

    let msg = `-# ${BOB_EMOJI} **[軍BOB]** ${armyName} **${bob.username}** が【${element.name}】コインを狙う！\n`;
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
// ユーティリティ
// ─────────────────────────────────────────────

// 戦局を読んだ属性選択（加重ランダム）
function selectElement(army, gameState) {
  const enemyArmy = army === 'A' ? 'B' : 'A';

  // HP計算
  const myKillsReceived   = army === 'A' ? gameState.b_team_kills : gameState.a_team_kills;
  const enemyKillsReceived = army === 'A' ? gameState.a_team_kills : gameState.b_team_kills;
  const myHP    = gameState.initialArmyHP - myKillsReceived;
  const enemyHP = gameState.initialArmyHP - enemyKillsReceived;
  const myHPRatio = myHP / gameState.initialArmyHP;

  const weights = ELEMENTS.map(el => {
    const myCoinCount = gameState[`${army.toLowerCase()}_${el.key}_coin`] || 0;
    const myMod = myCoinCount % 5;

    // 基本重み：自分のスキル発動に近いほど高い
    let w = myMod === 0 ? 1 : myMod + 1;

    // 🚨 瀕死（HP30%以下）：水を強く優先（回復スキル狙い）
    if (myHPRatio <= 0.3 && el.key === 'water') w += 8;

    // ⚔️ 敵スキル阻止：敵がスキル発動間近の属性を消せる属性を優先
    // el のスキルが発動すると enemyArmy の el.erases コインが消える
    const erasedEnemyCoins = gameState[`${enemyArmy.toLowerCase()}_${el.erases}_coin`] || 0;
    const erasedEnemyMod   = erasedEnemyCoins % 5;
    if (erasedEnemyMod >= 3) w += 3; // 敵が3〜4枚 → 消去を急ぐ

    // 💪 優勢時（自HP > 敵HP + 20）：土を優先（優勢×3倍スキル狙い）
    if (myHP > enemyHP + 20 && el.key === 'earth') w += 3;

    // 📉 劣勢時（敵HP > 自HP + 20）：木を優先（劣勢×3倍スキル狙い）
    if (enemyHP > myHP + 20 && el.key === 'wood') w += 3;

    return w;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    if (rand < weights[i]) return ELEMENTS[i];
    rand -= weights[i];
  }
  return ELEMENTS[0];
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
function buildCoinStatus(army, gameState, armyNames) {
  const enemyArmy = army === 'A' ? 'B' : 'A';
  const fmt = (a) =>
    `-# >>> 【${armyNames[a]}のコイン状況】` +
    `🔥 火:${gameState[`${a.toLowerCase()}_fire_coin`]}枚 ` +
    `🌲 木:${gameState[`${a.toLowerCase()}_wood_coin`]}枚 ` +
    `:rock: 土:${gameState[`${a.toLowerCase()}_earth_coin`]}枚 ` +
    `⚡ 雷:${gameState[`${a.toLowerCase()}_thunder_coin`]}枚 ` +
    `💧 水:${gameState[`${a.toLowerCase()}_water_coin`]}枚\n`;
  return fmt(army) + fmt(enemyArmy);
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
