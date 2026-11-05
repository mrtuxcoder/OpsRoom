import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

export async function fetchRecentLogs(logGroupName, filterPattern = 'ERROR', limit = 25, region = process.env.AWS_REGION || 'us-east-1') {
  if (!logGroupName) {
    throw new Error('AWS_LOG_GROUP_NAME is required for live CloudWatch log inspection.');
  }

  const client = new CloudWatchLogsClient({ region });
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

  const command = new FilterLogEventsCommand({
    logGroupName,
    startTime: tenMinutesAgo,
    limit,
    filterPattern
  });

  try {
    const response = await client.send(command);
    const events = response.events || [];

    return {
      logGroupName,
      totalEvents: events.length,
      criticalErrors: events.map(e => ({
        timestamp: new Date(e.timestamp).toISOString(),
        message: e.message,
        logStreamName: e.logStreamName
      })),
      rootCauseSummary: events.length > 0
        ? `Isolated ${events.length} error events in CloudWatch group ${logGroupName}.`
        : `No critical errors matching pattern '${filterPattern}' found in the last 10 minutes.`
    };
  } catch (err) {
    throw new Error(`AWS CloudWatch FilterLogEvents failed: ${err.message}`);
  }
}
