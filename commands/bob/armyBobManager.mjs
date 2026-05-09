import { GameState, User } from '../taisen/game.js';
import { processKillWithRandom } from '../kaikyu/kaikyu_main.js';
import { getArmyNames } from '../armyname/armyname.js';

const BOB_EMOJI = "<:custom_emoji:1350367513271341088>";

// 階級テーブル（kaikyu.mjsと同一）
const ranks = ['二等兵🔸', '一等兵🔺', '軍曹🔶', '曹長♦️', '大尉⚡', '大佐💠', '准将🔆', '大将🔱', '元帥🎖️'];
const weight = [28, 24, 20, 13, 8, 4, 1.5, 1, 0.5];

let bobTimerHandle = null;

// main.mjsから呼び出してBOBタイマーを開始する
export function startArmyBobTimer(client) {
  if (bobTimerHandle) clearInterval(bobTimerHandle);
  bobTimerHandle = setInterval(() => checkAndActBobs(client), 60 * 1000); // 毎分チェック
  console.log('✅ 軍BOBタイマー開始（毎分チェック）');
}

// タイマー停止
export function stopArmyBobTimer() {
  if (bobTimerHandle) {
    clearInterval(bobTimerHandle);
    bobTimerHandle = null;
    console.log('🛑 軍BOBタイマー停止');
  }
}

// タイマーコールバック：行動時刻かチェックして実行
async function checkAndActBobs(client) {
  try {
    const gameState = await GameState.findOne({ where: { id: 1 } });
    if (!gameState) return;
    if (!gameState.armybob_enabled) return;
    if (gameState.isGameOver) return;
    if (!gameState.rule_type || gameState.rule_type === 'none') return;

    // 階級制のみPhase1対応
    if (gameState.rule_type !== 'ranked') return;

    const now = new Date();
    const lastAction = gameState.armybob_last_action ? new Date(gameState.armybob_last_action) : null;
    const intervalMs = gameState.armybob_interval * 60 * 1000;

    if (lastAction && (now - lastAction) < intervalMs) return;

    // 行動時刻を記録（二重実行防止）
    await gameState.update({ armybob_last_action: now });

    const channel = gameState.armybob_channel_id
      ? client.channels.cache.get(gameState.armybob_channel_id)
      : null;

    // BOB数を参加者数に合わせて調整
    await adjustBobCounts(gameState);

    // 各軍のBOBを行動させる
    await executeBobsForArmy('A', client, channel);
    await executeBobsForArmy('B', client, channel);

  } catch (error) {
    console.error('❌ 軍BOBタイマーエラー:', error);
  }
}

// 軍ごとのBOB数を参加者数に合わせて自動調整
async function adjustBobCounts(gameState) {
  const target = gameState.armybob_target_size;
  const armyNames = await getArmyNames();

  for (const army of ['A', 'B']) {
    const allInArmy = await User.findAll({ where: { army } });

    // 人間プレイヤー（armybob-・bob-プレフィックスを除外）
    const humanCount = allInArmy.filter(
      u => !u.id.startsWith('armybob-') && !u.id.startsWith('bob-')
    ).length;

    // 現在の軍BOBリスト
    const currentBobs = allInArmy.filter(u => u.id.startsWith(`armybob-${army}-`));

    const needed = Math.max(0, target - humanCount);

    if (currentBobs.length < needed) {
      // BOBを追加作成
      for (let i = currentBobs.length + 1; i <= needed; i++) {
        const bobId = `armybob-${army}-${i}`;
        const exists = await User.findOne({ where: { id: bobId } });
        if (!exists) {
          const bobRank = weightedRandomRank();
          const armyLabel = armyNames[army];
          await User.create({
            id: bobId,
            username: `${armyLabel}兵士${army}-${i}`,
            army,
            rank: bobRank,
            total_kills: 0,
          });
          console.log(`✅ 軍BOB配置: ${bobId} (${bobRank})`);
        }
      }
    } else if (currentBobs.length > needed) {
      // 余剰BOBを削除（番号の大きいものから）
      const excess = currentBobs
        .sort((a, b) => {
          const numA = parseInt(a.id.split('-').pop(), 10);
          const numB = parseInt(b.id.split('-').pop(), 10);
          return numB - numA;
        })
        .slice(0, currentBobs.length - needed);
      for (const bob of excess) {
        await bob.destroy();
        console.log(`🗑️ 軍BOB撤退: ${bob.id}`);
      }
    }
  }
}

// 1軍の全BOBを行動させる
async function executeBobsForArmy(army, client, channel) {
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
      if (army === 'A') {
        await gameState.increment('a_team_kills', { by: kills });
      } else {
        await gameState.increment('b_team_kills', { by: kills });
      }
      await gameState.reload();
    }

    if (!channel) continue;

    // 投稿メッセージ作成
    let msg = `-# ${BOB_EMOJI} **[軍BOB]** ${armyName} ${bob.username} が行動！\n`;
    msg += displayMessage;

    if (rankUp) {
      msg += `### 🔥 **新階級: ${bob.rank}** へ昇格！\n`;
    }

    if (kills > 0) {
      await gameState.reload();
      if (countMode === 'down') {
        const remA = gameState.initialArmyHP - gameState.b_team_kills;
        const remB = gameState.initialArmyHP - gameState.a_team_kills;
        msg += `-# >>> ⚔️ 現在の戦況: 🟡 ${armyNameA} 兵力${remA} | 🟢 ${armyNameB} 兵力${remB}\n`;
      } else {
        const totalA = (await User.sum('total_kills', { where: { army: 'A' } })) || 0;
        const totalB = (await User.sum('total_kills', { where: { army: 'B' } })) || 0;
        msg += `-# >>> ⚔️ 現在の戦況: 🟡 ${armyNameA} 兵力${totalA} | 🟢 ${armyNameB} 兵力${totalB}\n`;
      }
      msg += `-# >>> 🏅 ${armyName} ${bob.username} 行動数: **${bob.gekiha_counts}回** 撃破数: **${bob.total_kills}撃破**\n`;
    }

    msg += '.';

    try {
      await channel.send(msg);
    } catch (err) {
      console.error(`❌ 軍BOB投稿エラー (${bob.id}):`, err);
    }

    // 終戦チェック（途中でゲームが終わったら残りのBOBは行動しない）
    await gameState.reload();
    if (gameState.isGameOver) break;
  }
}

// 加重ランダムで階級を決定
function weightedRandomRank() {
  const totalWeight = weight.reduce((sum, w) => sum + w, 0);
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < weight.length; i++) {
    if (rand < weight[i]) return ranks[i];
    rand -= weight[i];
  }
  return ranks[0];
}
