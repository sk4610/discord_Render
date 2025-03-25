import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { getArmyName } from './kaikyu.mjs';
import { kaikyu_main } from './kaikyu_main.js';

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

// 現在のルールを取得する関数
async function getGameRule() {
  const gameState = await GameState.findOne({ where: { id: 1 } }); // ゲームの状態を取得
  return gameState ? gameState.rule_type : null;
}

export async function execute(interaction) {
  const userId = interaction.user.id;
  const username = interaction.member.displayName;
  const customMessage = interaction.options.getString("message") || ""; // メッセージ取得（デフォルトは空）

  
    
  try {
    const rule_type = await getGameRule(); // Sequelizeからルールを取得

    if (!rule_type) {
      return await interaction.reply('エラー: ルールが設定されていません。まず /rule でルールを決めてください。');
    }
    
    if (rule_type === 'ranked') {
      // **階級制の処理**
      await kaikyu_main(interaction);
    }else {
      await interaction.reply('エラー: 未知のルール「${rule_type}」です。');
    } 
  }catch (error) {
      console.error('撃破処理エラー:', error);
      await interaction.reply('エラー: 撃破処理に失敗しました');
  }
}
