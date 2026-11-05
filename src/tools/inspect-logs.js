import dotenv from 'dotenv';
import { fetchRecentLogs } from '../aws/logs.js';

dotenv.config();

const isMock = process.env.MOCK_AWS !== 'false';
const MOCK_URL = process.env.MOCK_APP_URL || 'http://localhost:8080';
const TARGET_NAME = process.env.INCIDENT_TARGET_NAME || 'guidra-production';

async function inspectLogs() {
  if (isMock) {
    try {
      const res = await fetch(`${MOCK_URL}/logs?limit=15`);
      const data = await res.json();

      const errorLogs = data.logs.filter(l => l.level === 'ERROR' || l.level === 'WARN');
      
      const diagnosis = {
        timestamp: new Date().toISOString(),
        mode: 'MOCK_AWS',
        target: TARGET_NAME,
        logStream: data.logStream,
        totalLogsRetrieved: data.logs.length,
        errorCount: errorLogs.length,
        criticalErrors: errorLogs,
        rootCauseSummary: errorLogs.length > 0
          ? 'Application-level worker pool failure detected. Worker thread terminated with SIGABRT.'
          : 'No critical errors detected in recent log window.'
      };

      console.log(JSON.stringify(diagnosis, null, 2));
    } catch (err) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: 'MOCK_AWS',
        error: `Failed to fetch logs: ${err.message}`
      }, null, 2));
      process.exit(1);
    }
  } else {
    // Live AWS CloudWatch Logs integration
    try {
      const logGroupName = process.env.AWS_LOG_GROUP_NAME || `/aws/guidra/${TARGET_NAME}`;
      const logData = await fetchRecentLogs(logGroupName);

      const diagnosis = {
        timestamp: new Date().toISOString(),
        mode: 'LIVE_AWS',
        target: TARGET_NAME,
        logGroupName: logData.logGroupName,
        totalLogsRetrieved: logData.totalEvents,
        criticalErrors: logData.criticalErrors,
        rootCauseSummary: logData.rootCauseSummary
      };

      console.log(JSON.stringify(diagnosis, null, 2));
    } catch (err) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: 'LIVE_AWS',
        error: err.message
      }, null, 2));
      process.exit(1);
    }
  }
}

inspectLogs();
