import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { getArmyNames } from '../armyname/armyname.js';
import { BOB_TYPES } from './armyBobManager.mjs';

const BOB_EMOJI = "<:custom_emoji:1350367513271341088>";

export const data = new SlashCommandBuilder()
  .setName('armybob')
  .setDescription('軍BOBシステムの設定（軍全体のNPC自動行動兵士）')
  .addStringOption(option =>
    option.setName('mode')
      .setDescription('on: 有効化 / off: 無効化')
      .setRequired(true)
      .addChoices(
        { name: 'on      （有効化）',    value: 'on' },
        { name: 'off     （無効化）',    value: 'off' },
        { name: 'listbobs（BOB一覧）',   value: 'listbobs' },
        { name: 'settype （タイプ変更）', value: 'settype' }
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
  )
  .addStringOption(option =>
    option.setName('bobid')
      .setDescription('【settype用】変更するBOBのID（例: A-1, B-2）')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('type')
      .setDescription('【settype用】変更後の性格タイプ')
      .setRequired(false)
      .addChoices(
        { name: '猪突型🔥（火・雷を常に優先）',     value: 'assault' },
        { name: '守護型💧（水・回復を常に優先）',     value: 'guardian' },
        { name: '策士型🧠（戦局を読んで判断）',       value: 'tactician' },
        { name: '奇襲型⚡（敵コイン消去に特化）',     value: 'ambush' }
      )
  );

function getBobTypeFromSkillsData(bob) {
  try {
    const data = JSON.parse(bob.skills_data || '{}');
    return data.bobtype || 'tactician';
  } catch {
    return 'tactician';
  }
}

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

    // ─── listbobs：現在の軍BOB一覧とタイプを表示 ───
    if (mode === 'listbobs') {
      const armyNames = await getArmyNames();
      const allUsers = await User.findAll();
      const bobsA = allUsers.filter(u => u.id.startsWith('armybob-A-'));
      const bobsB = allUsers.filter(u => u.id.startsWith('armybob-B-'));

      const formatBobs = (bobs, armyKey) => {
        if (bobs.length === 0) return `-# 　（BOBなし）\n`;
        return bobs.map(b => {
          const typeKey = getBobTypeFromSkillsData(b);
          const typeInfo = BOB_TYPES[typeKey] || BOB_TYPES.tactician;
          const shortId = b.id.replace('armybob-', '');
          return `-# 　• **${b.username}**【${typeInfo.name}${typeInfo.emoji}】 ID:${shortId}　行動:${b.gekiha_counts}回 / 撃破:${b.total_kills}`;
        }).join('\n') + '\n';
      };

      let msg = `${BOB_EMOJI} **現在の軍BOB一覧**\n`;
      msg += `**🟡 ${armyNames.A}（A軍）**\n` + formatBobs(bobsA, 'A');
      msg += `**🟢 ${armyNames.B}（B軍）**\n` + formatBobs(bobsB, 'B');
      msg += `-# タイプ変更: \`/armybob mode:settype bobid:A-1 type:猪突型🔥\``;
      return await interaction.reply(msg);
    }

    // ─── settype：指定BOBの性格タイプを変更 ───
    if (mode === 'settype') {
      const bobidStr = interaction.options.getString('bobid');
      const newTypeKey = interaction.options.getString('type');

      if (!bobidStr || !newTypeKey) {
        return await interaction.reply('⚠️ settype には `bobid`（例: A-1）と `type` の両方を指定してください。\nBOB一覧は `/armybob mode:listbobs` で確認できます。');
      }

      const bobId = `armybob-${bobidStr}`;
      const bob = await User.findOne({ where: { id: bobId } });
      if (!bob) {
        return await interaction.reply(`⚠️ BOB「${bobId}」が見つかりません。\n/armybob mode:listbobs でIDを確認してください。`);
      }

      const oldTypeKey = getBobTypeFromSkillsData(bob);
      const oldTypeInfo = BOB_TYPES[oldTypeKey] || BOB_TYPES.tactician;
      const newTypeInfo = BOB_TYPES[newTypeKey] || BOB_TYPES.tactician;

      await bob.update({ skills_data: JSON.stringify({ bobtype: newTypeKey }) });

      return await interaction.reply(
        `✅ **${bob.username}** の性格タイプを変更しました！\n` +
        `-# >>> ${oldTypeInfo.name}${oldTypeInfo.emoji} → **${newTypeInfo.name}${newTypeInfo.emoji}**\n` +
        `-# >>> 次の行動から新しいタイプで動きます`
      );
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
