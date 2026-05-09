import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { GameState, User } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
  .setName('armybob')
  .setDescription('軍BOBシステムの設定（軍全体のNPC自動行動兵士）')
  .addStringOption(option =>
    option.setName('mode')
      .setDescription('on: 有効化 / off: 無効化')
      .setRequired(true)
      .addChoices(
        { name: 'on  （有効化）', value: 'on' },
        { name: 'off （無効化）', value: 'off' }
      )
  )
  .addIntegerOption(option =>
    option.setName('interval')
      .setDescription('BOBが行動する間隔（分）。デフォルト: 1分')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(1440)
  )
  .addIntegerOption(option =>
    option.setName('target')
      .setDescription('軍あたりの目標兵数（人間＋BOBの合計）。デフォルト: 5')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(20)
  )
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('BOBの行動ログを投稿するチャンネル（省略すると投稿なし）')
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText)
  );

export async function execute(interaction) {
  const mode = interaction.options.getString('mode');
  const interval = interaction.options.getInteger('interval');
  const target = interaction.options.getInteger('target');
  const channel = interaction.options.getChannel('channel');

  try {
    const gameState = await GameState.findByPk(1);
    if (!gameState) {
      return await interaction.reply('エラー: まず /rule でルールを設定してください。');
    }

    // 更新するフィールドをまとめる
    const updateData = { armybob_enabled: mode === 'on' };
    if (interval !== null) updateData.armybob_interval = interval;
    if (target !== null) updateData.armybob_target_size = target;
    if (channel !== null) updateData.armybob_channel_id = channel.id;

    await gameState.update(updateData);
    await gameState.reload();

    if (mode === 'on') {
      const currentInterval = gameState.armybob_interval;
      const currentTarget = gameState.armybob_target_size;
      const channelMention = gameState.armybob_channel_id
        ? `<#${gameState.armybob_channel_id}>`
        : '未設定（投稿なし）';

      // 現在の参加者数を表示
      const allUsers = await User.findAll();
      const humanA = allUsers.filter(u => u.army === 'A' && !u.id.startsWith('armybob-') && !u.id.startsWith('bob-')).length;
      const humanB = allUsers.filter(u => u.army === 'B' && !u.id.startsWith('armybob-') && !u.id.startsWith('bob-')).length;
      const bobCountA = Math.max(0, currentTarget - humanA);
      const bobCountB = Math.max(0, currentTarget - humanB);

      await interaction.reply(
        `✅ **軍BOBシステムを有効化しました！**\n` +
        `-# >>> ⏱️ 行動間隔: **${currentInterval}分**ごとに自動行動\n` +
        `-# >>> 👥 目標兵数: 軍あたり **${currentTarget}名**（人間＋BOB合計）\n` +
        `-# >>> 📢 ログチャンネル: ${channelMention}\n` +
        `-# >>> 🪖 A軍 現在: 人間 ${humanA}名 → BOB **${bobCountA}体** 配置予定\n` +
        `-# >>> 🪖 B軍 現在: 人間 ${humanB}名 → BOB **${bobCountB}体** 配置予定\n` +
        `-# >>> ※ 次の行動タイミングでBOBが自動配置されます`
      );
    } else {
      await interaction.reply('🔴 **軍BOBシステムを無効化しました。**\n-# >>> 次のリセットまでBOBは戦績に残ります。');
    }

  } catch (error) {
    console.error('軍BOB設定エラー:', error);
    await interaction.reply('エラー: 軍BOBの設定に失敗しました');
  }
}
