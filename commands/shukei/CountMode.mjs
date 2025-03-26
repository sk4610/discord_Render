import { SlashCommandBuilder } from 'discord.js';
import { GameState } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
  .setName('count')
  .setDescription('大戦の終戦方式を切り替えます')
  .addStringOption(option =>
    option.setName('mode')
      .setDescription('カウントモード (up/down)')
      .setRequired(true)
      .addChoices(
        { name: 'カウントアップ', value: 'up' },
        { name: 'カウントダウン', value: 'down' }
      )
  )
  .addIntegerOption(option =>
    option.setName('initial_hp')
      .setDescription('カウントダウン時の初期兵力（ダウン時のみ）')
      .setRequired(false)
  );

export async function execute(interaction) {
  const mode = interaction.options.getString('mode');
  const initialHP = interaction.options.getInteger('initial_hp');

  try {
    // ゲームの状態を取得
    let gameState = await GameState.findOne({ where: { id: 1 } });

    if (!gameState) {
      return await interaction.reply('エラー: ゲームの状態が見つかりません。');
    }

    if (mode === 'up') {
      // カウントアップ方式に変更
      gameState.countMode = 'up';
      gameState.initialArmyHP = null;
      await gameState.save();
      return await interaction.reply('大戦方式を **カウントアップ** に変更しました。');
    }

    if (mode === 'down') {
      // カウントダウン方式に変更
      if (!initialHP || initialHP <= 0) {
        return await interaction.reply('エラー: カウントダウン方式には正の初期兵力が必要です。');
      }
      gameState.countMode = 'down';
      gameState.initialArmyHP = initialHP;
      await gameState.save();
      return await interaction.reply(`大戦方式を **カウントダウン** に変更しました。（初期兵力: ${initialHP}）`);
    }

  } catch (error) {
    console.error('大戦方式の変更エラー:', error);
    await interaction.reply('エラー: 大戦方式の変更に失敗しました。');
  }
}
