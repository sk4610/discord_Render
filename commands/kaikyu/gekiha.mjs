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

export const data = new SlashCommandBuilder()
  .setName('gekiha')
  .setDescription('撃破数を決定します')
  .addStringOption(option =>
      option.setName("message")
      .setDescription("一言レスを表示")
      .setRequired(false) // trueにすると必須、falseにすると任意 
  );

export async function execute(interaction) {
  const userId = interaction.user.id;
  const username = interaction.member.displayName;
  const customMessage = interaction.options.getString("message") || ""; // メッセージ取得（デフォルトは空）

  
  
  try {
    
    // プレイヤーが登録済みか確認
    const player = await User.findOne({ where: { id: userId } });
    if (!player) {
      return await interaction.reply('エラー: まず /kaikyu で軍と階級を決めてください。');
    }
    
    // 撃破数の処理（ランダム、昇格処理など）
//    let kills = 0;
//    let rankUp = false;
//    let newRank = currentRank;
      const currentRank = player.rank;
    
     // 通常撃破処理
//    if (Math.random() < 0.1) { // 10%で通常撃破（1撃破）
//      kills = 1;
//    }   
//    // 撃破数をランダム決定
//    let kills = Math.random() < 0.01 ? 5 : Math.floor(Math.random() * 2); // 1%で5撃破, それ以外は0 or 1

    // 撃破処理
    const { newRank, kills, rankUp } = processKill(currentRank);


    // 階級昇格判定
//    let rankUp = false;
//    if (kills === 5) {
//      const currentRankIndex = ranks.indexOf(player.rank);
//      if (currentRankIndex < ranks.length - 1) {
//        player.rank = ranks[currentRankIndex + 1]; // 階級を1つ昇格
//        rankUp = true;
//      }
//    }

    // 兵士データを更新
    player.rank = newRank;
    player.total_kills += kills;
    player.gekiha_counts += 1;
    await player.save();

    // A軍とB軍の総撃破数を計算
    const totalKillsA = await User.sum('total_kills', { where: { army: 'A' } }) || 0;
    const totalKillsB = await User.sum('total_kills', { where: { army: 'B' } }) || 0;

    // A軍とB軍の名前を取得
    const armyNameA = getArmyName('A');
    const armyNameB = getArmyName('B');

    // メッセージ作成（ユーザーのメッセージを最初に追加）
    let message = "";
   
    // メッセージ作成
    message += `-#  :military_helmet: ${username} の攻撃！\n`;
    if(kills === 0){
      message += `## 残念、${kills} 撃破\n.\n`; //0撃破の場合
    }else{
      message += `## 命中！${kills} 撃破！\n.\n`; //1撃破以上の場合
    }
    
    if (rankUp) message += `## 🔥大量撃破だ！！🔥 \n **新階級: ${player.rank}**へ昇格！ \n\n`;
    //自分の撃破数
    message += `-# >>> 🏅戦績\n-# >>> ${username} 階級:${player.rank} \n-# >>> 攻撃数: **${player.gekiha_counts}**回 \n-# >>> 撃破数: **${player.total_kills}** 撃破\n-# >>> -\n`
    //軍の総撃破数を表示
    message += `-# >>> :crossed_swords:  現在の戦況:\n-# >>> ${armyNameA}: 　総${totalKillsA} 撃破\n-# >>> ${armyNameB}: 総${totalKillsB} 撃破\n`;
    
     // メッセージ（ユーザーが入力したもの）
    if (customMessage) {
      message += ` \`\`\`${customMessage}\`\`\`\n`;
    }   

    
    await interaction.reply(message);
  } catch (error) {
    console.error('撃破処理エラー:', error);
    await interaction.reply('エラー: 撃破処理に失敗しました');
  }
}
