import { SlashCommandBuilder } from 'discord.js';
import { Player, Rule } from '../models/game.mjs';

export const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('戦闘データをリセットします');

export async function execute(interaction) {
  try {
    await Player.destroy({ where: {} });
    await Rule.destroy({ where: {} });

    await interaction.reply('🔄 **戦闘データをリセットしました！**');
  } catch (error) {
    console.error('リセット処理エラー:', error);
    await interaction.reply('エラー: リセットに失敗しました');
  }
}
