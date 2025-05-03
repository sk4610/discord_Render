import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
    .setName('bob')
    .setDescription('支援兵士BOBを有効/無効にします')
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
    // 絵文字を追加する（カスタム絵文字IDは Discord中で\:emoji:と打ち込めば返る
    // 1350367513271341088 = 盾専
    const emoji = "<:custom_emoji:1350367513271341088>";
    GameState.bobEnabled = mode === 'on';
    await interaction.reply(
      GameState.bobEnabled
        ? `${emoji} 支援兵士BOBが大戦に **有効** しました。`
        : '🔴 BOB支援制度を **無効** にしました。'
    );
  }