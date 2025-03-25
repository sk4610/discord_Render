import { SlashCommandBuilder } from 'discord.js';
import { User } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
  .setName('finish')
  .setDescription('終戦させることとして結果発表します');

export async function execute(interaction) {
  try {
    // A軍とB軍の総撃破数を取得
    const totalKillsA = await User.sum('total_kills', { where: { army: 'A' } }) || 0;
    const totalKillsB = await User.sum('total_kills', { where: { army: 'B' } }) || 0;

    // 勝敗判定
    let resultMessage = '🏆 **勝敗結果:** ';
    if (totalKillsA > totalKillsB) {
      resultMessage += '🎖 **A軍の勝利！** 🎉';
    } else if (totalKillsB > totalKillsA) {
      resultMessage += '🎖 **B軍の勝利！** 🎉';
    } else {
      resultMessage += '⚖ **引き分け！**';
    }

    // メッセージ作成
    const message = `📢 **戦闘終了！**\n📊 **最終撃破数:**\nA軍: **${totalKillsA}** 撃破\nB軍: **${totalKillsB}** 撃破\n\n${resultMessage}`;

    await interaction.reply(message);
  } catch (error) {
    console.error('戦闘終了処理エラー:', error);
    await interaction.reply('エラー: 結果の取得に失敗しました');
  }
}
