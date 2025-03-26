import { SlashCommandBuilder } from "discord.js";
import { gameState } from "../taisen/gekiha.js";

export const data = new SlashCommandBuilder()
  .setName("shukeiChannel")
  .setDescription("通知用のチャンネルを設定します（管理者のみ）")
  .addChannelOption(option =>
    option
      .setName("channel")
      .setDescription("通知を送信するチャンネル")
      .setRequired(true)
  );

export async function execute(interaction) {
  // 管理者権限のチェック
  if (!interaction.member.permissions.has("ADMINISTRATOR")) {
    await interaction.reply({ content: "このコマンドは管理者のみ使用できます。", ephemeral: true });
    return;
  }

  const channel = interaction.options.getChannel("channel");
  gameState.notificationChannelId = channel.id;

  await interaction.reply(`📢 集計通知用チャンネルを <#${channel.id}> に設定しました！`);
}