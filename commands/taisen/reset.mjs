import { SlashCommandBuilder } from 'discord.js';
import { User, GameState  } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('大戦データをリセットします');

export async function execute(interaction) {
  try {
    // プレイヤーデータ削除
    await User.destroy({ where: {} });

    // ルールデータ削除
    await GameState.destroy({ where: {} });
    
    // リセット後のデータ確認
    const usersAfterReset = await User.findAll();
    const gameStateAfterReset = await GameState.findAll();
    
    console.log("リセット後の User データ:", usersAfterReset);
    console.log("リセット後の GameState データ:", gameStateAfterReset);
    
    await interaction.reply('🔄 **大戦データをリセットしました！**\n新しい戦いを始める準備ができました。');
  } catch (error) {
    console.error('リセット処理エラー:', error);
    await interaction.reply('エラー: リセットに失敗しました');
  }
}
