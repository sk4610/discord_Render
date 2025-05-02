import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
    .setName('bob')
    .setDescription('BOB支援制度を有効/無効にします')
    .addStringOption(option =>
      option
        .setName('mode')
        .setDescription('onで有効、offで無効')
        .setRequired(true)
        .addChoices(
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' }
        )
    );

export async function execute(interaction) {
    const mode = interaction.options.getString('mode');
    GameState.bobEnabled = mode === 'on';
    await interaction.reply(
      GameState.bobEnabled
        ? '🟢 BOB支援制度を **有効** にしました。'
        : '🔴 BOB支援制度を **無効** にしました。'
    );
  }