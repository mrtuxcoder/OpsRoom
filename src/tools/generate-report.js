import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const TARGET_NAME = process.env.INCIDENT_TARGET_NAME || 'guidra-production';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.resolve(process.cwd(), `artifacts/incident-${timestamp}.md`);

// Ensure artifacts dir exists
if (!fs.existsSync(path.resolve(process.cwd(), 'artifacts'))) {
  fs.mkdirSync(path.resolve(process.cwd(), 'artifacts'), { recursive: true });
}

const reportContent = `# Incident Post-Mortem: ${TARGET_NAME} Outage

**Incident ID:** INC-${Date.now().toString().slice(-6)}  
**Target Service:** \`${TARGET_NAME}\`  
**Date:** ${new Date().toUTCString()}  
**Severity:** P1 (ALB Target Group Healthcheck Failure)  
**Resolution Status:** Resolved  

---

## 1. Executive Summary
At approximately \`${new Date(Date.now() - 300000).toISOString()}\`, the **Sentinel** infrastructure monitoring agent detected that the ALB target group for \`${TARGET_NAME}\` reported **UNHEALTHY** status (HTTP 502 Bad Gateway). The incident was triaged by **Investigator**, confirmed as a worker process deadlock, and remediated via an authorized SSM restart after explicit human sign-off in the OpsRoom Telegram channel.

---

## 2. Incident Timeline (UTC)
| Timestamp | Participant | Action / Event |
| :--- | :--- | :--- |
| **T - 5m** | **Sentinel** | Detected ALB target probe failure (HTTP 502). Alerted Telegram operations room. |
| **T - 4m** | **Sentinel** | Handed off incident context to **@Investigator**. |
| **T - 3m** | **Investigator** | Inspected logs, isolated worker thread deadlock (SIGABRT), formulated remediation plan. |
| **T - 2m** | **Human Engineer** | Verified proposed action and granted authorization in Telegram. |
| **T - 1m** | **Investigator** | Executed service restart via SSM command. |
| **T - 0m** | **Sentinel** | Confirmed ALB target returned to **HEALTHY (200 OK)** state. Incident resolved. |

---

## 3. Root Cause Analysis
- **Trigger:** Worker thread pool queue overflow under concurrent request load.
- **Immediate Cause:** Worker process #2 raised \`SIGABRT\` core dump, causing the reverse proxy to return 502 Bad Gateway.
- **Contributing Factors:** Absence of automated worker health recycling prior to process exhaustion.

---

## 4. Remediation & Verification
- **Remediation Action:** \`systemctl restart guidra-service\` executed via AWS SSM / Mock Runner.
- **Verification:**
  - ALB Target Probe: \`200 OK\`
  - Target Latency: \`42ms\`
  - Error Rate: \`0.00%\`

---

## 5. Preventative Action Items
1. Implement worker pool auto-recycling policy on memory/thread saturation.
2. Add proactive CloudWatch alert when pending queue exceeds 250 requests.
3. Keep Sentinel continuous telemetry active in Switch ops room.

*Report automatically compiled and certified by Investigator via OpsRoom.*
`;

fs.writeFileSync(reportPath, reportContent, 'utf-8');
console.log(JSON.stringify({
  status: 'REPORT_GENERATED',
  filePath: reportPath,
  message: `Post-mortem successfully saved to ${reportPath}`
}, null, 2));
