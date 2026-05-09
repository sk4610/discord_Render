import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { getArmyNames } from '../armyname/armyname.js';

// ─── 技能マスターデータ ───────────────────────────────────────
const SKILL_MAP = {
  10: 'バンブーランス',
  20: 'マッシュラッシュ',
  30: 'アチアチファイア',
  40: 'ネクロマンシー',
  50: 'キュンキュア',
  60: 'モギモギヘルス',
  70: 'アタックアップ',
  80: 'マジックアップ',
  90: 'メンタルアップ',
};

// 威力抽選: 52%→1 / 27%→2 / 14%→4 / 7%→8
function rollPower() {
  const r = Math.random() * 100;
  if (r < 52) return 1;
  if (r < 79) return 2;
  if (r < 93) return 4;
  return 8;
}

// アチアチファイア倍率抽選: 40%→1倍 / 30%→2倍 / 20%→3倍 / 10%→4倍
function rollFireMultiplier() {
  const r = Math.random() * 100;
  if (r < 40) return 1;
  if (r < 70) return 2;
  if (r < 90) return 3;
  return 4;
}

// ─── コマンド定義 ──────────────────────────────────────────────
export const data = new SlashCommandBuilder()
  .setName('action')
  .setDescription('技能習得制：行動する（00〜99の乱数を生成）');

// ─── コマンド実行 ──────────────────────────────────────────────
export async function execute(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const username = interaction.member.displayName;
  const player = await User.findOne({ where: { id: userId } });

  if (!player) {
    return await interaction.editReply('まず /start でチームに参加してください。');
  }

  const gameState = await GameState.findOne();
  const armyNames = await getArmyNames();

  if (gameState.rule_type !== 'skill') {
    return await interaction.editReply('現在は技能習得制ルールではありません。');
  }
  if (gameState.isGameOver) {
    return await interaction.editReply('大戦はすでに終戦した！次回の号砲を待て！');
  }

  const army = player.army;
  const initialHP = gameState.initialArmyHP;

  // 現在の兵力
  const armyA_HP = initialHP - gameState.b_team_kills;
  const armyB_HP = initialHP - gameState.a_team_kills;
  const myHP = army === 'A' ? armyA_HP : armyB_HP;
  const enemyHP = army === 'A' ? armyB_HP : armyA_HP;

  // 乱数生成 (00〜99)
  const randomNum = Math.floor(Math.random() * 100);
  const randomStr = randomNum.toString().padStart(2, '0');

  // 現在のスキルリスト取得
  let skills = [];
  try {
    skills = JSON.parse(player.skills_data || '[]');
  } catch {
    skills = [];
  }

  // 現在のステータス
  const curAtk0 = player.skill_atk ?? 1;
  const curMagic0 = player.skill_magic ?? 1;
  const curSpirit0 = player.skill_spirit ?? 1;

  // ─── 出力メッセージ構築 ────────────────────────────────────
  let message = `-# 🪖 ${armyNames[army]} **${username}** の行動！\n`;
  message += `### 🎲 ジャッジナンバー: __${randomStr}__\n\n`;

  // 累積効果
  let totalDamage = 0;
  let totalHeal = 0;
  let totalAtkUp = 0;
  let totalMagicUp = 0;
  let totalSpiritUp = 0;
  let newSkillsData = skills;
  let playerUpdate = {};

  // ══════════════════════════════════════════════════
  // ① 00: 狙撃ポイント+1
  // ══════════════════════════════════════════════════
  if (randomNum === 0) {
    const newSnipe = (player.skill_snipe ?? 0) + 1;
    playerUpdate.skill_snipe = newSnipe;
    message += `🎯 **狙撃スキルアップ！**\n`;
    message += `> 狙撃ポイント: **${player.skill_snipe ?? 0}** → **${newSnipe}**\n`;

  // ══════════════════════════════════════════════════
  // ② 10の倍数（10〜90）: 技能習得
  // ══════════════════════════════════════════════════
  } else if (randomNum % 10 === 0) {
    const power = rollPower();
    const skillName = SKILL_MAP[randomNum];
    const newSkill = { name: skillName, type: randomNum, power };
    newSkillsData = [...skills, newSkill];
    message += `✨ **技能習得！**\n`;
    message += `> 【${skillName}】 威力: **${power}**\n`;
    message += `> （技能数: ${skills.length} → **${newSkillsData.length}** 個）\n`;

  // ══════════════════════════════════════════════════
  // ③ ゾロ目（11〜99）: 習得技能を順に20%で発動
  // ══════════════════════════════════════════════════
  } else if (Math.floor(randomNum / 10) === randomNum % 10) {
    if (skills.length === 0) {
      message += `⚡ **ゾロ目！** しかし習得した技能がない…\n`;
    } else {
      message += `⚡ **ゾロ目！ 習得技能が順番に発動チャンス！**\n\n`;

      // 発動中に変化する一時変数（HPとステータスは順に更新）
      let curMyHP = myHP;
      let curEnemyHP = enemyHP;
      let curAtk = curAtk0;
      let curMagic = curMagic0;
      let curSpirit = curSpirit0;

      for (const skill of skills) {
        const activated = Math.random() < 0.2;

        if (!activated) {
          message += `❌ 【${skill.name}（威力${skill.power}）】 不発…\n`;
          continue;
        }

        let dmg = 0, hl = 0, atk = 0, mag = 0, spi = 0;
        let desc = '';

        switch (skill.type) {
          case 10: // バンブーランス
            dmg = skill.power * curAtk * 2;
            desc = `【バンブーランス（威力${skill.power}）】 敵軍に **${dmg}** ダメージ！`;
            break;

          case 20: // マッシュラッシュ（自軍優勢条件）
            if (curMyHP > curEnemyHP) {
              dmg = skill.power * curAtk * 2 + skill.power * curAtk; // ×2 + ×1 = ×3
              desc = `【マッシュラッシュ（威力${skill.power}）】 自軍優勢！敵軍に **${dmg}** ダメージ！`;
            } else {
              desc = `【マッシュラッシュ（威力${skill.power}）】 自軍が優勢でないため効果なし…`;
            }
            break;

          case 30: { // アチアチファイア（確率倍率）
            const mult = rollFireMultiplier();
            dmg = skill.power * curMagic * mult;
            desc = `【アチアチファイア（威力${skill.power}）】 ${mult}倍の炎！敵軍に **${dmg}** ダメージ！`;
            break;
          }

          case 40: // ネクロマンシー（自軍劣勢条件）
            if (curMyHP < curEnemyHP) {
              dmg = skill.power * curMagic * 2 + skill.power * curMagic; // ×2 + ×1 = ×3
              desc = `【ネクロマンシー（威力${skill.power}）】 逆境の魔力！敵軍に **${dmg}** ダメージ！`;
            } else {
              desc = `【ネクロマンシー（威力${skill.power}）】 逆境でないため効果なし…`;
            }
            break;

          case 50: // キュンキュア（回復）
            hl = skill.power * curSpirit * 2;
            desc = `【キュンキュア（威力${skill.power}）】 自軍を **${hl}** 回復！`;
            break;

          case 60: // モギモギヘルス（ダメージ＋回復）
            dmg = skill.power * curSpirit;
            hl = skill.power * curSpirit;
            desc = `【モギモギヘルス（威力${skill.power}）】 敵軍に **${dmg}** ダメージ ＆ 自軍 **${hl}** 回復！`;
            break;

          case 70: // アタックアップ
            atk = skill.power;
            desc = `【アタックアップ（威力${skill.power}）】 攻撃が **+${atk}**！`;
            break;

          case 80: // マジックアップ
            mag = skill.power;
            desc = `【マジックアップ（威力${skill.power}）】 魔力が **+${mag}**！`;
            break;

          case 90: // メンタルアップ
            spi = skill.power;
            desc = `【メンタルアップ（威力${skill.power}）】 精神が **+${spi}**！`;
            break;
        }

        message += `✅ ${desc}\n`;

        // 一時変数を更新（次の技能発動判定に影響）
        curEnemyHP = Math.max(0, curEnemyHP - dmg);
        curMyHP = Math.min(initialHP, curMyHP + hl);
        curAtk += atk;
        curMagic += mag;
        curSpirit += spi;

        // 累積値に加算
        totalDamage += dmg;
        totalHeal += hl;
        totalAtkUp += atk;
        totalMagicUp += mag;
        totalSpiritUp += spi;
      } // end for skills
    }
  }
  // ④ それ以外: 何も起きない（メッセージ変化なし）

  // ─── DB 更新 ─────────────────────────────────────────────────

  // プレイヤーのステータス更新
  if (totalAtkUp > 0) playerUpdate.skill_atk = curAtk0 + totalAtkUp;
  if (totalMagicUp > 0) playerUpdate.skill_magic = curMagic0 + totalMagicUp;
  if (totalSpiritUp > 0) playerUpdate.skill_spirit = curSpirit0 + totalSpiritUp;
  playerUpdate.skills_data = JSON.stringify(newSkillsData);
  await player.update(playerUpdate);

  // ダメージ・回復をGameStateに反映
  if (totalDamage > 0 || totalHeal > 0) {
    const gsUpdate = {};
    if (army === 'A') {
      if (totalDamage > 0) gsUpdate.a_team_kills = gameState.a_team_kills + totalDamage;
      if (totalHeal > 0) gsUpdate.b_team_kills = Math.max(0, gameState.b_team_kills - totalHeal);
    } else {
      if (totalDamage > 0) gsUpdate.b_team_kills = gameState.b_team_kills + totalDamage;
      if (totalHeal > 0) gsUpdate.a_team_kills = Math.max(0, gameState.a_team_kills - totalHeal);
    }
    await gameState.update(gsUpdate);
  }

  // ─── 戦況表示 ────────────────────────────────────────────────
  if (totalDamage > 0 || totalHeal > 0) {
    const latestGS = await GameState.findOne();
    const newHP_A = latestGS.initialArmyHP - latestGS.b_team_kills;
    const newHP_B = latestGS.initialArmyHP - latestGS.a_team_kills;

    message += `\n**📊 戦況**\n`;
    message += `🟡 ${armyNames.A}: **${newHP_A}** / ${initialHP}　　🟢 ${armyNames.B}: **${newHP_B}** / ${initialHP}\n`;

    // ステータス変化があった場合のみ表示
    if (totalAtkUp > 0 || totalMagicUp > 0 || totalSpiritUp > 0) {
      const latestPlayer = await User.findOne({ where: { id: userId } });
      message += `\n**⚡ ${username} のステータス**\n`;
      message += `攻撃: **${latestPlayer.skill_atk}**　魔力: **${latestPlayer.skill_magic}**　精神: **${latestPlayer.skill_spirit}**\n`;
    }

    // 終戦判定
    if (newHP_A <= 0 || newHP_B <= 0) {
      const winnerTeam = newHP_A > newHP_B ? armyNames.A : armyNames.B;
      const loserTeam = newHP_A > newHP_B ? armyNames.B : armyNames.A;
      await latestGS.update({ isGameOver: true });
      message += `\n**📢 ${loserTeam}の兵力が0になった！**\n`;
      message += `# 🎖 ${winnerTeam}の勝利だ！\n`;
      message += `**今次大戦は終戦した！次の大戦でまた会おう！**`;
    }
  }

  await interaction.editReply(message);
}
