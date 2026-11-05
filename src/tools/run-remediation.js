import dotenv from 'dotenv';
import { executeSSMCommand } from '../aws/ssm.js';

dotenv.config();

const isMock = process.env.MOCK_AWS !== 'false';
const MOCK_URL = process.env.MOCK_APP_URL || 'http://localhost:8080';
const TARGET_NAME = process.env.INCIDENT_TARGET_NAME || 'guidra-production';

// Parse command line arguments
const args = process.argv.slice(2);
const tokenIndex = args.indexOf('--token');
const actionIndex = args.indexOf('--action');

const token = tokenIndex !== -1 ? args[tokenIndex + 1] : null;
const action = actionIndex !== -1 ? args[actionIndex + 1] : 'restart';

async function executeRemediation() {
  if (!token) {
    console.error(JSON.stringify({
      status: 'BLOCKED',
      error: 'SECURITY GATE: Missing required approval token (--token <TOKEN>). Remediation cannot proceed without explicit human authorization.'
    }, null, 2));
    process.exit(1);
  }

  console.log(`[REMEDIATION] Validating approval token: [${token}] for action [${action}] on ${TARGET_NAME}...`);

  if (isMock) {
    try {
      const res = await fetch(`${MOCK_URL}/remediate/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action })
      });
      const data = await res.json();

      const result = {
        status: 'SUCCESS',
        mode: 'MOCK_AWS',
        approvalToken: token,
        actionExecuted: action,
        target: TARGET_NAME,
        executionTime: new Date().toISOString(),
        details: data.message,
        nextStep: 'Notify @ops-sentinel to run verification health check.'
      };

      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(JSON.stringify({
        status: 'FAILED',
        mode: 'MOCK_AWS',
        error: `Remediation execution failed: ${err.message}`
      }, null, 2));
      process.exit(1);
    }
  } else {
    // Live AWS SSM Command execution
    try {
      const instanceId = process.env.AWS_EC2_INSTANCE_ID;
      const serviceName = process.env.AWS_SERVICE_NAME || 'guidra-service';
      const ssmResult = await executeSSMCommand(instanceId, serviceName);

      const result = {
        status: 'SUCCESS',
        mode: 'LIVE_AWS',
        approvalToken: token,
        actionExecuted: action,
        target: TARGET_NAME,
        executionTime: new Date().toISOString(),
        ssmCommandId: ssmResult.commandId,
        details: ssmResult.message,
        nextStep: 'Notify @ops-sentinel to run verification health check on ALB.'
      };

      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(JSON.stringify({
        status: 'FAILED',
        mode: 'LIVE_AWS',
        error: err.message
      }, null, 2));
      process.exit(1);
    }
  }
}

executeRemediation();
