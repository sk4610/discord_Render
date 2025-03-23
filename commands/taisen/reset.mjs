import { SlashCommandBuilder } from 'discord.js';
import { User, GameState  } from '../taisen/game.mjs';

export const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('戦闘データをリセットします');

export async function execute(interaction) {
  try {
    // プレイヤーデータ削除
    await User.destroy({ where: {} });

    // ルールデータ削除
    await GameState.destroy({ where: {} });

    await interaction.reply('🔄 **戦闘データをリセットしました！**\n新しい戦いを始める準備ができました。');
  } catch (error) {
    console.error('リセット処理エラー:', error);
    await interaction.reply('エラー: リセットに失敗しました');
  }
}
