import { SlashCommandBuilder } from 'discord.js';
import { GameState } from '../taisen/game.js';
import { armyNames } from './armyname.js';

export const data = new SlashCommandBuilder()
  .setName('setarmyname')
  .setDescription('軍名を設定します')
  .addStringOption(option =>
    option.setName('army_a')
      .setDescription('A軍の名前')
      .setRequired(true)
      .setMaxLength(20)
  )
  .addStringOption(option =>
    option.setName('army_b')
      .setDescription('B軍の名前')
      .setRequired(true)
      .setMaxLength(20)
  );

export async function execute(interaction) {
  try {
    const armyA = interaction.options.getString('army_a');
    const armyB = interaction.options.getString('army_b');

    // 入力値検証
    if (armyA.trim() === '' || armyB.trim() === '') {
      return await interaction.reply('軍名は空白にできません。');
    }

    if (armyA === armyB) {
      return await interaction.reply('A軍とB軍は異なる名前にしてください。');
    }

    // GameStateに軍名を保存/更新
    await GameState.upsert({ 
      id: 1,
      custom_army_a_name: armyA,
      custom_army_b_name: armyB
    });

    // 現在の設定を確認して表示
    const gameState = await GameState.findByPk(1);
    
    await interaction.reply(
      `🏷️ **軍名を設定しました！**\n` +
      `📋 **A軍**: ${gameState.custom_army_a_name}\n` +
      `📋 **B軍**: ${gameState.custom_army_b_name}\n\n` +
      `次回の大戦から新しい軍名が適用されます。`
    );

  } catch (error) {
    console.error('軍名設定エラー:', error);
    await interaction.reply('エラー: 軍名の設定に失敗しました');
  }
}