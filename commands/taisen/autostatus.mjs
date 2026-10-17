import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { GameState, User } from './game.js';
import { getArmyNames } from '../armyname/armyname.js';

// AUTO戦況表示
//   ① 一定レス数ごとの定期表示
//   ② 兵力が節目（75/50/25/10%）を切ったときの臨時表示
// どちらも /autostatus で設定する。投稿先は軍BOBとは別に指定できる。

const THRESHOLDS = [75, 50, 25, 10];

const RULE_LABELS = {
  ranked:    '🪖 階級制',
  coin:      '🪙 属性コイン制',
  beast:     '🐲 ビースト制',
  passive:   '⚙️ パッシブスキル制',
  fighting:  '🔥 ファイティング制',
  skillgein: '✨ 技能習得制',
  senyuu:    '🤝 戦友制',
  spellcard: '🎴 スペルカード制',
};

// ─── 兵力バー ────────────────────────────────────────────────
function hpBar(current, max, width = 20) {
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/**
 * 戦況ボードのテキストを生成
 * @param {object} gameState
 * @param {{A:string,B:string}} armyNames
 * @param {string} headline 見出し（定期表示 or 臨時表示で変える）
 */
export async function buildWarStatus(gameState, armyNames, headline = '📊 **戦況速報**') {
  const initial = gameState.initialArmyHP;
  const aHP = initial - gameState.b_team_kills;
  const bHP = initial - gameState.a_team_kills;

  const totalActions  = (await User.sum('gekiha_counts')) || 0;
  const actionsA = (await User.sum('gekiha_counts', { where: { army: 'A' } })) || 0;
  const actionsB = (await User.sum('gekiha_counts', { where: { army: 'B' } })) || 0;

  const pct = (v) => Math.max(0, Math.round((v / initial) * 100));

  let msg = `${headline}\n`;
  msg += `-# ルール: ${RULE_LABELS[gameState.rule_type] || '未設定'}　/　総レス数: ${totalActions}\n`;
  msg += `🟡 **${armyNames.A}**　\`${hpBar(aHP, initial)}\` **${Math.max(0, aHP)}** / ${initial}（${pct(aHP)}%）\n`;
  msg += `🟢 **${armyNames.B}**　\`${hpBar(bHP, initial)}\` **${Math.max(0, bHP)}** / ${initial}（${pct(bHP)}%）\n`;

  // 優劣
  if (aHP > bHP)      msg += `-# ⚔️ **${armyNames.A}** が **${aHP - bHP}** 優勢　|　レス数 ${armyNames.A} ${actionsA} : ${actionsB} ${armyNames.B}\n`;
  else if (bHP > aHP) msg += `-# ⚔️ **${armyNames.B}** が **${bHP - aHP}** 優勢　|　レス数 ${armyNames.A} ${actionsA} : ${actionsB} ${armyNames.B}\n`;
  else                msg += `-# ⚔️ **互角！**　|　レス数 ${armyNames.A} ${actionsA} : ${actionsB} ${armyNames.B}\n`;

  return msg;
}

// ─── 節目フラグの読み書き ────────────────────────────────────
function parseFlags(raw) {
  try {
    const d = JSON.parse(raw || '{}');
    return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
  } catch {
    return {};
  }
}

/**
 * 自動表示の判定と投稿。コマンド実行後と軍BOBの行動後に呼ばれる。
 * 失敗しても本来の処理を止めないよう、内部で例外を握りつぶす。
 * @param {import('discord.js').Client} client
 */
export async function checkAutoStatus(client) {
  try {
    const gameState = await GameState.findByPk(1);
    if (!gameState || !gameState.autostatus_enabled) return;
    if (gameState.isGameOver) return;
    if (!gameState.autostatus_channel_id) return;

    const channel = client.channels.cache.get(gameState.autostatus_channel_id);
    if (!channel) return;

    const armyNames = await getArmyNames();
    const initial = gameState.initialArmyHP;
    const aHP = initial - gameState.b_team_kills;
    const bHP = initial - gameState.a_team_kills;

    // ① 兵力の節目（臨時表示）
    if (gameState.autostatus_alerts) {
      const flags = parseFlags(gameState.autostatus_flags);
      let fired = null;

      for (const [armyKey, hp] of [['A', aHP], ['B', bHP]]) {
        const ratio = (hp / initial) * 100;
        for (const t of THRESHOLDS) {
          const key = `${armyKey}-${t}`;
          if (ratio <= t) {
            if (!flags[key]) {
              flags[key] = true;
              // 最も低い節目を優先して1回だけ知らせる
              if (!fired || t < fired.t) fired = { armyKey, t, hp };
            }
          } else {
            // 回復して節目を上回ったら再通知できるように戻す
            delete flags[key];
          }
        }
      }

      await gameState.update({ autostatus_flags: JSON.stringify(flags) });

      if (fired) {
        const headline = `### 🚨 **【戦況警報】${armyNames[fired.armyKey]} の兵力が ${fired.t}% を割った！**`;
        const body = await buildWarStatus(gameState, armyNames, headline);
        await channel.send(body);
        // 臨時表示を出したら定期表示のカウントも進めて連投を防ぐ
        const total = (await User.sum('gekiha_counts')) || 0;
        await gameState.update({ autostatus_last_shown: total });
        return;
      }
    }

    // ② 一定レス数ごと（定期表示）
    const interval = Math.max(1, gameState.autostatus_interval);
    const total = (await User.sum('gekiha_counts')) || 0;
    const last = gameState.autostatus_last_shown || 0;

    if (Math.floor(total / interval) > Math.floor(last / interval)) {
      const headline = `📊 **戦況速報**（${Math.floor(total / interval) * interval}レス到達）`;
      const body = await buildWarStatus(gameState, armyNames, headline);
      await channel.send(body);
      await gameState.update({ autostatus_last_shown: total });
    }

  } catch (error) {
    console.error('❌ AUTO戦況表示エラー:', error);
  }
}

// ─── コマンド定義 ────────────────────────────────────────────
export const data = new SlashCommandBuilder()
  .setName('autostatus')
  .setDescription('戦況の自動表示を設定します（一定レス数ごと／兵力の節目）')
  .addStringOption(option =>
    option.setName('mode')
      .setDescription('on: 有効化 / off: 無効化 / now: 今すぐ戦況を表示')
      .setRequired(true)
      .addChoices(
        { name: 'on  （自動表示を有効化）', value: 'on' },
        { name: 'off （自動表示を停止）',   value: 'off' },
        { name: 'now （今すぐ表示）',       value: 'now' },
      )
  )
  .addIntegerOption(option =>
    option.setName('interval')
      .setDescription('何レスごとに表示するか（既定: 50）')
      .setRequired(false)
      .setMinValue(5)
      .setMaxValue(1000)
  )
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('戦況の投稿先（省略時はこのコマンドを打ったチャンネル）')
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addBooleanOption(option =>
    option.setName('alerts')
      .setDescription('兵力が75/50/25/10%を割ったときの臨時表示（既定: ON）')
      .setRequired(false)
  );

export async function execute(interaction) {
  try {
    const mode = interaction.options.getString('mode');
    const interval = interaction.options.getInteger('interval');
    const channel = interaction.options.getChannel('channel');
    const alerts = interaction.options.getBoolean('alerts');

    const gameState = await GameState.findByPk(1);
    if (!gameState) {
      return await interaction.reply('エラー: まず /rule でルールを設定してください。');
    }

    const armyNames = await getArmyNames();

    // ─── now: その場で戦況を表示 ───
    if (mode === 'now') {
      const body = await buildWarStatus(gameState, armyNames);
      return await interaction.reply(body);
    }

    // ─── off ───
    if (mode === 'off') {
      await gameState.update({ autostatus_enabled: false });
      return await interaction.reply('🔴 **戦況の自動表示を停止しました。**\n-# >>> `/autostatus mode:now` でいつでも手動表示できます。');
    }

    // ─── on ───
    const total = (await User.sum('gekiha_counts')) || 0;
    const updateData = {
      autostatus_enabled: true,
      autostatus_channel_id: channel ? channel.id : interaction.channelId,
      autostatus_last_shown: total,   // 有効化した時点を起点にする
      autostatus_flags: '{}',         // 節目フラグは現在値で取り直す
    };
    if (interval !== null) updateData.autostatus_interval = interval;
    if (alerts !== null) updateData.autostatus_alerts = alerts;

    await gameState.update(updateData);
    await gameState.reload();

    const nextAt = (Math.floor(total / gameState.autostatus_interval) + 1) * gameState.autostatus_interval;

    await interaction.reply(
      `✅ **戦況の自動表示を有効化しました！**\n` +
      `-# >>> 📢 投稿先: <#${gameState.autostatus_channel_id}>\n` +
      `-# >>> 🔁 定期表示: **${gameState.autostatus_interval}レス**ごと（次は ${nextAt} レス時点）\n` +
      `-# >>> 🚨 臨時表示: ${gameState.autostatus_alerts ? '**ON**（兵力 75/50/25/10% を割ったとき）' : 'OFF'}\n` +
      `-# >>> 現在の総レス数: ${total}`
    );

  } catch (error) {
    console.error('AUTO戦況設定エラー:', error);
    await interaction.reply('エラー: 戦況自動表示の設定に失敗しました');
  }
}
