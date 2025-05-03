import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
    .setName('bob')
    .setDescription('あなたの支援兵士BOBを有効/無効にします')
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
    const userId = interaction.user.id;
    const mode = interaction.options.getString('mode');
    const user = await User.findOne({ where: { id: userId } });
    // 絵文字を追加する（カスタム絵文字IDは Discord中で\:emoji:と打ち込めば返る
    // 1350367513271341088 = 盾専
    const emoji = "<:custom_emoji:1350367513271341088>";
    
    if (!user) {
      return await interaction.reply('まず `/kaikyu` で所属軍を決めてからBOB支援制度を有効にしてください。');
    }
  
    //個別IDごとにBOBをON/OFFする
    if (mode === 'on') {
      user[0].bobEnabled = true;
      await user[0].save();
      await interaction.reply(`${emoji}あなたのBOB支援制度を **有効化** しました！`);
    } else if (mode === 'off') {
      user[0].bobEnabled = false;
      await user[0].save();
      await interaction.reply('🔴あなたのBOB支援制度を **無効化** しました。');
    } else {
      await interaction.reply('モードは `on` か `off` を指定してください。');
    }
  }

//    GameState.bobEnabled = mode === 'on';
//    await interaction.reply(
//      GameState.bobEnabled
//        ? `${emoji} 支援兵士BOBが大戦に **有効** しました。`
//        : '🔴 BOB支援制度を **無効** にしました。'
//    );
//  }