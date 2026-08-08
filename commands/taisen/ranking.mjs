import { SlashCommandBuilder } from 'discord.js';
import { User, GameState } from '../taisen/game.js';
import { getArmyNames } from '../armyname/armyname.js';

const BOB_EMOJI = '<:custom_emoji:1350367513271341088>';

// BOBの種別判定
function bobKind(id) {
  if (id.startsWith('armybob-')) return 'army';   // 軍BOB
  if (id.startsWith('bob-')) return 'personal';   // 個人BOB
  return null;                                    // 人間
}


export const data = new SlashCommandBuilder()
  .setName('ranking')
  .setDescription('各軍の戦歴上位を公表します');

export async function execute(interaction) {
  try {
    const { guild } = interaction; // サーバー情報を取得
    
    // A軍の上位3名を取得
    const topA = await User.findAll({
      where: { army: 'A' },
      order: [['total_kills', 'DESC']],
      limit: 3
    });

    // B軍の上位3名を取得
    const topB = await User.findAll({
      where: { army: 'B' },
      order: [['total_kills', 'DESC']],
      limit: 3
    });

    // 表示名を取得（BOBはDiscordユーザーではないのでDBのusernameを使う）
    async function getDisplayName(guild, player) {
      const kind = bobKind(player.id);
      if (kind === 'army')     return `${BOB_EMOJI} ${player.username}`;
      if (kind === 'personal') return `${BOB_EMOJI} ${player.username}`;
      try {
        const member = await guild.members.fetch(player.id);
        return member.displayName;
      } catch {
        // 退出済みなどで取得できない場合はDBに残っている名前で代替
        return player.username || '不明なユーザー';
      }
    }

    //アクティブ兵士数のカウント
    const uniquePlayersA = await User.count({ where: { army: 'A' } });
    const uniquePlayersB = await User.count({ where: { army: 'B' } });
    const totalUniquePlayers = uniquePlayersA + uniquePlayersB;
    
    // **レス（行動回数）の取得**
    const totalActionsA = await User.sum('gekiha_counts', { where: { army: 'A' } }) || 0;
    const totalActionsB = await User.sum('gekiha_counts', { where: { army: 'B' } }) || 0;
    const totalActions = totalActionsA + totalActionsB;
    
    // A軍とB軍の名前を取得（カスタム軍名に対応）
    const armyNames = await getArmyNames();
    const armyNameA = armyNames.A;
    const armyNameB = armyNames.B;

    // 階級は階級制のときだけ意味を持つ
    const gameState = await GameState.findByPk(1);
    const showRank = gameState && gameState.rule_type === 'ranked';

    // 人間 / BOB の内訳
    const allUsers = await User.findAll();
    const countBy = (army, pred) => allUsers.filter(u => u.army === army && pred(u)).length;
    const humansA  = countBy('A', u => !bobKind(u.id));
    const humansB  = countBy('B', u => !bobKind(u.id));
    const armyBobA = countBy('A', u => bobKind(u.id) === 'army');
    const armyBobB = countBy('B', u => bobKind(u.id) === 'army');
    const persBobA = countBy('A', u => bobKind(u.id) === 'personal');
    const persBobB = countBy('B', u => bobKind(u.id) === 'personal');

    // ランキング表示用のメッセージを作成
    let message = '🏆 **戦績ランキング (上位3名)** 🏆\n\n';

    const renderRow = async (player) => {
      const name = await getDisplayName(guild, player);
      const rankPart = showRank ? `（${player.rank}）` : '';
      return `**${name}**${rankPart} - ${player.total_kills} 撃破\n`;
    };

    // A軍表示
    message += `:yellow_circle:  **${armyNameA}:**\n`;
    for (const player of topA) message += await renderRow(player);
    if (topA.length === 0) message += `-# （まだ参加者がいません）\n`;

    // B軍表示
    message += `\n:green_circle:  **${armyNameB}:**\n`;
    for (const player of topB) message += await renderRow(player);
    if (topB.length === 0) message += `-# （まだ参加者がいません）\n`;

    // **追加情報**
    message += `\n\n 📊 **戦況データ:**\n`;
    message += `・総ID数: **${totalUniquePlayers}**\n　${armyNameA} : ${armyNameB} = ${uniquePlayersA} : ${uniquePlayersB}\n`;
    message += `　└ 内訳 ${armyNameA} 人間${humansA} / ${BOB_EMOJI}軍BOB${armyBobA} / 個人BOB${persBobA}\n`;
    message += `　└ 内訳 ${armyNameB} 人間${humansB} / ${BOB_EMOJI}軍BOB${armyBobB} / 個人BOB${persBobB}\n`;
    message += `・総合計 **${totalActions}** レス（攻撃回数）\n　${armyNameA} : ${armyNameB} = ${totalActionsA} : ${totalActionsB}`;

    
    // ランキングを送信
    await interaction.reply(message);
  } catch (error) {
    console.error('ランキング処理エラー:', error);
    await interaction.reply('エラー: ランキングの取得に失敗しました');
  }
}