import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("say")
  .setDescription("指定したメッセージを送信します")
  .addStringOption(option =>
    option.setName("message")
      .setDescription("送信するメッセージ")
      .setRequired(true)
  );

export async function execute(interaction) {
  const message = interaction.options.getString("message");
  await interaction.reply(message);
}
