import { gameState } from '../taisen/gekiha.js';  // ローカルゲーム状態をインポート


export async function sendEndShukei(client, message) {
  if (!gameState.notificationChannelId) {
    console.log("通知チャンネルが設定されていません。");
    return;
  }

  const channel = await client.channels.fetch(gameState.notificationChannelId);
  if (!channel) {
    console.error("通知チャンネルが見つかりません。");
    return;
  }

  await channel.send(message);  // 通知メッセージを送信
}