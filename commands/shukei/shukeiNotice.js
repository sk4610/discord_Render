import { GameState } from '../taisen/game.js';
import { client } from '../main.mjs';

export async function sendEndShukei() {
  try {
    const gameData = await GameState.findOne({ where: { id: 1 } });
    if (!gameData || !gameData.notification_channel) {
      console.error('通知チャンネルが設定されていません。');
      return;
    }

    const channel = await client.channels.fetch(gameData.notification_channel);
    if (!channel) {
      console.error('通知チャンネルが見つかりません。');
      return;
    }

    const message = `📢 **ゲーム終了！** \n🏅 **A軍:** ${gameData.a_team_kills} 撃破\n🏅 **B軍:** ${gameData.b_team_kills} 撃破\n🎉 勝者: ${gameData.a_team_kills > gameData.b_team_kills ? 'A軍' : 'B軍'}`;
    await channel.send(message);
  } catch (error) {
    console.error('通知送信エラー:', error);
  }
}
