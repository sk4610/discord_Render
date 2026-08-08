import { checkAutoStatus } from '../commands/taisen/autostatus.mjs';

export default async(interaction) => {
  if (!interaction.isChatInputCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`「${interaction.commandName}」コマンドは見つかりませんでした。`);
		return;
	}

	try {
		await command.execute(interaction);
		// どのコマンドでも行動後に戦況の自動表示を判定する
		// （内部で例外を処理するのでコマンド本体には影響しない）
		await checkAutoStatus(interaction.client);
	} catch (error) {
  console.error(error);
  if (interaction.deferred) {
    await interaction.editReply('コマンド実行中にエラーが発生しました。');
  } else if (interaction.replied) {
    await interaction.followUp({ content: 'コマンド実行中にエラーが発生しました。', ephemeral: true });
  } else {
    await interaction.reply({ content: 'コマンド実行中にエラーが発生しました。', ephemeral: true });
  }
}
};
