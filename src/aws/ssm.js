import { SSMClient, SendCommandCommand } from '@aws-sdk/client-ssm';

export async function executeSSMCommand(instanceId, serviceName = 'guidra-service', region = process.env.AWS_REGION || 'us-east-1') {
  if (!instanceId) {
    throw new Error('AWS_EC2_INSTANCE_ID is required for live AWS SSM remediation.');
  }

  const client = new SSMClient({ region });
  const command = new SendCommandCommand({
    InstanceIds: [instanceId],
    DocumentName: process.env.AWS_SSM_DOCUMENT_NAME || 'AWS-RunShellScript',
    Parameters: {
      commands: [
        `echo "[SSM Remediation] Initiating restart for ${serviceName}..."`,
        `systemctl restart ${serviceName}`,
        `systemctl is-active ${serviceName}`
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
      message: `SSM Command ${commandInfo?.CommandId} dispatched to instance ${instanceId} to restart ${serviceName}.`
    };
  } catch (err) {
    throw new Error(`AWS SSM SendCommand failed: ${err.message}`);
  }
}
