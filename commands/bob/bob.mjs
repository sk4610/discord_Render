import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bob')
    .setDescription('BOB支援制度の有効/無効を切り替えます')
    .addStringOption(option =>
      option
        .setName('mode')
        .setDescription('on で有効化、off で無効化')
        .setRequired(true)
        .addChoices(
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' }
        )
    ),

  async execute(interaction) {
    const mode = interaction.options.getString('mode');

    // 有効・無効の状態を保存
    if (mode === 'on') {
      GameState.bobEnabled = true;
      await interaction.reply('🟢 BOB支援制度を **有効** にしました。');
    } else {
      GameState.bobEnabled = false;
      await interaction.reply('🔴 BOB支援制度を **無効** にしました。');
    }
  }
};