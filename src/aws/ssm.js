import { SSMClient, SendCommandCommand } from '@aws-sdk/client-ssm';

export async function executeSSMCommand(instanceId, serviceName = 'guidra-prod-server', region = process.env.AWS_REGION || 'ap-south-1') {
  if (!instanceId) {
    throw new Error('AWS_EC2_INSTANCE_ID is required for live AWS SSM remediation.');
  }

  const client = new SSMClient({ region });
  const command = new SendCommandCommand({
    InstanceIds: [instanceId],
    DocumentName: process.env.AWS_SSM_DOCUMENT_NAME || 'AWS-RunShellScript',
    Parameters: {
      commands: [
        `echo "[SSM Remediation] Initiating remediation for ${serviceName} on $(hostname)..."`,
        `if docker ps -a --format '{{.Names}}' | grep -q "^${serviceName}$"; then`,
        `  echo "Restarting Docker container ${serviceName}..."`,
        `  docker restart ${serviceName}`,
        `elif systemctl list-units --type=service | grep -q "${serviceName}"; then`,
        `  echo "Restarting systemd service ${serviceName}..."`,
        `  systemctl restart ${serviceName}`,
        `else`,
        `  echo "Falling back to /opt/guidra docker compose restart..."`,
        `  if [ -d "/opt/guidra" ]; then cd /opt/guidra && docker compose restart; fi`,
        `fi`,
        `echo "[SSM Remediation] Active container status:"`,
        `docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'`
      ]
    },
    Comment: `OpsRoom Automated Remediation for ${serviceName}`
  });

  try {
    const response = await client.send(command);
    const commandInfo = response.Command;

    return {
      status: 'SENT',
      commandId: commandInfo?.CommandId,
      documentName: commandInfo?.DocumentName,
      targetInstance: instanceId,
      requestedAt: commandInfo?.RequestedDateTime,
      message: `SSM Command ${commandInfo?.CommandId} dispatched to instance ${instanceId} for ${serviceName}.`
    };
  } catch (err) {
    throw new Error(`AWS SSM SendCommand failed: ${err.message}`);
  }
}
