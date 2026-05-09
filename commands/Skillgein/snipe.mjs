import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { getArmyNames } from '../armyname/armyname.js';

export const data = new SlashCommandBuilder()
  .setName('snipe')
  .setDescription('技能習得制：狙撃ポイントを消費して敵軍兵士の技能を全て封じる')
  .addStringOption(option =>
    option.setName('target')
      .setDescription('狙撃する敵軍兵士の名前')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const username = interaction.member.displayName;
  const targetName = interaction.options.getString('target');

  const player = await User.findOne({ where: { id: userId } });
  if (!player) {
    return await interaction.editReply('まず /start でチームに参加してください。');
  }

  const gameState = await GameState.findOne();
  const armyNames = await getArmyNames();

  if (gameState.rule_type !== 'skillgein') {
    return await interaction.editReply('現在は技能習得制ルールではありません。');
  }
  if (gameState.isGameOver) {
    return await interaction.editReply('大戦はすでに終戦した！次回の号砲を待て！');
  }

  // 狙撃ポイント確認
  const currentSnipe = player.skill_snipe ?? 0;
  if (currentSnipe < 1) {
    return await interaction.editReply(
      `❌ 狙撃ポイントが足りません。（現在: **0**）\n/action でジャッジナンバー00を出すと狙撃ポイントが増えます。`
    );
  }

  // 自分自身は狙撃できない
  if (targetName === username) {
    return await interaction.editReply('❌ 自分自身を狙撃することはできません。');
  }

  // ターゲット検索（敵軍のみ）
  const enemyArmy = player.army === 'A' ? 'B' : 'A';
  const target = await User.findOne({ where: { username: targetName, army: enemyArmy } });

  if (!target) {
    return await interaction.editReply(
      `❌ 敵軍に「**${targetName}**」という兵士が見つかりません。\n名前を正確に入力してください。`
    );
  }

  // 狙撃前のステータスを保存
  const oldAtk = target.skill_atk ?? 1;
  const oldMagic = target.skill_magic ?? 1;
  const oldSpirit = target.skill_spirit ?? 1;
  let oldSkills = [];
  try {
    oldSkills = JSON.parse(target.skills_data || '[]');
  } catch {
    oldSkills = [];
  }

  // 狙撃実行: ターゲットのステータスをリセット
  await target.update({
    skill_atk: 1,
    skill_magic: 1,
    skill_spirit: 1,
    skills_data: '[]',
  });

  // 狙撃ポイント消費
  await player.update({ skill_snipe: currentSnipe - 1 });

  // ─── メッセージ構築 ─────────────────────────────────────────
  let message = `### 🎯 ${armyNames[player.army]} **${username}** の狙撃！\n\n`;
  message += `💥 **${armyNames[enemyArmy]} ${targetName}** を狙撃した！\n\n`;
  message += `**〔被狙撃効果〕**\n`;

  const statChanged =
    oldAtk !== 1 || oldMagic !== 1 || oldSpirit !== 1;

  message += `攻撃: **${oldAtk}** → **1**\n`;
  message += `魔力: **${oldMagic}** → **1**\n`;
  message += `精神: **${oldSpirit}** → **1**\n`;

  if (oldSkills.length > 0) {
    message += `\n**〔喪失した技能（${oldSkills.length}個）〕**\n`;
    for (const skill of oldSkills) {
      message += `> 【${skill.name}】 威力${skill.power}\n`;
    }
  } else {
    message += `技能: なし（喪失なし）\n`;
  }

  message += `\n-# 残り狙撃ポイント（${username}）: **${currentSnipe - 1}**`;

  await interaction.editReply(message);
}
