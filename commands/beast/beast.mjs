import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { armyNames } from '../armyname/armyname.js';
import { checkShusen } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
  .setName('beast')
  .setDescription('ビーストと共に戦います')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('ビーストの名前（初回のみ）')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName("message")
      .setDescription("一言添える")
      .setRequired(false)
  );

// ATK判定関数
function determineATK(lastDigit) {
  if ([0, 1, 2, 3].includes(lastDigit)) return 1;
  if ([4, 5, 6].includes(lastDigit)) return 2;
  if ([7, 8].includes(lastDigit)) return 3;
  if ([9].includes(lastDigit)) return 4;
}

// 行動判定関数
function processBeastAction(randomNum) {
  const lastTwoDigits = randomNum % 100;
  const secondDigit = Math.floor((randomNum % 100) / 10);
  const thirdDigit = randomNum % 10;
  const firstDigit = Math.floor(randomNum / 100);
  
  // 全桁ゾロ目チェック
  const isAllSame = (firstDigit === secondDigit && secondDigit === thirdDigit && randomNum !== 0);
  
  if (isAllSame) {
    return { type: 'beast_break', kills: 0, atkUp: 0, message: '** :right_facing_fist: :left_facing_fist: ビーストブレイク発動！ **' };
  } else if (lastTwoDigits % 10 === 0 && lastTwoDigits !== 0) {
    return { type: 'feed', kills: 0, atkUp: 1, message: '** 🍖 餌やり成功！ATK+1 **' };
  } else if (secondDigit === thirdDigit) {
    return { type: 'kill', kills: 1, atkUp: 0, message: '**  下2桁ゾロ目！1撃破 **' };
  } else {
    return { type: 'miss', kills: 0, atkUp: 0, message: 'ざんねん、0撃破…' };
  }
}

// ビーストブレイク処理
async function executeBeastBreak(playerArmy) {
  const enemyArmy = playerArmy === 'A' ? 'B' : 'A';
  
  // 敵軍の最高ATKを取得
  const maxAtkBeast = await User.findOne({
    where: { army: enemyArmy, beast_is_active: true },
    order: [['beast_atk', 'DESC']]
  });
  
  if (!maxAtkBeast) return '敵軍にアクティブなビーストがいません';
  
  const maxAtk = maxAtkBeast.beast_atk;
  
  // 該当ビーストを全て戦闘不能に
  const affectedBeasts = await User.findAll({
    where: { army: enemyArmy, beast_atk: maxAtk, beast_is_active: true }
  });
  
  await User.update(
    { beast_is_active: false },
    { where: { army: enemyArmy, beast_atk: maxAtk, beast_is_active: true }}
  );
  
  const beastNames = affectedBeasts.map(b => b.beast_name || 'unnamed').join(', ');
  return ` 🌟 ${armyNames[enemyArmy]}のATK${maxAtk}ビースト（${beastNames}）を全て戦闘不能にした！`;
}

// 決闘システム（見やすい表示に改善）
async function executeBeastDuel(interaction) {
  const gameState = await GameState.findOne();
  const totalActions = await User.sum('gekiha_counts');
  const currentRound = Math.floor(totalActions / gameState.duel_interval);
  
  // アクティブなビーストを取得（餌やり制限を廃止）
  const eligibleBeasts = await User.findAll({
    //where: { beast_has_fed: true, beast_is_active: true },
    where: { beast_is_active: true }, 
    order: [['last_action_time', 'DESC']]
  });
  
  const armyA = eligibleBeasts.filter(b => b.army === 'A');
  const armyB = eligibleBeasts.filter(b => b.army === 'B');
  
  let duelMessage = ` ## 🏟️ 第${currentRound + 1}回 ビースト決闘開始！ \n`;
  duelMessage += `-# 決闘開始！⭕なら勝利, ❌なら敗北, ❗なら相打ち, ⭐なら直接攻撃だ！\n\n⚔️ **決闘**\n`;
  
  const minLength = Math.min(armyA.length, armyB.length);
  let totalDamageA = 0;
  let totalDamageB = 0;
  
  // 現在の兵力（決闘前）
  const aHP_before = gameState.initialArmyHP - gameState.b_team_kills;
  const bHP_before = gameState.initialArmyHP - gameState.a_team_kills;
  
  // 1vs1マッチング
  for (let i = 0; i < minLength; i++) {
    const beastA = armyA[i];
    const beastB = armyB[i];
    
    // ユーザー名を取得
    const ownerA = beastA.username;
    const ownerB = beastB.username;
    
    let result;
    if (beastA.beast_atk > beastB.beast_atk) {
      const damage = beastA.beast_atk - beastB.beast_atk;
      totalDamageB += damage;
      beastB.beast_is_active = false;
      await beastB.save();
      result = `⭕ :dragon_face: ${beastA.beast_name || 'Unnamed'}(ATK${beastA.beast_atk})  vs  :dragon_face: ${beastB.beast_name || 'Unnamed'}(ATK${beastB.beast_atk}) ❌ → ${armyNames.A}勝利! ${damage}撃破!`;
    } else if (beastB.beast_atk > beastA.beast_atk) {
      const damage = beastB.beast_atk - beastA.beast_atk;
      totalDamageA += damage;
      beastA.beast_is_active = false;
      await beastA.save();
      result = `❌ :dragon_face: ${beastA.beast_name || 'Unnamed'}(ATK${beastA.beast_atk})  vs  :dragon_face: ${beastB.beast_name || 'Unnamed'}(ATK${beastB.beast_atk}) ⭕ → ${armyNames.B}勝利! ${damage}撃破!`;
    } else {
      beastA.beast_is_active = false;
      beastB.beast_is_active = false;
      await beastA.save();
      await beastB.save();
      result = `❗ :dragon_face: ${beastA.beast_name || 'Unnamed'}(ATK${beastA.beast_atk})  vs  :dragon_face: ${beastB.beast_name || 'Unnamed'}(ATK${beastB.beast_atk}) ❗ → 相打ち！`;
    }
    
    duelMessage += result + '\n';
  }
  
  // 余ったビーストの処理
  const remainingA = armyA.slice(minLength);
  const remainingB = armyB.slice(minLength);
  
  for (const beast of remainingA) {
    totalDamageB += beast.beast_atk;
    const owner = beast.username;
    duelMessage += `⭐ ${beast.beast_name || 'Unnamed'}(ATK${beast.beast_atk}) → ${armyNames.B}へ${beast.beast_atk}ダメージ\n`;
  }
  
  for (const beast of remainingB) {
    totalDamageA += beast.beast_atk;
    const owner = beast.username;
    duelMessage += `⭐ ${beast.beast_name || 'Unnamed'}(ATK${beast.beast_atk}) → ${armyNames.A}へ${beast.beast_atk}ダメージ\n`;
  }
  
  // ダメージ適用
  if (totalDamageA > 0) {
    gameState.b_team_kills += totalDamageA;
  }
  if (totalDamageB > 0) {
    gameState.a_team_kills += totalDamageB;
  }
  
  await gameState.save();
  
  // 決闘後の兵力
  const aHP_after = gameState.initialArmyHP - gameState.b_team_kills;
  const bHP_after = gameState.initialArmyHP - gameState.a_team_kills;
  
  // 決闘結果サマリー
  duelMessage += `\n**・決闘結果**\n`;
  duelMessage += `${armyNames.A}への被害: ${totalDamageA}\n`;
  duelMessage += `${armyNames.B}への被害: ${totalDamageB}\n\n`;
  duelMessage += `【 ${armyNames.A} 兵力】${aHP_before}⇒${aHP_after}\n`;
  duelMessage += `【 ${armyNames.B} 兵力】${bHP_before}⇒${bHP_after}\n`;
  
  // 通知フラグリセット
  await gameState.update({
    last_duel_round: currentRound,
    notification_90_sent: false,
    notification_75_sent: false,
    notification_50_sent: false,
    notification_25_sent: false,
    notification_10_sent: false,
  });
  
  await interaction.followUp(duelMessage);
}

// 決闘カウントダウン通知
async function manageDuelNotifications(interaction) {
  const gameState = await GameState.findOne();
  const totalActions = await User.sum('gekiha_counts');
  const nextDuel = Math.ceil(totalActions / gameState.duel_interval) * gameState.duel_interval;
  const remaining = nextDuel - totalActions;
  
  const notifications = [
    { remaining: 90, flag: 'notification_90_sent', message: ' ### 🚨【自動警報】🚨 ビースト決闘まで 残り__90レス__！\n ビーストを鍛え育てよ…' },
    { remaining: 75, flag: 'notification_75_sent', message: ' ### 🚨【自動警報】🚨 ビースト決闘まで 残り__75レス__！\n 準備を始めよ…' },
    { remaining: 50, flag: 'notification_50_sent', message: ' ### 🚨【自動警報】🚨 ビースト決闘まで 残り__50レス__！\n 戦いのときは近い…' },
    { remaining: 25, flag: 'notification_25_sent', message: ' ### 🚨【自動警報】🚨 ビースト決闘まで 残り__25レス__！\n 覚悟を決めよ！' },
    { remaining: 10, flag: 'notification_10_sent', message: ' ### 🚨【自動警報】🚨 ビースト決闘まで 残り__10レス__！\n ビーストを信じろ！' }
  ];
  
  for (const notif of notifications) {
    if (remaining <= notif.remaining && !gameState[notif.flag]) {
      await interaction.followUp(notif.message);
      await gameState.update({ [notif.flag]: true });
      break;
    }
  }
  
  if (remaining === 0) {
    await executeBeastDuel(interaction);
  }
}

export async function execute(interaction) {
  //try {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const username = interaction.member.displayName;
  const player = await User.findOne({ where: { id: userId } });
  const beastName = interaction.options.getString('name') || null;
  const customMessage = interaction.options.getString("message") || "";
  
  if (!player) {
    return await interaction.editReply('まず /start でチームに参加してください。');
  }

  const army = player.army;
  const gameState = await GameState.findOne();
  
  if (gameState.rule_type !== 'beast') {
    return await interaction.editReply('現在はビースト制ルールではありません。');
  }

  if (gameState.isGameOver) {
    return await interaction.editReply("大戦はすでに終戦した！次回の号砲を待て！");
  }
  
  // ジャッジナンバー生成
  const randomNum = Math.floor(Math.random() * 1000);
  const randomStr = randomNum.toString().padStart(3, '0');
  const lastDigit = randomNum % 10;
  
  let message = `-#  :military_helmet: ${armyNames[army]} ${username} の行動判定！\n`;
  message += `** :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${randomStr}__**`;
  
  // ビースト初期化 or 復活
  let isNewBeast = false;
  if (!player.beast_name || !player.beast_is_active) {
    // 戦闘不能からの復活時は名前を必須にする
    if (player.beast_name && !player.beast_is_active && !beastName) {
      return interaction.editReply(`:angel: あなたのビースト **${player.beast_name}** は戦闘不能です。\n🐾 新しいビーストを召喚するには名前を指定してください。\n\n使用例: \`/beast name:フェニックス\``);
    }
    
    // 完全に初回の場合も名前を推奨
    if (!player.beast_name && !beastName) {
      return interaction.editReply(`🐾 初回のビースト召喚です！\n✨ ビーストに名前を付けてあげてください。\n\n使用例: \`/beast name:ドラゴン\``);
    }
    
    const newATK = determineATK(lastDigit);
    const finalBeastName = beastName;
    
    await player.update({
      beast_name: finalBeastName,
      beast_atk: newATK,
      beast_is_active: true,
      beast_has_fed: false,
      last_action_time: new Date()
    });

    isNewBeast = true;
    
    if (player.beast_name && !player.beast_is_active) {
      // 復活メッセージ
      message += `\n** :dragon_face:  新しいビースト **"${finalBeastName}"** が復活！ATK: ${newATK}\n`;
      message += `\n** :angel: 前のビースト **"${player.beast_name}"** は戦闘不能でした\n`;
    } else {
      // 初回メッセージ
      message += `\n :dragon_face:  初のビースト **"${finalBeastName}"** が誕生！ATK: ${newATK}\n`;
    }
  } 
  //else {
    // 行動判定（初回/復活時も含めて常に実行）
    const action = processBeastAction(randomNum);
    if (!isNewBeast) {
      message += ` → ${action.message}\n`;
    } else {
      message += ` → さらに ${action.message}\n`;
    }   
    let kills = action.kills;
    let breakResult = '';
    
    // ビーストブレイク処理
    if (action.type === 'beast_break') {
      breakResult = await executeBeastBreak(army);
      message += `** ${breakResult}**\n`;
    }
    
    // ATKアップ処理（修正：変化前の値を保存）
    if (action.atkUp > 0) {
      const oldATK = player.beast_atk; // 変化前の値を保存
      const newATK = oldATK + action.atkUp;
      await player.update({ 
        beast_atk: newATK,
        beast_has_fed: true 
      });
      message += ` :up: "${player.beast_name}" のATKが **${oldATK} → ${newATK}** にアップ！\n`;
    }
    
    // 撃破処理
    if (kills > 0) {
      if (army === 'A') {
        gameState.a_team_kills += kills;
      } else {
        gameState.b_team_kills += kills;
      }
      
      player.total_kills += kills;
      //message += `### ⚔️ 敵軍に ${kills} ダメージ！\n`;
    }
    
    await player.update({ last_action_time: new Date() });
  //}
  
  // 行動回数更新
  player.gekiha_counts += 1;
  await player.save();
  await gameState.save();
  
  // 決闘カウント表示（常時表示）
  const totalActions = await User.sum('gekiha_counts');
  const nextDuel = Math.ceil(totalActions / gameState.duel_interval) * gameState.duel_interval;
  const remaining = nextDuel - totalActions;
  
//  if (remaining > 0) {
//    message += `-# >>> ⚔️ 次回ビースト決闘まで: **${remaining}行動**\n`;
//  }
  
  // 個人ビースト情報（常時表示）
  message += `-# >>> :dragon_face: あなたのビースト: **${player.beast_name}** (ATK: ${player.beast_atk})`;
  if (!player.beast_is_active) {
    message += ` :angel: 戦闘不能`;
  } 

  message += `\n`;
  
  // 撃破時のみ表示する情報
  //const action = processBeastAction(randomNum);
  if (kills > 0) {
    // 戦況表示（撃破時のみ）
    const aHP = gameState.initialArmyHP - gameState.b_team_kills;
    const bHP = gameState.initialArmyHP - gameState.a_team_kills;
    message += `-# >>> :crossed_swords: 現在の戦況: ${armyNames.A} ${aHP} vs ${armyNames.B} ${bHP}\n`;
    
    // 戦績表示（撃破時のみ）
    message += `-# >>> 🏅戦績: ${armyNames[army]} ${username} 行動数: **${player.gekiha_counts}回** 撃破数: **${player.total_kills}撃破**\n`;
  }
  
  // カスタムメッセージ
  if (customMessage) {
    message += `\`\`\`${customMessage}\`\`\`\n`;
  }
  
  await interaction.editReply(message);
  

// BOB支援制度（ビースト制対応）
if (player.bobEnabled) {
const bobId = `bob-${userId}`;
let  bobUser = await User.findOne({ where: { id: bobId } });

// BOBユーザーが存在しない場合は作成	if (bobUser) {
if (!bobUser) {	
const bobname = `BOB - ${username}のパートナー`;	
bobUser = await User.create({	
id: bobId,	
username: bobname,	
army: army,	
rank: '二等兵🔸', // デフォルト階級	
total_kills: 0,	
beast_name: null,	
beast_atk: 0,	
beast_is_active: false,	
beast_has_fed: false,	
last_action_time: null	
});	
console.log('BOBユーザーを新規作成:', bobname);	
}


if (bobUser) {
// BOB用のジャッジナンバー生成
const bobRandomNum = Math.floor(Math.random() * 1000);
const bobRandomStr = bobRandomNum.toString().padStart(3, '0');
const bobLastDigit = bobRandomNum % 10;
let bobMessage = `-# **BOB支援制度**が発動！\n`;
const emoji = "<:custom_emoji:1350367513271341088>";
bobMessage += `-# ${emoji} ${armyNames[army]} ${bobUser.username} の行動判定！\n`;
bobMessage += `** :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${bobRandomStr}__**`;
// BOBビースト初期化 or 復活
let isBobNewBeast = false;
if (!bobUser.beast_name || !bobUser.beast_is_active) {
const bobNewATK = determineATK(bobLastDigit);
const bobBeastName = `BOB-${bobUser.username.replace('BOB - ', '').split('のパートナー')[0]}の相棒`;
await bobUser.update({
beast_name: bobBeastName,
beast_atk: bobNewATK,
beast_is_active: true,
beast_has_fed: false,
last_action_time: new Date()
});
isBobNewBeast = true;
bobMessage += `\n :dragon_face: BOBの新ビースト **${bobBeastName}** が誕生！ATK: ${bobNewATK}\n`;
}
// BOB行動判定
const bobAction = processBeastAction(bobRandomNum);
if (!isBobNewBeast) {
bobMessage += ` → ${bobAction.message}\n`;
} else {
bobMessage += ` → さらに ${bobAction.message}\n`;
}
let bobKills = bobAction.kills;
// BOBビーストブレイク処理
if (bobAction.type === 'beast_break') {
const bobBreakResult = await executeBeastBreak(army);
bobMessage += `** ${bobBreakResult}**\n`;
}
// BOB ATKアップ処理
if (bobAction.atkUp > 0) {
const bobOldATK = bobUser.beast_atk;
const bobNewATK = bobOldATK + bobAction.atkUp;
await bobUser.update({
beast_atk: bobNewATK,
beast_has_fed: true
});
bobMessage += ` :up: " ${bobUser.beast_name}" のATKが** ${bobOldATK} → ${bobNewATK} **にアップ！\n`;
}
// BOB撃破処理
if (bobKills > 0) {
if (army === 'A') {
gameState.a_team_kills += bobKills;
} else {
gameState.b_team_kills += bobKills;
}
bobUser.total_kills += bobKills;
//bobMessage += `### ⚔️ 敵軍に ${bobKills} ダメージ！\n`;
}
// BOB行動回数更新
bobUser.gekiha_counts += 1;
await bobUser.update({ last_action_time: new Date() });
await bobUser.save();
await gameState.save();
// BOB決闘カウント表示（常時表示）
const bobTotalActions = await User.sum('gekiha_counts');
const bobNextDuel = Math.ceil(bobTotalActions / gameState.duel_interval) * gameState.duel_interval;
const bobRemaining = bobNextDuel - bobTotalActions;
//if (bobRemaining > 0) {
//bobMessage += `-# >>> ⚔️ 次回ビースト決闘まで: **${bobRemaining}行動**\n`;
//}

// BOBビースト情報（常時表示）
bobMessage += `-# >>> :dragon_face: BOBのビースト: **${bobUser.beast_name}** (ATK: ${bobUser.beast_atk})`;
if (!bobUser.beast_is_active) {
bobMessage += ` :angel: 戦闘不能`;
}
bobMessage += `\n`;
// BOB撃破時のみ表示する情報
if (bobKills > 0) {
// 戦況表示（撃破時のみ）
const aHP = gameState.initialArmyHP - gameState.b_team_kills;
const bHP = gameState.initialArmyHP - gameState.a_team_kills;
bobMessage += `-# >>> :crossed_swords: 現在の戦況: ${armyNames.A} ${aHP} vs ${armyNames.B} ${bHP}\n`;
// 戦績表示（撃破時のみ）
bobMessage += `-# >>> 🏅戦績: ${armyNames[army]} ${bobUser.username} 行動数: **${bobUser.gekiha_counts}回** 撃破数: **${bobUser.total_kills}撃破**\n`;
}
await interaction.followUp(bobMessage);
}
}



  // 決闘通知チェック
  await manageDuelNotifications(interaction);
  
  // 終戦判定
  const loserTeam = await checkShusen();
  if (loserTeam) {
    const gameState = await GameState.findOne({ where: { id: 1 } });
    const totalKillsA = gameState.a_team_kills;
    const totalKillsB = gameState.b_team_kills;
    const remainingHP_A = gameState.initialArmyHP - totalKillsB;
    const remainingHP_B = gameState.initialArmyHP - totalKillsA;
    const winnerTeam = loserTeam === armyNames.A ? armyNames.B : armyNames.A;
    
    await interaction.followUp(`** 📢 ${loserTeam}の兵力が0になった。**\n# 🎖 ${winnerTeam}の勝利だ！\n\n🏆 大戦結果:\n 【${armyNames.A}の残存兵力】${remainingHP_A} \n 【${armyNames.B}の残存兵力】${remainingHP_B}\n\n**今次大戦は終戦した！次の大戦でまた会おう！**`);
    return;
  }

  return;
}