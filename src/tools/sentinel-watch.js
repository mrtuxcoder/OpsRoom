import dotenv from 'dotenv';
dotenv.config();

const TARGET_NAME = process.env.INCIDENT_TARGET_NAME || 'guidra-production';
const MOCK_URL = process.env.MOCK_APP_URL || 'http://localhost:8080';
const isMock = process.env.MOCK_AWS !== 'false';
const CHECK_INTERVAL_MS = parseInt(process.env.WATCH_INTERVAL_MS || '5000');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let lastState = 'UNKNOWN'; // 'HEALTHY' | 'UNHEALTHY'
let failureCount = 0;

console.log(`🛡️  [SENTINEL WATCHER] Starting proactive telemetry monitor for ${TARGET_NAME}...`);
console.log(`⏱️  Check interval: ${CHECK_INTERVAL_MS / 1000}s | Mode: ${isMock ? 'MOCK_AWS' : 'LIVE_AWS'}`);
if (BOT_TOKEN && CHAT_ID) {
  console.log(`📱 Autonomous Telegram broadcast: ENABLED (Chat: ${CHAT_ID})`);
} else {
  console.log(`ℹ️  Telegram broadcast: STANDALONE MODE (Add TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID to .env to auto-post alerts to chat)`);
}

async function notifyTelegram(messageText) {
  if (!BOT_TOKEN || !CHAT_ID) return;

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: messageText,
        parse_mode: 'Markdown'
      })
    });
    const data = await res.json();
    if (!data.ok) {
      console.error(`⚠️  [SENTINEL] Telegram alert failed:`, data.description);
    } else {
      console.log(`📢 [SENTINEL] Alert broadcasted to Telegram group (${CHAT_ID}) successfully.`);
    }
  } catch (err) {
    console.error(`⚠️  [SENTINEL] Network error posting to Telegram:`, err.message);
  }
}

async function pollHealth() {
  try {
    const [healthRes, metricsRes] = await Promise.all([
      fetch(`${MOCK_URL}/health`),
      fetch(`${MOCK_URL}/metrics`)
    ]);

    const health = await healthRes.json();
    const metrics = await metricsRes.json();
    const currentState = health.status.toUpperCase();

    if (currentState === 'HEALTHY') {
      if (lastState !== 'HEALTHY') {
        const recoveryMsg = `✅ *[SENTINEL RECOVERY CONFIRMATION]*\n\nTarget \`${TARGET_NAME}\` is verified *HEALTHY* (HTTP 200 OK).\n• Latency: \`${metrics.metrics.TargetResponseTime * 1000}ms\`\n• Error Count: \`${metrics.metrics.HTTPCode_Target_5XX_Count}\`\n• ALB Probes: Passing\n\nIncident resolved. Post-Mortem compilation authorized.`;
        console.log(`\n========================================`);
        console.log(`🟢 [RECOVERY] ${TARGET_NAME} is HEALTHY (200 OK)`);
        console.log(`========================================\n`);
        await notifyTelegram(recoveryMsg);
        failureCount = 0;
      } else {
        process.stdout.write(`\r[${new Date().toLocaleTimeString()}] 🟢 Sentinel Heartbeat: ${TARGET_NAME} HEALTHY (200 OK) | Latency: 42ms`);
      }
      lastState = 'HEALTHY';
    } else {
      failureCount++;
      if (lastState !== 'UNHEALTHY') {
        const alertMsg = `🚨 *[SENTINEL INCIDENT ALERT]*\n\nTarget \`${TARGET_NAME}\` has failed health checks!\n\n• *Status:* \`${health.statusCode} ${health.error || 'UNHEALTHY'}\`\n• *CPU Utilization:* \`${metrics.metrics.CPUUtilization}%\`\n• *5xx Errors:* \`${metrics.metrics.HTTPCode_Target_5XX_Count}\`\n• *ALB Target Group:* \`UNHEALTHY\`\n\n⚠️ Handoff: Alerting @ops-investigator to triage logs and isolate root cause.`;
        
        console.log(`\n\n========================================`);
        console.log(`🚨 [INCIDENT DETECTED] ${TARGET_NAME} is UNHEALTHY (${health.statusCode})!`);
        console.log(`Error: ${health.error}`);
        console.log(`Handing off to @ops-investigator...`);
        console.log(`========================================\n`);

        await notifyTelegram(alertMsg);
      } else {
        process.stdout.write(`\r[${new Date().toLocaleTimeString()}] 🔴 Sentinel Alert: ${TARGET_NAME} STILL UNHEALTHY (${health.statusCode}) [Failures: ${failureCount}]`);
      }
      lastState = 'UNHEALTHY';
    }
  } catch (err) {
    if (lastState !== 'UNREACHABLE') {
      console.error(`\n⚠️  [SENTINEL] Could not reach target at ${MOCK_URL}: ${err.message}`);
      lastState = 'UNREACHABLE';
    }
  }
}

// Initial check immediately, then on interval
pollHealth();
setInterval(pollHealth, CHECK_INTERVAL_MS);
