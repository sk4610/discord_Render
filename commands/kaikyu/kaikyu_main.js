import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { getArmyName } from './kaikyu.mjs';

const ranks = ['二等兵🔸', '一等兵🔺', '軍曹🔶', '曹長♦️', '大尉⚡', '大佐💠', '准将🔆', '大将🔱', '元帥🎖️'];
const specialRank = '軍神🌟';

// 各階級ごとの大量撃破時の撃破数
const largeKillCounts = {
  '二等兵🔸': 4, '一等兵🔺': 5, '軍曹🔶': 6, '曹長♦️': 7, '大尉⚡': 8,
  '大佐💠': 9, '准将🔆': 10, '大将🔱': 11, '元帥🎖️': 12, '軍神🌟': 16
};

// State.countMode を取得する関数
async function getCountMode() {
  const gameState = await GameState.findOne({ where: { id: 1 } });
  return gameState ? gameState.countMode : "up"; // デフォルトは up
}

// 撃破処理と昇格判定（乱数表示版）
function processKillWithRandom(currentRank) {
  let kills = 0;
  let rankUp = false;
  let displayMessage = "";
  
  // 3桁乱数生成（000-999）
  const randomNum = Math.floor(Math.random() * 1000);
  const randomStr = randomNum.toString().padStart(3, '0'); // 3桁表示（001, 023など）
  
  displayMessage += `\n-# :scales: ジャッジナンバー\n## __${randomStr}__\n`;
  
  // 下2桁を取得
  const lastTwoDigits = randomNum % 100;
  const firstDigit = Math.floor(randomNum / 100);
  const secondDigit = Math.floor((randomNum % 100) / 10);
  const thirdDigit = randomNum % 10;
  
  // 判定処理
  if (randomNum === 0) {
    // 000の場合：軍神昇格 or 軍神時32撃破
    if (currentRank === specialRank) {
      kills = 32;
      displayMessage += `### ✨ **000！軍神の超・超・大量撃破！** → **${kills}撃破**\n`;
    } else {
      kills = 16;
      rankUp = true;
      displayMessage += `### 🌟 **000！軍神昇格！** → **${kills}撃破**\n`;
      return { newRank: specialRank, kills, rankUp, displayMessage };
    }
  } else if (firstDigit === secondDigit && secondDigit === thirdDigit && randomNum !== 0) {
    // 全桁ゾロ目（111-999）：大量撃破 + 通常昇格
    kills = largeKillCounts[currentRank] || 1;
    rankUp = true;
    displayMessage += `### 🔥 **全桁ゾロ目！大量撃破！** 🔥  **${kills}撃破！** + **昇格！**\n`;
  } else if (secondDigit === thirdDigit) {
    // 下2桁ゾロ目：通常撃破
    kills = 1;
    displayMessage += `### ➡️ **下2桁ゾロ目！**  **${kills}撃破！**\n`;
  } else {
    // ハズレ
    kills = 0;
    displayMessage += `### ➡️ **ざんねん、${kills}撃破**\n`;
  }
  
  // 通常昇格処理（000以外の場合）
  const currentIndex = ranks.indexOf(currentRank);
  let newRank = currentRank;
  if (rankUp && currentIndex !== -1 && currentIndex < ranks.length - 1) {
    newRank = ranks[currentIndex + 1];
  } else if (rankUp && currentIndex === ranks.length - 1) {
    // 既に元帥の場合は昇格しない
    rankUp = false;
    displayMessage = displayMessage.replace(" + **昇格**", "");
  }
  
  return { newRank, kills, rankUp, displayMessage };
}

export async function kaikyu_main(interaction) {
  try {
    const userId = interaction.user.id;
    const player = await User.findOne({ where: { id: userId } });
    const currentRank = player.rank;
    const username = interaction.member.displayName;
    const customMessage = interaction.options.getString("message") || "";
    const countMode = await getCountMode();

    if (!player) {
      return await interaction.reply('エラー: まず /kaikyu で軍と階級を決めてください。');
    }

    // 撃破処理（乱数表示版）
    const { newRank, kills, rankUp, displayMessage } = processKillWithRandom(currentRank);

    // 兵士データを更新
    player.rank = newRank;
    player.total_kills += kills;
    player.gekiha_counts += 1;
    await player.save();

    // GameStateに撃破数を反映
    const gameState = await GameState.findOne({ where: { id: 1 } });
    if (!gameState) {
      return await interaction.reply("エラー: ゲームデータが見つかりません。");
    }
    
    if (player.army === "A") {
      await gameState.increment("a_team_kills", { by: kills });
    } else {
      await gameState.increment("b_team_kills", { by: kills });
    }

    await gameState.reload();

    // A軍とB軍の総撃破数を計算
    const totalKillsA = await User.sum('total_kills', { where: { army: 'A' } }) || 0;
    const totalKillsB = await User.sum('total_kills', { where: { army: 'B' } }) || 0;

    // 軍名を取得
    const armyNameA = getArmyName('A');
    const armyNameB = getArmyName('B');
    
    const UserArmy = await User.findOne({ where: { id: userId }, raw: true});
    const UserArmyName = UserArmy.army === 'A' ? armyNameA : armyNameB;

    // メッセージ作成
    let message = `-#  :military_helmet: ${UserArmyName} ${username} の攻撃！\n`;
    
    // 乱数判定結果を表示
    message += displayMessage;
    message += `.\n`;
    
    // 昇格メッセージ
    if (rankUp) {
      message += `## 🔥階級昇格！🔥 \n **新階級: ${player.rank}** へ昇格！\n\n`;
    }
    
    // 戦績表示
    message += `-# >>> 🏅戦績\n`;
    message += `-# >>> ${UserArmyName} ${username}  階級:${player.rank}\n`;
    message += `-# >>> 攻撃数: **${player.gekiha_counts}回** `;
    message += `　撃破数: **${player.total_kills}撃破**\n`;
    //message += `-# >>> -\n`;
    
    // 戦況表示
    if (countMode === 'down') {
      const gameState = await GameState.findOne({ where: { id: 1 } });
      const remainingHP_A = gameState.initialArmyHP - totalKillsB;
      const remainingHP_B = gameState.initialArmyHP - totalKillsA;
      
      message += `-# >>> :crossed_swords:  現在の戦況:\n`;
      message += `-# >>> :yellow_circle: ${armyNameA} 残存兵力: ${remainingHP_A}\n`;
      message += `-# >>> :green_circle: ${armyNameB} 残存兵力: ${remainingHP_B}\n`;
    } else if (countMode === 'up') {
      message += `-# >>> :crossed_swords:  現在の戦況:\n`;
      message += `-# >>> :yellow_circle: ${armyNameA}: 総${totalKillsA}撃破\n`;
      message += `-# >>> :green_circle: ${armyNameB}: 総${totalKillsB}撃破\n`;
    }
    
    // カスタムメッセージ
    if (customMessage) {
      message += `\`\`\`${customMessage}\`\`\`\n`;
    }
    
    await interaction.reply(message);
    
    // BOB支援制度（既存のロジックを維持）
    if (player.bobEnabled) {
      const bobId = `bob-${userId}`;
      const bobUser = await User.findOne({ where: { id: bobId } });
      
      if (bobUser) {
        const bobRank = bobUser.rank;
        const { newRank: bobNewRank, kills: bobKills, rankUp: bobRankUp, displayMessage: bobDisplayMessage } = processKillWithRandom(bobRank);

        bobUser.rank = bobNewRank;
        bobUser.total_kills += bobKills;
        bobUser.gekiha_counts += 1;
        await bobUser.save();

        if (bobUser.army === 'A') {
          await gameState.increment("a_team_kills", { by: bobKills });
        } else {
          await gameState.increment("b_team_kills", { by: bobKills });
        }

        let bobMessage = `-#  **BOB支援制度**が発動！\n`;
        const emoji = "<:custom_emoji:1350367513271341088>";
        bobMessage += `-# ${emoji} ${getArmyName(bobUser.army)} ${bobUser.username} の攻撃！\n`;
        
        // BOBの乱数判定結果
        bobMessage += bobDisplayMessage;
        bobMessage += `.\n`;
        
        if (bobRankUp) {
          bobMessage += `## 🔥階級昇格！🔥 \n **新階級: ${bobUser.rank}** へ昇格！\n\n`;
        }

        bobMessage += `-# >>> 🏅戦績（BOB）\n`;
        bobMessage += `-# >>> ${getArmyName(bobUser.army)} ${bobUser.username} 階級: ${bobUser.rank}\n`;
        bobMessage += `-# >>> 攻撃数: **${bobUser.gekiha_counts}回**`;
        bobMessage += `　撃破数: **${bobUser.total_kills}撃破**\n`;
        
        // BOBの戦況表示
        if (countMode === 'down') {
          const gameState = await GameState.findOne({ where: { id: 1 } });
          const remainingHP_A = gameState.initialArmyHP - totalKillsB;
          const remainingHP_B = gameState.initialArmyHP - totalKillsA;
          
          bobMessage += `-# >>> :crossed_swords:  現在の戦況:\n`;
          bobMessage += `-# >>> :yellow_circle: ${armyNameA} 残存兵力: ${remainingHP_A}\n`;
          bobMessage += `-# >>> :green_circle: ${armyNameB} 残存兵力: ${remainingHP_B}\n`;
        } else if (countMode === 'up') {
          bobMessage += `-# >>> :crossed_swords:  現在の戦況:\n`;
          bobMessage += `-# >>> :yellow_circle: ${armyNameA}: 総${totalKillsA}撃破\n`;
          bobMessage += `-# >>> :green_circle: ${armyNameB}: 総${totalKillsB}撃破\n`;
        }
        
        await interaction.followUp(bobMessage);
      }
    }
    
  } catch (error) {
    console.error('撃破処理エラー1:', error);
    await interaction.reply('エラー1: 撃破処理に失敗しました');
  }
}