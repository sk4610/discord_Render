import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { getArmyName } from './kaikyu.mjs';

const ranks = ['二等兵＝', '一等兵〓', '軍曹¶', '曹長†', '大尉‡', '大佐▽', '准将◇', '大将Θ', '元帥☆'];
const specialRank = '軍神Å';

// 各階級ごとの大量撃破時の撃破数
const largeKillCounts = {
  '二等兵＝': 4, '一等兵〓': 5, '軍曹¶': 6, '曹長†': 7, '大尉‡': 8,
  '大佐▽': 9, '准将◇': 10, '大将Θ': 11, '元帥☆': 12, '軍神Å': 16
};

// 超・大量撃破の撃破数（軍神のみ特別）
const superMassiveKillCount = 32;

// 確率設定
function isNormalKill() {
  return Math.random() < 1 / 10; // 10% の確率で通常撃破
}

function isLargeKill() {
  return Math.random() < 1 / 100; // 1% の確率で大量撃破
}

function isSuperMassiveKill() {
  return Math.random() < 1 / 1000; // 0.1% の確率で超・大量撃破
}

// State.countMode を取得する関数
// 大戦方式（カウントダウンorカウントアップ）により書き込み欄下の集計を切り替える
async function getCountMode() {
  const gameState = await GameState.findOne({ where: { id: 1 } });
  return gameState ? gameState.countMode : "up"; // デフォルトは up
}

// 撃破処理と昇格判定
function processKill(currentRank) {
  let kills = 0; // 初期撃破数は0
  let rankUp = false;

  if (currentRank === specialRank) {
    // 軍神Åの処理
    if (isSuperMassiveKill()) {
      kills = superMassiveKillCount; // 軍神Åの超・大量撃破は32撃破
    }
    return { newRank: specialRank, kills, rankUp };
  }

  if (isSuperMassiveKill()) {
    // 軍神Åに昇格
    return { newRank: specialRank, kills: largeKillCounts[specialRank], rankUp: true };
  }

  if (isLargeKill()) {
    // 通常の大量撃破
    kills = largeKillCounts[currentRank] || 1; // 各階級の大量撃破数
    rankUp = true;
  } else if (isNormalKill()) {
    // 通常撃破（1撃破）
    kills = 1;
  }

  // 通常昇格（軍神Åにはならない）
  const currentIndex = ranks.indexOf(currentRank);
  let newRank = currentRank;
  if (rankUp && currentIndex !== -1 && currentIndex < ranks.length - 1) {
    newRank = ranks[currentIndex + 1]; // 次の階級に昇格
  }

  return { newRank, kills, rankUp };
}

export async function kaikyu_main(interaction) {
  try {
    const userId = interaction.user.id;
    const player = await User.findOne({ where: { id: userId } });
    const currentRank = player.rank;
    const username = interaction.member.displayName;
    const customMessage = interaction.options.getString("message") || ""; // メッセージ取得（デフォルトは空）
    const countMode = await getCountMode(); // ここで countMode を取得

    if (!player) {
      return await interaction.reply('エラー: まず /kaikyu で軍と階級を決めてください。');
    }

    // 撃破処理
    const { newRank, kills, rankUp } = processKill(currentRank);

    // 兵士データを更新
    player.rank = newRank;
    player.total_kills += kills;
    player.gekiha_counts += 1;
    await player.save();

    // **GameStateに撃破数を反映**
    const gameState = await GameState.findOne({ where: { id: 1 } });
    if (!gameState) {
      return await interaction.reply("エラー: ゲームデータが見つかりません。");
    }
    
    if (player.army === "A") {
      await gameState.increment("a_team_kills", { by: kills });
    } else {
      await gameState.increment("b_team_kills", { by: kills });
    }

    // **DBを最新の状態に更新**
    await gameState.reload();

    
    // A軍とB軍の総撃破数を計算
    const totalKillsA = await User.sum('total_kills', { where: { army: 'A' } }) || 0;
    const totalKillsB = await User.sum('total_kills', { where: { army: 'B' } }) || 0;

    // A軍とB軍の名前を取得
    const armyNameA = getArmyName('A');
    const armyNameB = getArmyName('B');
    
    // ユーザの所属軍を取得
    const UserArmy = await User.findOne({ where: { id: userId }, raw: true});
    const UserArmyName = UserArmy.army === 'A' ? armyNameA : armyNameB;

    // メッセージ作成（ユーザーのメッセージを最初に追加）
    let message = "";
   
    // メッセージ作成
    message += `-#  :military_helmet: ${UserArmyName} ${username} の攻撃！\n`;
    if(kills === 0){
      message += `## ざんねん、${kills} 撃破\n.\n`; //0撃破の場合
    }else{
      message += `## 命中！${kills} 撃破！\n.\n`; //1撃破以上の場合
    }
    
    if (rankUp) message += `## 🔥大量撃破だ！！🔥 \n **新階級: ${player.rank}**へ昇格！ \n\n`;
    // 自分の撃破数
    message += `-# >>> 🏅戦績\n-# >>> ${UserArmyName} ${username}  階級:${player.rank} \n-# >>> 攻撃数: **${player.gekiha_counts}**回 \n-# >>> 撃破数: **${player.total_kills}** 撃破\n-# >>> -\n`
    // 軍の総撃破数を表示
    // カウントダウンの場合は残存兵力を表示する
    if (countMode === 'down') {
      const gameState = await GameState.findOne({ where: { id: 1 } });
      const remainingHP_A = gameState.initialArmyHP - totalKillsB;
      const remainingHP_B = gameState.initialArmyHP - totalKillsA;
      
      message += `-# >>> :crossed_swords:  現在の戦況:\n-# >>> :yellow_circle: ${armyNameA} 残存兵力: ${remainingHP_A} \n-# >>> :green_circle: ${armyNameB} 残存兵力: ${remainingHP_B} \n`;

    }else if (countMode === 'up') {    
    
      message += `-# >>> :crossed_swords:  現在の戦況:\n-# >>> :yellow_circle: ${armyNameA}: 　総${totalKillsA} 撃破\n-# >>> :green_circle: ${armyNameB}: 総${totalKillsB} 撃破\n`;
      
    }
      
     // メッセージ（ユーザーが入力したもの）
    if (customMessage) {
      message += ` \`\`\`${customMessage}\`\`\`\n`;
    }   

    
    await interaction.reply(message);
    
  // BOB支援制度の撃破処理を追加（ゲーム設定で有効になっている場合）
    if (GameState?.bobEnabled) {
      const bobId = `bob-${userId}`;
      const bobUser = await User.findOne({ where: { id: bobId } });

    if (bobUser) {
      const bobRank = bobUser.rank;
      const { newRank: bobNewRank, kills: bobKills, rankUp: bobRankUp } = processKill(bobRank);

      // BOBのデータを更新
      bobUser.rank = bobNewRank;
      bobUser.total_kills += bobKills;
      bobUser.gekiha_counts += 1;
      await bobUser.save();

      // BOBの所属軍にも撃破数を加算
        if (bobUser.army === 'A') {
          await gameState.increment("a_team_kills", { by: bobKills });
        } else {
          await gameState.increment("b_team_kills", { by: bobKills });
        }

      // フォローアップでBOBの戦果も通知
      let bobMessage = `-#  **BOB支援制度**が発動！\n`;
      bobMessage += `-# :military_helmet: ${getArmyName(bobUser.army)} ${bobUser.username} の攻撃！\n`;

      if (bobKills === 0) {
        bobMessage += `## ざんねん、${bobKills} 撃破\n.\n`;
      } else {
        bobMessage += `## 命中！${bobKills} 撃破！\n.\n`;
      }

      if (bobRankUp) {
        bobMessage += `## 🔥大量撃破だ！！🔥 \n **新階級: ${bobUser.rank}**へ昇格！\n\n`;
      }

      bobMessage += `-# >>> 🏅戦績（BOB）\n-# >>> ${getArmyName(bobUser.army)} ${bobUser.username} 階級: ${bobUser.rank} \n-# >>> 攻撃数: **${bobUser.gekiha_counts}**回 \n-# >>> 撃破数: **${bobUser.total_kills}** 撃破\n`;

      await interaction.followUp(bobMessage);
    }
  }
  
  
  } catch (error) {
    console.error('撃破処理エラー1:', error);
    await interaction.reply('エラー1: 撃破処理に失敗しました');
  }
}
