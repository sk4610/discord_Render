import { SlashCommandBuilder } from 'discord.js';
import { getArmyNames } from './armyname.js';

export const data = new SlashCommandBuilder()
  .setName('showarmyname')
  .setDescription('現在の軍名設定を表示します');

export async function execute(interaction) {
  try {
    const armyNames = await getArmyNames();
    
    await interaction.reply(
      `🏷️ **現在の軍名設定**\n\n` +
      `📋 **A軍**: ${armyNames.A}\n` +
      `📋 **B軍**: ${armyNames.B}\n\n` +
      `軍名を変更したい場合は \`/setarmyname\` コマンドを使用してください。`
    );

  } catch (error) {
    console.error('軍名表示エラー:', error);
    await interaction.reply('エラー: 軍名の取得に失敗しました');
  }
}