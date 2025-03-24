import { SlashCommandBuilder } from 'discord.js';
import { User } from '../taisen/game.js';
//import { getArmyName } from './kaikyu.mjs';


export const data = new SlashCommandBuilder()
  .setName('ranking')
  .setDescription('各軍の戦歴上位を公表します');

export async function execute(interaction) {
  try {
    // A軍の上位3名を取得
    const topA = await User.findAll({
      where: { army: 'A' },
      order: [['total_kills', 'DESC']],
      limit: 3
    });

    // B軍の上位3名を取得
    const topB = await User.findAll({
      where: { army: 'B' },
      order: [['total_kills', 'DESC']],
      limit: 3
    });

    // 表示用のメッセージを作成
    let message = '🏆 **ランキング - 上位3名** 🏆\n\n';

    message += '🔴 **A軍:**\n';
    topA.forEach((player, index) => {
      message += `${index + 1}. **${player.username}**（${player.rank}） - ${player.total_kills} 撃破\n`;
    });

    message += '\n🔵 **B軍:**\n';
    topB.forEach((player, index) => {
      message += `${index + 1}. **${player.username}**（${player.rank}） - ${player.total_kills} 撃破\n`;
    });

    // ランキングを送信
    await interaction.reply(message);
  } catch (error) {
    console.error('ランキング処理エラー:', error);
    await interaction.reply('エラー: ランキングの取得に失敗しました');
  }
}