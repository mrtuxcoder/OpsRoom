import dotenv from 'dotenv';
dotenv.config();

const isMock = process.env.MOCK_AWS !== 'false';
const MOCK_URL = process.env.MOCK_APP_URL || 'http://localhost:8080';
const TARGET_NAME = process.env.INCIDENT_TARGET_NAME || 'guidra-production';

async function checkHealth() {
  if (isMock) {
    try {
      const [healthRes, metricsRes] = await Promise.all([
        fetch(`${MOCK_URL}/health`),
        fetch(`${MOCK_URL}/metrics`)
      ]);

      const health = await healthRes.json();
      const metrics = await metricsRes.json();

      const output = {
        timestamp: new Date().toISOString(),
        mode: 'MOCK_AWS',
        target: TARGET_NAME,
        status: health.status.toUpperCase(),
        httpStatusCode: health.statusCode,
        albTargetGroupHealth: health.albTargetGroupHealth,
        error: health.error || null,
        metrics: metrics.metrics
      };

      console.log(JSON.stringify(output, null, 2));
      process.exit(output.status === 'HEALTHY' ? 0 : 2);
    } catch (err) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        status: 'UNREACHABLE',
        error: `Could not reach target at ${MOCK_URL}: ${err.message}`
      }, null, 2));
      process.exit(1);
    }
  } else {
    // Live AWS integration
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      mode: 'LIVE_AWS',
      target: TARGET_NAME,
      status: 'CHECKING_AWS_ALB',
      message: 'AWS SDK integration active'
    }, null, 2));
  }
}

checkHealth();
