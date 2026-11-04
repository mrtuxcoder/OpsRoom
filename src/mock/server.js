import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.MOCK_PORT || 8080;
const TARGET_NAME = process.env.INCIDENT_TARGET_NAME || 'guidra-production';

// Simulated Target State
let serviceState = {
  status: 'healthy',
  statusCode: 200,
  targetName: TARGET_NAME,
  uptimeStart: Date.now(),
  failureReason: null,
  failureTimestamp: null,
  activeConnections: 142,
  cpuUtilization: 24.5,
  memoryUtilization: 41.2
};

// Simulated Application Logs
let applicationLogs = [
  { timestamp: new Date(Date.now() - 3600000).toISOString(), level: 'INFO', message: 'guidra-service worker pool initialized (4 workers active)' },
  { timestamp: new Date(Date.now() - 1800000).toISOString(), level: 'INFO', message: 'Healthcheck probe 200 OK from ALB TargetGroup arn:aws:elasticloadbalancing:tg-guidra-prod' },
  { timestamp: new Date(Date.now() - 600000).toISOString(), level: 'INFO', message: 'Incoming traffic steady: 240 req/min' }
];

// 1. ALB Target Health Check Endpoint
app.get('/health', (req, res) => {
  if (serviceState.status === 'healthy') {
    return res.status(200).json({
      status: 'healthy',
      target: serviceState.targetName,
      statusCode: 200,
      uptimeSeconds: Math.floor((Date.now() - serviceState.uptimeStart) / 1000),
      albTargetGroupHealth: 'HEALTHY'
    });
  } else {
    return res.status(serviceState.statusCode).json({
      status: 'unhealthy',
      target: serviceState.targetName,
      statusCode: serviceState.statusCode,
      error: serviceState.failureReason,
      failedSince: serviceState.failureTimestamp,
      albTargetGroupHealth: 'UNHEALTHY'
    });
  }
});

// 2. CloudWatch Metrics Endpoint
app.get('/metrics', (req, res) => {
  const isHealthy = serviceState.status === 'healthy';
  res.json({
    target: serviceState.targetName,
    timestamp: new Date().toISOString(),
    metrics: {
      CPUUtilization: isHealthy ? serviceState.cpuUtilization : 88.7,
      MemoryUtilization: isHealthy ? serviceState.memoryUtilization : 94.2,
      HTTPCode_Target_5XX_Count: isHealthy ? 0 : 342,
      TargetResponseTime: isHealthy ? 0.042 : 12.8,
      UnHealthyHostCount: isHealthy ? 0 : 1,
      HealthyHostCount: isHealthy ? 1 : 0
    }
  });
});

// 3. Application / CloudWatch Logs Endpoint
app.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const recentLogs = applicationLogs.slice(-limit);
  res.json({
    target: serviceState.targetName,
    logStream: 'guidra-prod/app/stdout',
    count: recentLogs.length,
    logs: recentLogs
  });
});

// 4. Chaos Endpoint: Trip failure
app.post('/chaos/crash', (req, res) => {
  const now = new Date().toISOString();
  serviceState.status = 'unhealthy';
  serviceState.statusCode = 502;
  serviceState.failureReason = 'Bad Gateway: Worker thread pool deadlock (SIGABRT in worker process #2)';
  serviceState.failureTimestamp = now;
  serviceState.cpuUtilization = 89.4;

  applicationLogs.push(
    { timestamp: now, level: 'WARN', message: 'Thread pool queue full: 500 queued requests pending worker dispatch' },
    { timestamp: now, level: 'ERROR', message: 'FATAL: Worker thread #2 terminated unexpectedly: SIGABRT core dumped' },
    { timestamp: now, level: 'ERROR', message: 'ALB Target Health check probe failed: HTTP 502 Bad Gateway on /health' }
  );

  console.log(`[CHAOS] Injected failure into ${TARGET_NAME} at ${now}`);
  res.json({ success: true, message: `Chaos triggered: ${serviceState.failureReason}`, state: serviceState });
});

// 5. Remediation Endpoint: Restart worker service (simulating SSM AWS-RunShellScript)
app.post('/remediate/restart', (req, res) => {
  const now = new Date().toISOString();
  serviceState.status = 'healthy';
  serviceState.statusCode = 200;
  serviceState.failureReason = null;
  serviceState.failureTimestamp = null;
  serviceState.uptimeStart = Date.now();
  serviceState.cpuUtilization = 21.0;

  applicationLogs.push(
    { timestamp: now, level: 'INFO', message: 'AWS-SSM Command execution: systemctl restart guidra-service' },
    { timestamp: now, level: 'INFO', message: 'Gracefully shutting down stale worker processes' },
    { timestamp: now, level: 'INFO', message: 'Worker pool re-spawned with 4 fresh worker threads. Health check 200 OK' }
  );

  console.log(`[REMEDIATE] Service ${TARGET_NAME} successfully restarted via SSM at ${now}`);
  res.json({ success: true, message: `Service ${TARGET_NAME} restarted successfully`, state: serviceState });
});

// 6. Chaos Endpoint: Direct recover
app.post('/chaos/recover', (req, res) => {
  serviceState.status = 'healthy';
  serviceState.statusCode = 200;
  serviceState.failureReason = null;
  console.log(`[CHAOS] Service recovered to healthy state`);
  res.json({ success: true, state: serviceState });
});

app.listen(PORT, () => {
  console.log(`🚀 OpsRoom Mock Target (${TARGET_NAME}) running on http://localhost:${PORT}`);
  console.log(`- Health Check: http://localhost:${PORT}/health`);
  console.log(`- Metrics:      http://localhost:${PORT}/metrics`);
  console.log(`- Logs:         http://localhost:${PORT}/logs`);
});
